pragma ton-solidity >= 0.53.0;
pragma AbiHeader expire;

interface ITokenRoot {
    //
}

contract TokenWallet {
    uint128 public balance;
    address public owner;
    address public root;

    constructor(address _owner, address _root) public {
        require(tvm.pubkey() != 0, 101);
        require(msg.pubkey() == tvm.pubkey(), 102);
        tvm.accept();
        owner = _owner;
        root = _root;
    }

    function acceptTransfer(uint128 amount, address sender) public {
        // Can only be called by other wallets or the root
        require(msg.sender == root, 104);
        tvm.accept();
        balance += amount;
    }

    function transfer(address to, uint128 amount) public {
        require(msg.sender == owner, 105);
        require(balance >= amount, 106);
        tvm.accept();
        
        balance -= amount;
        // In TVM we build the destination wallet address via state init 
        // and call `ITokenWallet(dest).acceptTransfer{value: 0.1 ton}(amount, owner)`
    }
}
