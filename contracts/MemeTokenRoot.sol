pragma ton-solidity >= 0.53.0;
pragma AbiHeader expire;

interface ITokenWallet {
    function acceptTransfer(uint128 amount, address sender) external;
}

contract MemeTokenRoot {
    uint256 static _nonce;
    string public name;
    string public symbol;
    uint8 public decimals;
    uint128 public totalSupply;
    
    address public owner;

    constructor(string _name, string _symbol, uint8 _decimals) public {
        require(tvm.pubkey() != 0, 101);
        require(msg.pubkey() == tvm.pubkey(), 102);
        tvm.accept();

        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        owner = msg.sender;
    }

    /// @dev Mint function to emit tokens via Bonding Curve rules
    function mint(address to, uint128 amount) public {
        require(msg.sender == owner, 103);
        tvm.accept();

        totalSupply += amount;

        // TvmCell construction of Wallet
        // Logic to send remote method execution `acceptTransfer` to TokenWallet of user
    }
}
