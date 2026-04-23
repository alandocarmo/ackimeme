pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./Interfaces.sol";

contract TokenWallet is ITokenWallet {
    address static public root;
    address static public owner;
    
    uint256 public balance;

    // ─── Segurança: Track de operações pendentes ─────────────────────────────
    // Previne perda de tokens quando mensagens de burn/transfer bounceiam.
    // Padrão TVM: debitar do saldo, guardar em pending, restaurar se bounced.
    uint32 private _burnSeqno;
    uint32 private _transferSeqno;
    mapping(uint32 => uint256) public pendingBurns;
    mapping(uint32 => uint256) public pendingTransfers;

    constructor() {
        require(msg.sender == root, 101, "Only root can deploy wallet");
        // Fix #8: Removido tvm.accept() — não necessário em mensagem interna
        // O gas vem do msg.value da mensagem interna do TokenRoot
    }

    // ─── N3: Auto-replenishment via DappConfig ───────────────────────────────
    function _getTokens() private {
        if (address(this).balance > 100000000000) { // 100 VMSHELL
            return;
        }
        gosh.mintshell(100000000000); // 100 VMSHELL
    }

    // Fix #8: Removido tvm.accept() de receiveTokens — é mensagem interna do root
    function receiveTokens(uint32 nonce, uint256 amount) external override {
        // Na Acki Nacki, mensagens internas do root carregam seu próprio gas
        require(msg.sender == root, 102, "Only root can mint tokens into wallet");
        // tvm.accept() REMOVIDO — não chamar em mensagem interna
        _getTokens(); // N3

        // Se este nonce está em pendingTransfers, é uma transferência recebida com sucesso
        // Se não, é um mint normal do root
        balance += amount;
    }

    function transfer(address toWallet, uint256 amount) public {
        require(msg.sender == owner, 103, "Only owner can transfer");
        require(balance >= amount, 104, "Insufficient balance");
        // BUG-6: tvm.accept() REMOVIDO - owner calls are internal messages and bring their own gas
        _getTokens(); // N3
        
        // Track: guardar transferência pendente antes de debitar
        uint32 seqno = _transferSeqno++;
        pendingTransfers[seqno] = amount;
        balance -= amount;
        
        // Storage leak prevention: clean up old transfers
        if (seqno >= 500) {
            delete pendingTransfers[seqno - 500];
        }
        
        // flag: 64 envia o gás restante para custear a execução na outra ponta
        ITokenWallet(toWallet).receiveTokens{value: 0, flag: 64}(seqno, amount);
    }

    // ─── Security Fix: Burn functionality (Async Callback Pattern) ───────────
    function burn(uint256 amount, address callbackTarget) public {
        require(msg.sender == owner, 105, "Only owner can burn tokens");
        require(balance >= amount, 104, "Insufficient balance to burn");
        // BUG-6: tvm.accept() REMOVIDO
        _getTokens(); // N3
        
        // Track: guardar burn pendente antes de debitar
        uint32 seqno = _burnSeqno++;
        pendingBurns[seqno] = amount;
        balance -= amount;
        
        // Storage leak prevention: clean up old burns
        if (seqno >= 500) {
            delete pendingBurns[seqno - 500];
        }
        
        // Repassa a execução para o TokenRoot informando a quantia deletada e quem deve ser reembolsado
        ITokenRoot(root).notifyBurn{value: 0, flag: 64}(amount, owner, callbackTarget);
    }

    // ─── N5: onBounce handler — restaura saldo em caso de falha ──────────────
    onBounce(TvmSlice body) external {
        uint32 funcId = body.load(uint32);

        // Se notifyBurn bounceou (TokenRoot não aceitou), restaurar balance
        if (funcId == abi.functionId(ITokenRoot.notifyBurn)) {
            // Em TVM, restam no máximo 224 bits após ler funcId. uint256 não cabe.
            // Então confiamos sempre no registro interno separado _burnSeqno
            if (_burnSeqno > 0) {
                uint32 lastSeqno = _burnSeqno - 1;
                optional(uint256) pending = pendingBurns.fetch(lastSeqno);
                if (pending.hasValue()) {
                    balance += pending.get();
                    delete pendingBurns[lastSeqno];
                }
            }
        }

        // Se receiveTokens bounceou em outra wallet, restaurar balance
        if (funcId == abi.functionId(ITokenWallet.receiveTokens)) {
            // No bounce de receiveTokens o nonce e amount muitas vezes não cabem se payload fosse maior (mas aqui sim é seqno de 32 e amount de 256 não cabendo os dois). 
            // Fallback: tentar restaurar pela última pending transfer usando o contador isolado _transferSeqno
            if (_transferSeqno > 0) {
                uint32 lastSeqno = _transferSeqno - 1;
                optional(uint256) pending = pendingTransfers.fetch(lastSeqno);
                if (pending.hasValue()) {
                    balance += pending.get();
                    delete pendingTransfers[lastSeqno];
                }
            }
        }
    }
}
