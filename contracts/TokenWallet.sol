pragma ton-solidity >= 0.53.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

interface ITokenWallet {
    function receiveTokens(uint256 amount) external;
}

contract TokenWallet is ITokenWallet {
    address static public root;
    address static public owner;
    
    uint256 public balance;

    constructor() {
        require(msg.sender == root, 101, "Only root can deploy wallet");
        tvm.accept();
    }

    function receiveTokens(uint256 amount) external override {
        require(msg.sender == root, 102, "Only root can mint tokens into wallet");
        tvm.accept();
        balance += amount;
    }

    function transfer(address toWallet, uint256 amount) public {
        require(msg.sender == owner, 103, "Only owner can transfer");
        require(balance >= amount, 104, "Insufficient balance");
        tvm.accept();
        
        balance -= amount;
        ITokenWallet(toWallet).receiveTokens{value: varuint16(0), flag: 64}(amount);
    }
}
