pragma ton-solidity >= 0.53.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./TokenWallet.sol";

interface IBondingCurve {
    function onTokenBurned(uint256 amount, address refundAddress) external;
}

contract TokenRoot {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    address public owner;

    TvmCell public walletCode;

    constructor(string _name, string _symbol, uint8 _decimals, TvmCell _walletCode) {
        tvm.accept();
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        walletCode = _walletCode;
        owner = msg.sender;
    }

    function getWalletAddress(address ownerAddress) public view returns (address) {
        TvmCell stateInit = tvm.buildStateInit({
            contr: TokenWallet,
            varInit: { root: address(this), owner: ownerAddress },
            code: walletCode
        });
        return address(tvm.hash(stateInit));
    }

    function deployWallet(address ownerAddress, uint128 deployValue) public returns (address) {
        tvm.accept();
        TvmCell stateInit = tvm.buildStateInit({
            contr: TokenWallet,
            varInit: { root: address(this), owner: ownerAddress },
            code: walletCode
        });
        address wallet = new TokenWallet{
            stateInit: stateInit,
            value: varuint16(deployValue),
            flag: 2
        }();
        return wallet;
    }

    function mint(address recipient, uint256 amount, uint128 deployWalletValue) public {
        require(msg.sender == owner, 101, "Only owner (BondingCurve) can mint");
        require(amount > 0, 105, "Amount must be greater than zero");
        tvm.accept();

        totalSupply += amount;
        address walletInfo = getWalletAddress(recipient);
        
        // flag 1: send exact deployWalletValue
        ITokenWallet(walletInfo).receiveTokens{value: varuint16(deployWalletValue), flag: 1}(amount);
    }

    // ─── Security Fix: Receive burn notification from legitimate TokenWallet ──
    function notifyBurn(uint256 amount, address refundAddress, address callbackTarget) public {
        // Assegura que o msg.sender é a carteira genuína do refundAddress.
        // Impedindo que carteiras maliciosas mintam queimas inexistentes.
        address expectedWallet = getWalletAddress(refundAddress);
        require(msg.sender == expectedWallet, 106, "Caller is not a valid TokenWallet");
        
        tvm.rawReserve(0, 4); // Mantem apenas o saldo original do contrato e repassa restante do attach pro callback

        totalSupply -= amount;
        
        // Pass the execution context to the Bonding Curve to finalize the Trade out (Sell refund)
        if (callbackTarget.value != 0) {
            IBondingCurve(callbackTarget).onTokenBurned{value: 0, flag: 128}(amount, refundAddress);
        } else {
            // Se nenhum callback de DEX/Curve foi fornecido, reembolso do gas pro usuário
            refundAddress.transfer({ value: 0, flag: 128, bounce: false });
        }
    }
}
