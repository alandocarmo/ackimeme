pragma ton-solidity >= 0.53.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./TokenWallet.sol";

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
        tvm.accept();

        totalSupply += amount;

        address walletInfo = getWalletAddress(recipient);
        
        // This is a simplified internal message to call receiveTokens on the wallet
        // In full TIP-3 this involves payload packaging
        ITokenWallet(walletInfo).receiveTokens{value: varuint16(deployWalletValue), flag: 1}(amount);
    }
}
