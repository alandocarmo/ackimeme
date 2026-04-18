pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./Interfaces.sol";

contract TokenWallet is ITokenWallet {
    address static public root;
    address static public owner;
    
    uint256 public balance;

    constructor() {
        require(msg.sender == root, 101, "Only root can deploy wallet");
        // Fix #8: Removido tvm.accept() — não necessário em mensagem interna
        // O gas vem do msg.value da mensagem interna do TokenRoot
    }

    // ─── N3: Auto-replenishment via DappConfig ───────────────────────────────
    function _getTokens() private pure {
        if (address(this).balance > 100000000000) { // 100 VMSHELL
            return;
        }
        gosh.mintshell(100000000000); // 100 VMSHELL
    }

    // Fix #8: Removido tvm.accept() de receiveTokens — é mensagem interna do root
    function receiveTokens(uint256 amount) external override {
        // Na Acki Nacki, mensagens internas do root carregam seu próprio gas
        require(msg.sender == root, 102, "Only root can mint tokens into wallet");
        // tvm.accept() REMOVIDO — não chamar em mensagem interna
        _getTokens(); // N3
        balance += amount;
    }

    function transfer(address toWallet, uint256 amount) public {
        require(msg.sender == owner, 103, "Only owner can transfer");
        require(balance >= amount, 104, "Insufficient balance");
        // tvm.accept() mantido — owner pode enviar via msg externa
        tvm.accept();
        _getTokens(); // N3
        
        balance -= amount;
        // flag: 64 envia o gás restante para custear a execução na outra ponta
        ITokenWallet(toWallet).receiveTokens{value: 0, flag: 64}(amount);
    }

    // ─── Security Fix: Burn functionality (Async Callback Pattern) ───────────
    function burn(uint256 amount, address callbackTarget) public {
        require(msg.sender == owner, 105, "Only owner can burn tokens");
        require(balance >= amount, 104, "Insufficient balance to burn");
        tvm.accept();
        _getTokens(); // N3
        
        balance -= amount;
        // Repassa a execução para o TokenRoot informando a quantia deletada e quem deve ser reembolsado
        ITokenRoot(root).notifyBurn{value: 0, flag: 64}(amount, owner, callbackTarget);
    }

    // ─── N5: onBounce handler ────────────────────────────────────────────────
    onBounce(TvmSlice body) external {
        // Se notifyBurn bounced, ideal é usar um pending tracker, 
        // mas TvmSlice restringe payload a 256 bits, impossibilitando decode de amount se tiver outros refs.
        uint32 funcId = body.load(uint32);
        if (funcId == abi.functionId(ITokenRoot.notifyBurn)) {
            // Logically we cannot safely body.decode(uint256) due to cell underflow risk.
            // PENDING: Synchronize off-chain or trust root's callback.
        }
    }
}
