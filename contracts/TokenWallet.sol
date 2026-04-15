pragma ton-solidity >= 0.53.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

interface ITokenWallet {
    function receiveTokens(uint256 amount) external;
}

interface ITokenRoot {
    function notifyBurn(uint256 amount, address refundAddress, address callbackTarget) external;
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
        // Na Acki Nacki, mensagens assíncronas do root são aceitas com gás restante
        require(msg.sender == root, 102, "Only root can mint tokens into wallet");
        tvm.accept();
        balance += amount;
    }

    function transfer(address toWallet, uint256 amount) public {
        require(msg.sender == owner, 103, "Only owner can transfer");
        require(balance >= amount, 104, "Insufficient balance");
        tvm.accept(); // Confirma o uso do gás do usuário
        
        balance -= amount;
        // flag: 64 envia o gás restante para custear a execução na outra ponta
        ITokenWallet(toWallet).receiveTokens{value: 0, flag: 64}(amount);
    }

    // ─── Security Fix: Burn functionality (Async Callback Pattern) ───────────
    function burn(uint256 amount, address callbackTarget) public {
        require(msg.sender == owner, 105, "Only owner can burn tokens");
        require(balance >= amount, 104, "Insufficient balance to burn");
        tvm.accept();
        
        balance -= amount;
        // Repassa a execução para o TokenRoot informando a quantia deletada e quem deve ser reembolsado
        ITokenRoot(root).notifyBurn{value: 0, flag: 64}(amount, owner, callbackTarget);
    }
}
