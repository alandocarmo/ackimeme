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
        ITokenRoot(root).notifyBurn{value: 0, flag: 64}(seqno, amount, owner, callbackTarget);
    }

    // ─── Audit #6: onBounce handler — read nonce from bounce body for exact rollback ──
    // Previous implementation used _burnSeqno-1 / _transferSeqno-1 which fails
    // when multiple operations are pending (wrong amount restored).
    // Bounce body has 224 bits after funcId. uint32 nonce (32 bits) fits safely.
    onBounce(TvmSlice body) external {
        uint32 funcId = body.load(uint32);

        // N8 FIX: notifyBurn now has uint32 seqno as first param, so it fits in 32 bits
        // and we can read it to exactly restore the correct amount.
        if (funcId == abi.functionId(ITokenRoot.notifyBurn)) {
            uint32 seqno = body.load(uint32);
            optional(uint256) pending = pendingBurns.fetch(seqno);
            if (pending.hasValue()) {
                balance += pending.get();
                delete pendingBurns[seqno];
            }
        }

        // Se receiveTokens bounceou em outra wallet, restaurar balance
        // receiveTokens(uint32 nonce, uint256 amount) — nonce is first param (32 bits fits!)
        if (funcId == abi.functionId(ITokenWallet.receiveTokens)) {
            // Read the nonce from bounce body (uint32 = 32 bits, fits in remaining 224 bits)
            uint32 nonce = body.load(uint32);
            optional(uint256) pending = pendingTransfers.fetch(nonce);
            if (pending.hasValue()) {
                balance += pending.get();
                delete pendingTransfers[nonce];
            }
        }
    }
}
