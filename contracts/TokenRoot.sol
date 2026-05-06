pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./Interfaces.sol";
import "./TokenWallet.sol";
import "./BondingCurve.sol";



contract TokenRoot {
    uint64 private constant GAS_TOP_UP = 2_000_000_000; // 2 VMSHELL in nano
    uint128 private constant MIN_EXECUTION_GAS = 1 ton;

    // ─── R-04: static vars FIRST — determinam o stateInit hash (= endereço do contrato) ──
    // deployNonce garante endereços únicos mesmo com mesmo nome/symbol.
    // Calculado pelo backend como sha256(creator + symbol + paymentTxHash).
    uint256 static public deployNonce;

    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    address public owner;

    TvmCell public walletCode;

    // ─── BondingCurve deploy support (N2 — DappID architecture) ──────────────
    TvmCell public bondingCurveCode;    // ABI+TVC do BondingCurve para deploy interno
    address public bondingCurve;        // Endereço do BondingCurve deployado

    mapping(uint32 => uint256) public pendingMintsByNonce;
    mapping(uint32 => address) private _pendingMintWallets;

    mapping(uint32 => uint256) private _pendingTransferAmounts;
    mapping(uint32 => address) private _pendingTransferSourceWallets;
    mapping(uint32 => address) private _pendingTransferRecipientWallets;
    mapping(uint32 => uint32) private _pendingTransferWalletSeqnos;
    uint32 private _transferSeqno = 1;

    // BUG-2 FIX: Track pending burn amounts by seqno for safe onBounce rollback.
    // Bounce body only has 224 bits after funcId — uint256 (256 bits) causes cell underflow.
    mapping(uint32 => uint256) private _pendingBurnAmounts;
    mapping(uint32 => address) private _pendingBurnWallets;
    mapping(uint32 => uint32) private _pendingBurnWalletSeqnos;
    uint32 private _burnSeqno = 1;

    // ─── Fix N1: tvm.accept() ANTES de gosh.cnvrtshellq() ────────────────────
    // Em mensagens externas, o contrato só pode gastar gas do próprio saldo
    // após tvm.accept(). Ordem correta: checks → tvm.accept() → side effects.
    constructor(
        string _name,
        string _symbol,
        uint8 _decimals,
        TvmCell _walletCode,
        address _owner,
        uint64 _shellToConvert
    ) {
        require(tvm.pubkey() != 0, 101);
        require(msg.pubkey() == tvm.pubkey(), 102);
        tvm.accept();

        // N1: Converte SHELL em VMSHELL após aceitar gas — ordem correta
        if (_shellToConvert > 0) {
            gosh.cnvrtshellq(_shellToConvert);
        }

        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        walletCode = _walletCode;
        owner = _owner;  // Fix #3: owner explícito em vez de msg.sender
    }



    function getWalletAddress(address ownerAddress) public view returns (address) {
        TvmCell stateInit = tvm.buildStateInit({
            contr: TokenWallet,
            varInit: { root: address(this), owner: ownerAddress },
            code: walletCode
        });
        return address(tvm.hash(stateInit));
    }

    // ─── Internal helper: build stateInit for a TokenWallet ──────────────────
    function _buildWalletStateInit(address ownerAddress) private view returns (TvmCell) {
        return tvm.buildStateInit({
            contr: TokenWallet,
            varInit: { root: address(this), owner: ownerAddress },
            code: walletCode
        });
    }

    function _ensureExecutionGas() private {
        if (address(this).balance > MIN_EXECUTION_GAS) {
            return;
        }
        gosh.mintshell(GAS_TOP_UP);
    }

    function deployWallet(address ownerAddress, uint128 deployValue) public returns (address) {
        // M-01: Removed unauthorized tvm.accept() and restricted to owner or bonding curve
        require(msg.sender == owner || msg.sender == bondingCurve, 109, "Unauthorized call to deployWallet");
        if (msg.sender == owner) {
            tvm.accept();
            _ensureExecutionGas();
        }
        
        TvmCell stateInit = _buildWalletStateInit(ownerAddress);
        address wallet = new TokenWallet{
            stateInit: stateInit,
            value: varuint16(deployValue),
            flag: 2
        }();
        return wallet;
    }

    // ─── C-03: mint() now includes stateInit for auto-wallet deployment ──────
    // When sending tokens to a wallet that doesn't exist yet, the stateInit
    // ensures the TokenWallet contract is automatically deployed.
    // Without stateInit, the first mint to any recipient would bounce.
    function mint(uint32 mintNonce, address recipient, uint256 amount, uint128 deployWalletValue) public {
        require(msg.sender == bondingCurve && bondingCurve != address(0), 110, "Only BondingCurve can mint");
        require(amount > 0, 105, "Amount must be greater than zero");

        totalSupply += amount;
        
        // Build stateInit for the recipient's TokenWallet
        TvmCell stateInit = _buildWalletStateInit(recipient);
        address walletAddr = address(tvm.hash(stateInit));
        
        pendingMintsByNonce[mintNonce] = amount;
        _pendingMintWallets[mintNonce] = walletAddr;

        // C-03: Include stateInit in the message so the wallet is deployed
        // if it doesn't exist yet. If it already exists, stateInit is ignored.
        walletAddr.transfer({
            stateInit: stateInit,
            value: varuint16(deployWalletValue),
            body: _buildReceiveTokensBody(mintNonce, amount),
            flag: 1
        });
    }

    // ─── Helper: encode receiveTokens call body ──────────────────────────────
    function _buildReceiveTokensBody(uint32 nonce, uint256 amount) private pure inline returns (TvmCell) {
        return abi.encodeBody(ITokenWallet.receiveTokens, nonce, amount);
    }

    function onMintDelivered(uint32 mintNonce) public {
        address expectedWallet = _pendingMintWallets[mintNonce];
        require(expectedWallet != address(0), 114, "Unknown mint nonce");
        require(msg.sender == expectedWallet, 115, "Mint confirmation not from target wallet");

        delete pendingMintsByNonce[mintNonce];
        delete _pendingMintWallets[mintNonce];

        if (bondingCurve != address(0)) {
            IBondingCurve(bondingCurve).onMintSuccess{value: 0, flag: 64, bounce: false}(mintNonce);
        }
    }

    function transferFromWallet(uint32 walletSeqno, address fromOwner, address recipientOwner, uint256 amount) public {
        address sourceWallet = getWalletAddress(fromOwner);
        require(msg.sender == sourceWallet, 116, "Caller is not sender TokenWallet");
        require(recipientOwner != address(0), 117, "Recipient owner cannot be zero address");
        require(amount > 0, 118, "Transfer amount must be greater than zero");

        TvmCell stateInit = _buildWalletStateInit(recipientOwner);
        address recipientWallet = address(tvm.hash(stateInit));

        uint32 transferNonce = ++_transferSeqno;
        _pendingTransferAmounts[transferNonce] = amount;
        _pendingTransferSourceWallets[transferNonce] = sourceWallet;
        _pendingTransferRecipientWallets[transferNonce] = recipientWallet;
        _pendingTransferWalletSeqnos[transferNonce] = walletSeqno;

        recipientWallet.transfer({
            stateInit: stateInit,
            value: 0.1 ton,
            body: abi.encodeBody(ITokenWallet.receiveTransfer, transferNonce, amount),
            flag: 1
        });
    }

    function onTransferDelivered(uint32 transferNonce) public {
        address recipientWallet = _pendingTransferRecipientWallets[transferNonce];
        require(recipientWallet != address(0), 119, "Unknown transfer nonce");
        require(msg.sender == recipientWallet, 120, "Transfer confirmation not from recipient wallet");

        address sourceWallet = _pendingTransferSourceWallets[transferNonce];
        uint32 walletSeqno = _pendingTransferWalletSeqnos[transferNonce];
        _clearTransfer(transferNonce);

        if (sourceWallet != address(0)) {
            ITokenWallet(sourceWallet).onTransferDelivered{value: 0, flag: 64, bounce: false}(walletSeqno);
        }
    }

    // ─── Fix #4: transferOwnership — permite transferir ownership para o BondingCurve ──
    function transferOwnership(address newOwner) public {
        require(msg.sender == owner, 111, "Only current owner can transfer ownership");
        require(newOwner != address(0), 106, "New owner cannot be zero address");
        owner = newOwner;
    }

    // ─── N2: Deploy BondingCurve via internal message (mesmo DappID) ─────────
    // O backend chama esta função após deployar o TokenRoot para que
    // o BondingCurve seja deployado sob o mesmo DappID.
    function setBondingCurveCode(TvmCell _code) public {
        require(msg.pubkey() == tvm.pubkey(), 102, "Only deployer pubkey can set BC code");
        require(bondingCurveCode.toSlice().empty(), 107, "BondingCurve code already set");
        tvm.accept();
        _ensureExecutionGas();
        bondingCurveCode = _code;
    }

    function deployBondingCurve(
        address _owner,
        string _name,
        string _symbol,
        bytes _creationFeeTxHash,
        uint256 _supplyCap,
        uint128 _initialBalance
    ) public {
        require(msg.pubkey() == tvm.pubkey(), 102, "Only deployer pubkey can deploy BC");
        require(bondingCurve == address(0), 108, "BondingCurve already deployed");
        require(!bondingCurveCode.toSlice().empty(), 112, "BondingCurve code not set");
        require(_supplyCap > 0, 113, "Supply cap must be greater than zero");
        tvm.accept();
        _ensureExecutionGas();

        // C-05: Build stateInit with static _tokenRoot for unique address per token
        TvmCell stateInit = tvm.buildStateInit({
            contr: BondingCurve,
            varInit: { _tokenRoot: address(this), _supplyCap: _supplyCap },
            code: bondingCurveCode
        });

        // Deploy BondingCurve via internal message using new with stateInit
        // This is the correct pattern in TVM-Solidity — no need to manually encode
        // the constructor body (tvm.functionId(X.constructor) is not valid syntax)
        address bcAddr = new BondingCurve{
            stateInit: stateInit,
            value: varuint16(_initialBalance),
            flag: 1
        }(_owner, address(this), _name, _symbol, _creationFeeTxHash);

        bondingCurve = bcAddr;
        owner = bcAddr; // Transfere ownership automaticamente para o BondingCurve
    }

    // ─── Security Fix: Receive burn notification from legitimate TokenWallet ──
    function notifyBurn(uint32 seqno, uint256 amount, address refundAddress, address callbackTarget) public {
        // Assegura que o msg.sender é a carteira genuína do refundAddress.
        // Impedindo que carteiras maliciosas mintem queimas inexistentes.
        address expectedWallet = getWalletAddress(refundAddress);
        require(msg.sender == expectedWallet, 106, "Caller is not a valid TokenWallet");
        
        // H-03: Validate callbackTarget prevents arbitrary contract execution draining
        require(callbackTarget == bondingCurve || callbackTarget == address(0), 107, "callbackTarget must be registered BondingCurve");
        
        tvm.rawReserve(0, 4); // Mantem apenas o saldo original do contrato e repassa restante do attach pro callback

        totalSupply -= amount;

        // Pass the execution context to the Bonding Curve to finalize the Trade out (Sell refund)
        if (callbackTarget != address(0)) {
            // BUG-2 FIX: Track pending burn amount by seqno for safe onBounce rollback
            uint32 burnNonce = ++_burnSeqno;
            _pendingBurnAmounts[burnNonce] = amount;
            _pendingBurnWallets[burnNonce] = msg.sender;
            _pendingBurnWalletSeqnos[burnNonce] = seqno;
            IBondingCurve(callbackTarget).onTokenBurned{value: 0, flag: 128}(burnNonce, amount, refundAddress);
        } else {
            // Se nenhum callback de DEX/Curve foi fornecido, reembolso do gas pro usuário
            refundAddress.transfer({ value: 0, flag: 128, bounce: false });
        }
    }

    function _clearTransfer(uint32 transferNonce) private {
        delete _pendingTransferAmounts[transferNonce];
        delete _pendingTransferSourceWallets[transferNonce];
        delete _pendingTransferRecipientWallets[transferNonce];
        delete _pendingTransferWalletSeqnos[transferNonce];
    }

    // ─── N5: onBounce handler — reverte estado se operações async falharem ───
    onBounce(TvmSlice body) external {
        tvm.rawReserve(0, 4);
        if (body.bits() < 32) {
            return;
        }
        uint32 funcId = body.load(uint32);
        
        if (funcId == abi.functionId(ITokenWallet.receiveTokens)) {
            if (body.bits() < 32) {
                return;
            }
            // Em caso de bounce no mint (falha de receiveTokens), revertemos o valor
            // utilizando pendingMintsByNonce para garantir precisão e desinflar o saldo fantasma.
            uint32 nonce = body.load(uint32);
            uint256 failedAmount = pendingMintsByNonce[nonce];
            if (failedAmount > 0) {
                totalSupply -= failedAmount;
                delete pendingMintsByNonce[nonce];
                delete _pendingMintWallets[nonce];
            }
            if (bondingCurve != address(0)) {
                IBondingCurve(bondingCurve).onMintFailed{value: 0, flag: 64, bounce: false}(nonce);
            }
        }

        if (funcId == abi.functionId(ITokenWallet.receiveTransfer)) {
            if (body.bits() < 32) {
                return;
            }
            uint32 transferNonce = body.load(uint32);
            address sourceWallet = _pendingTransferSourceWallets[transferNonce];
            uint32 walletSeqno = _pendingTransferWalletSeqnos[transferNonce];
            if (sourceWallet != address(0)) {
                ITokenWallet(sourceWallet).onTransferFailed{value: 0, flag: 64, bounce: false}(walletSeqno);
            }
            _clearTransfer(transferNonce);
        }
        
        // BUG-2 FIX: Handle IBondingCurve.onTokenBurned bounce using nonce mapping
        // Bounce body has only 224 bits after funcId. We read uint32 burnNonce (32 bits)
        // which fits safely, then look up the amount from our mapping.
        if (funcId == abi.functionId(IBondingCurve.onTokenBurned)) {
            if (body.bits() < 32) {
                return;
            }
            uint32 burnNonce = body.load(uint32);
            uint256 amount = _pendingBurnAmounts[burnNonce];
            if (amount > 0) {
                totalSupply += amount; // Revert the burn

                address wallet = _pendingBurnWallets[burnNonce];
                uint32 walletSeqno = _pendingBurnWalletSeqnos[burnNonce];
                if (wallet != address(0)) {
                    ITokenWallet(wallet).onBurnFailed{value: 0, flag: 64, bounce: false}(walletSeqno);
                }

                delete _pendingBurnAmounts[burnNonce];
                delete _pendingBurnWallets[burnNonce];
                delete _pendingBurnWalletSeqnos[burnNonce];
            }
        }
    }
}
