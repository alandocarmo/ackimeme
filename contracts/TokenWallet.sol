pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./Interfaces.sol";

contract TokenWallet is ITokenWallet {
    address static public root;
    address static public owner;

    uint64 private constant GAS_TOP_UP = 2_000_000_000; // 2 VMSHELL in nano
    uint128 private constant MIN_EXECUTION_GAS = 1 ton;
    
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
        if (address(this).balance > MIN_EXECUTION_GAS) {
            return;
        }
        gosh.mintshell(GAS_TOP_UP);
    }

    // Fix #8: Removido tvm.accept() de receiveTokens — é mensagem interna do root
    function receiveTokens(uint32 nonce, uint256 amount) external override {
        // Na Acki Nacki, mensagens internas do root carregam seu próprio gas
        require(msg.sender == root, 102, "Only root can mint tokens into wallet");
        // tvm.accept() REMOVIDO — não chamar em mensagem interna
        _getTokens(); // N3

        balance += amount;
        ITokenRoot(root).onMintDelivered{value: 0, flag: 64, bounce: false}(nonce);
    }

    function receiveTransfer(uint32 nonce, uint256 amount) external override {
        require(msg.sender == root, 108, "Only root can deliver transfers");
        _getTokens();

        balance += amount;
        ITokenRoot(root).onTransferDelivered{value: 0, flag: 64, bounce: false}(nonce);
    }

    function transfer(address recipientOwner, uint256 amount) public {
        require(msg.sender == owner, 103, "Only owner can transfer");
        require(balance >= amount, 104, "Insufficient balance");
        require(recipientOwner != address(0), 108, "Recipient cannot be zero address");
        // M-08: Ensure the internal message carries gas instead of spending the wallet's own balance.
        // Dapp-subsidized cross-shard calls without msg.value will rely on the global DappConfig.
        require(msg.value >= 0.1 ton, 107, "Insufficient execution gas provided in the message");
        _getTokens(); // N3 - keep Dapp auto-replenishment intact
        
        // Track: guardar transferência pendente antes de debitar
        uint32 seqno = _transferSeqno++;
        pendingTransfers[seqno] = amount;
        balance -= amount;

        // Route through TokenRoot so the recipient wallet can authenticate the
        // transfer source and so wallet deployment uses the canonical stateInit.
        ITokenRoot(root).transferFromWallet{value: 0, flag: 64}(seqno, owner, recipientOwner, amount);
    }

    // ─── Security Fix: Burn functionality (Async Callback Pattern) ───────────
    function burn(uint256 amount, address callbackTarget) public {
        require(msg.sender == owner, 105, "Only owner can burn tokens");
        require(balance >= amount, 104, "Insufficient balance to burn");
        // M-08: Ensure the internal message carries gas instead of spending the wallet's own balance.
        require(msg.value >= 0.1 ton, 107, "Insufficient execution gas provided in the message");
        _getTokens(); // N3 - keep Dapp auto-replenishment intact
        
        // Track: guardar burn pendente antes de debitar
        uint32 seqno = _burnSeqno++;
        pendingBurns[seqno] = amount;
        balance -= amount;
        
        // Repassa a execução para o TokenRoot informando a quantia deletada e quem deve ser reembolsado
        ITokenRoot(root).notifyBurn{value: 0, flag: 64}(seqno, amount, owner, callbackTarget);
    }

    function onTransferDelivered(uint32 seqno) external override {
        require(msg.sender == root, 106, "Only root can confirm transfer");
        delete pendingTransfers[seqno];
    }

    function onTransferFailed(uint32 seqno) external override {
        require(msg.sender == root, 106, "Only root can report transfer failure");
        optional(uint256) pending = pendingTransfers.fetch(seqno);
        if (pending.hasValue()) {
            balance += pending.get();
            delete pendingTransfers[seqno];
        }
    }

    function onBurnFailed(uint32 seqno) external override {
        require(msg.sender == root, 106, "Only root can report burn failure");
        optional(uint256) pending = pendingBurns.fetch(seqno);
        if (pending.hasValue()) {
            balance += pending.get();
            delete pendingBurns[seqno];
        }
    }

    // ─── Audit #6: onBounce handler — read nonce from bounce body for exact rollback ──
    // Previous implementation used _burnSeqno-1 / _transferSeqno-1 which fails
    // when multiple operations are pending (wrong amount restored).
    // Bounce body has 224 bits after funcId. uint32 nonce (32 bits) fits safely.
    onBounce(TvmSlice body) external {
        if (body.bits() < 32) {
            return;
        }
        uint32 funcId = body.load(uint32);

        // N8 FIX: notifyBurn now has uint32 seqno as first param, so it fits in 32 bits
        // and we can read it to exactly restore the correct amount.
        if (funcId == abi.functionId(ITokenRoot.notifyBurn)) {
            if (body.bits() < 32) {
                return;
            }
            uint32 seqno = body.load(uint32);
            optional(uint256) pending = pendingBurns.fetch(seqno);
            if (pending.hasValue()) {
                balance += pending.get();
                delete pendingBurns[seqno];
            }
        }

        if (funcId == abi.functionId(ITokenRoot.transferFromWallet)) {
            if (body.bits() < 32) {
                return;
            }
            uint32 nonce = body.load(uint32);
            optional(uint256) pending = pendingTransfers.fetch(nonce);
            if (pending.hasValue()) {
                balance += pending.get();
                delete pendingTransfers[nonce];
            }
        }
    }
}
