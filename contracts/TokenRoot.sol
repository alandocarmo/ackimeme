pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./Interfaces.sol";
import "./TokenWallet.sol";
import "./BondingCurve.sol";



contract TokenRoot {
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

    // ─── Fix #3: owner passado explicitamente (msg.sender = address(0) em ext msg) ───
    // ─── Fix N1: gosh.cnvrtshellq() para converter SHELL em VMSHELL no deploy ────────
    constructor(
        string _name,
        string _symbol,
        uint8 _decimals,
        TvmCell _walletCode,
        address _owner,
        uint64 _shellToConvert
    ) {
        // N1: Converte SHELL em VMSHELL — obrigatório para deploy via mensagem externa
        gosh.cnvrtshellq(_shellToConvert);

        require(tvm.pubkey() != 0, 101);
        require(msg.pubkey() == tvm.pubkey(), 102);
        tvm.accept();

        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        walletCode = _walletCode;
        owner = _owner;  // Fix #3: owner explícito em vez de msg.sender
    }

    // ─── N3: Auto-replenishment via DappConfig ───────────────────────────────
    function _getTokens() private {
        if (address(this).balance > 100000000000) { // 100 VMSHELL
            return;
        }
        gosh.mintshell(100000000000); // 100 VMSHELL
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

    function deployWallet(address ownerAddress, uint128 deployValue) public returns (address) {
        // M-01: Removed unauthorized tvm.accept() and restricted to owner or bonding curve
        require(msg.sender == owner || msg.sender == bondingCurve, 109, "Unauthorized call to deployWallet");
        _getTokens(); // N3
        
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
        require(msg.sender == bondingCurve && bondingCurve != address(0), 101, "Only BondingCurve can mint");
        require(amount > 0, 105, "Amount must be greater than zero");
        _getTokens(); // N3

        totalSupply += amount;
        
        // Build stateInit for the recipient's TokenWallet
        TvmCell stateInit = _buildWalletStateInit(recipient);
        address walletAddr = address(tvm.hash(stateInit));
        
        pendingMintsByNonce[mintNonce] = amount;

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
        TvmBuilder b;
        b.store(uint32(tvm.functionId(ITokenWallet.receiveTokens)));
        b.store(nonce);
        b.store(amount);
        return b.toCell();
    }

    // ─── Fix #4: transferOwnership — permite transferir ownership para o BondingCurve ──
    function transferOwnership(address newOwner) public {
        require(msg.sender == owner, 101, "Only current owner can transfer ownership");
        require(newOwner != address(0), 106, "New owner cannot be zero address");
        _getTokens(); // N3
        owner = newOwner;
    }

    // ─── N2: Deploy BondingCurve via internal message (mesmo DappID) ─────────
    // O backend chama esta função após deployar o TokenRoot para que
    // o BondingCurve seja deployado sob o mesmo DappID.
    function setBondingCurveCode(TvmCell _code) public {
        require(msg.pubkey() == tvm.pubkey(), 102, "Only deployer can set BC code");
        require(bondingCurve == address(0), 107, "BondingCurve code already set");
        tvm.accept();
        _getTokens(); // N3
        bondingCurveCode = _code;
    }

    function deployBondingCurve(
        address _owner,
        string _name,
        string _symbol,
        bytes _creationFeeTxHash,
        uint128 _initialBalance
    ) public {
        require(msg.pubkey() == tvm.pubkey(), 102, "Only deployer can deploy BC");
        require(bondingCurve == address(0), 108, "BondingCurve already deployed");
        tvm.accept();
        _getTokens(); // N3

        // C-05: Build stateInit with static _tokenRoot for unique address per token
        TvmCell stateInit = tvm.buildStateInit({
            contr: BondingCurve,
            varInit: { _tokenRoot: address(this) },
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
    function notifyBurn(uint256 amount, address refundAddress, address callbackTarget) public {
        // Assegura que o msg.sender é a carteira genuína do refundAddress.
        // Impedindo que carteiras maliciosas mintem queimas inexistentes.
        address expectedWallet = getWalletAddress(refundAddress);
        require(msg.sender == expectedWallet, 106, "Caller is not a valid TokenWallet");
        
        // H-03: Validate callbackTarget prevents arbitrary contract execution draining
        require(callbackTarget == bondingCurve || callbackTarget == address(0), 107, "callbackTarget must be registered BondingCurve");

        _getTokens(); // N3
        
        tvm.rawReserve(0, 4); // Mantem apenas o saldo original do contrato e repassa restante do attach pro callback

        totalSupply -= amount;
        
        // Pass the execution context to the Bonding Curve to finalize the Trade out (Sell refund)
        if (callbackTarget != address(0)) {
            IBondingCurve(callbackTarget).onTokenBurned{value: 0, flag: 128}(amount, refundAddress);
        } else {
            // Se nenhum callback de DEX/Curve foi fornecido, reembolso do gas pro usuário
            refundAddress.transfer({ value: 0, flag: 128, bounce: false });
        }
    }

    // ─── N5: onBounce handler — reverte estado se operações async falharem ───
    onBounce(TvmSlice body) external {
        tvm.rawReserve(0, 4);
        uint32 funcId = body.load(uint32);
        
        if (funcId == abi.functionId(ITokenWallet.receiveTokens)) {
            // Em caso de bounce no mint (falha de receiveTokens), revertemos o valor
            // utilizando pendingMintsByNonce para garantir precisão e desinflar o saldo fantasma.
            uint32 nonce = body.load(uint32);
            uint256 failedAmount = pendingMintsByNonce[nonce];
            if (failedAmount > 0) {
                totalSupply -= failedAmount;
                delete pendingMintsByNonce[nonce];
            }
        }
    }
}
