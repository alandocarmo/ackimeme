pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./Interfaces.sol";

contract BondingCurve {
    // ─── Constants ────────────────────────────────────────────────────────────
    uint128 public constant MIGRATION_THRESHOLD = 69_000 ton; // 69,000 SHELL in nano
    uint32 public constant LOCK_PERIOD = 30 days;
    // R-03: Removed `bytes public constant DAPP_ID` — dynamic bytes cannot be constant
    // in TVM-Solidity (only value types: int, bool, address, bytesN). Not used in any function.
    uint256 public constant MAX_BUY_PER_TX = 50_000_000 * 1e9;
    uint256 public constant TOTAL_SUPPLY_CAP = 1_000_000_000 * 1e9; // 1 billion tokens

    // ─── C-02: ECC token IDs for Acki Nacki ecosystem ─────────────────────────
    // V-AM-01: Explicit ID constants prevent confusion attacks across the
    // NACKL/SHELL/USDC token ecosystem. Only SHELL (ID=2) is valid payment.
    uint32 public constant NACKL_CURRENCY_ID = 1;   // Staking & store of value
    uint32 public constant SHELL_CURRENCY_ID = 2;    // Utility token (gas, fees) — ACCEPTED
    uint32 public constant USDC_CURRENCY_ID  = 3;    // Stablecoin
    uint256 private constant MAX_UINT128 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF; // 2^128 - 1

    // ─── R-04: Static vars MUST precede all state vars ───────────────────────
    address static public _tokenRoot;    // unique per deploy — makes each BondingCurve address distinct

    // ─── State ────────────────────────────────────────────────────────────────
    uint256 public reserveBalance;       // tracked SHELL balance (nano)
    uint256 public totalSupply;
    bool public isAmm;                   // true after reaching threshold (x*y=k internal pool)
    uint256 public ammKLast;             // AMM invariant
    uint32 public migratedAt;            // timestamp of migration
    address public owner;                // token creator
    // NOTE: tokenRoot removed — use _tokenRoot (static) everywhere for consistency.
    // _tokenRoot is set via stateInit and never changes, making it the canonical reference.
    string public name;
    string public symbol;

    bytes public creationFeeTxHash;

    // ─── R-05: Dual mappings for correct onBounce rollback ───────────────────
    // When ITokenRoot.mint bounces, msg.sender = tokenRoot (not the buyer).
    // We track the last buyer separately so onBounce can resolve who to refund.
    mapping(uint32 => uint256) public pendingReserveByNonce;  // nonce → SHELL cost
    mapping(uint32 => uint256) public pendingTokensByNonce;   // nonce → token amount
    
    mapping(uint32 => address) public mintIdToBuyer; // mapping to resolve bounce exact buyer
    uint32 private _mintSeqno = 1;

    // ─── Events ───────────────────────────────────────────────────────────────
    event TokensPurchaseInitiated(address buyer, uint256 shellIn, uint256 tokensOut, uint128 newPrice);
    event TokensSold(address seller, uint256 tokensIn, uint256 shellOut, uint128 newPrice);
    event MigratedToInternalAmm(uint128 liquidity, uint32 timestamp);

    // ─── Constructor ──────────────────────────────────────────────────────────
    // BondingCurve is deployed via internal message from TokenRoot.
    // msg.sender == address(TokenRoot) == _tokenRoot (stateInit static var).
    constructor(
        address _owner,
        address _tokenRootAddr,
        string _name,
        string _symbol,
        bytes _creationFeeTxHash
    ) {
        require(msg.sender == _tokenRoot, 101, "Only TokenRoot can deploy BondingCurve");
        require(_tokenRootAddr == _tokenRoot, 104, "tokenRootAddr must match static _tokenRoot");

        owner = _owner;
        // _tokenRoot is the canonical reference — no separate tokenRoot variable needed
        name = _name;
        symbol = _symbol;
        creationFeeTxHash = _creationFeeTxHash;
        isAmm = false;
    }



    // ─── A-04: Price & Mathematics (adjusted base for meme economy) ──────────
    // Base price: 0.000001 SHELL per token-unit (= 1_000 nanotokens)
    // This allows ~69M tokens to be sold before migration at 69K SHELL threshold,
    // creating a pump.fun-style economy where early buyers get massive upside.
    function currentPrice() public view returns (uint128) {
        uint256 base = 1_000; // 0.000001 SHELL per token unit (nano)
        uint256 slope = totalSupply / 4_000_000_000_000;
        return uint128(base + slope);
    }

    function getBuyPrice(uint256 tokenAmount) public view returns (uint128) {
        if (isAmm) {
            uint256 tokenPool = TOTAL_SUPPLY_CAP - totalSupply;
            require(tokenPool > tokenAmount, 215, "Not enough AMM liquidity");
            uint256 newReserve = ammKLast / (tokenPool - tokenAmount);
            return uint128(newReserve - reserveBalance);
        }
        uint256 base = 1_000; // 0.000001 SHELL base
        uint256 p1 = base + (totalSupply / 4_000_000_000_000);
        uint256 p2 = base + ((totalSupply + tokenAmount) / 4_000_000_000_000);
        uint256 avgPrice = (p1 + p2) / 2;
        require(tokenAmount == 0 || avgPrice <= MAX_UINT128 / tokenAmount, 209, "Overflow detectado");
        return uint128((avgPrice * tokenAmount) / 1e9);
    }

    function getSellReturn(uint256 tokenAmount) public view returns (uint128) {
        if (totalSupply == 0 || tokenAmount > totalSupply) return 0;
        if (isAmm) {
            uint256 tokenPool = TOTAL_SUPPLY_CAP - totalSupply;
            uint256 newReserve = ammKLast / (tokenPool + tokenAmount);
            return uint128(reserveBalance - newReserve);
        }
        uint256 base = 1_000;
        uint256 p1 = base + ((totalSupply - tokenAmount) / 4_000_000_000_000);
        uint256 p2 = base + (totalSupply / 4_000_000_000_000);
        uint256 avgPrice = (p1 + p2) / 2;
        return uint128((avgPrice * tokenAmount) / 1e9);
    }

    // ─── Configuration ───────────────────────────────────────────────────────
    // Fix: auth via msg.sender == owner (internal message from owner's wallet)
    // instead of msg.pubkey() which only works for external messages.
    // Browser wallets (EVER Wallet, etc.) send internal messages where msg.pubkey() == 0.
    function forceAmmMigration() public {
        require(msg.sender == owner, 102, "Only owner can force AMM");
        require(reserveBalance >= MIGRATION_THRESHOLD, 108, "Threshold not reached");
        require(!isAmm, 109, "Already migrated to AMM");
        _migrateToAmm();
    }

    // ─── C-02: Buy via msg.currencies[2] (SHELL ECC cross-DappID) ────────────
    // Users send SHELL as Extra Currency (cc[2]) in internal messages.
    // This works both intra-DappID and cross-DappID, enabling universal composability.
    // msg.value (VMSHELL) is used ONLY for gas, not as payment.
    function buy(uint256 tokenAmount, uint256 maxShellIn) public {

        // A-09: Ensure caller sent enough VMSHELL for gas (mint + refund)
        require(msg.value >= 0.2 ton, 213, "Insufficient VMSHELL gas. Send at least 0.2 VMSHELL as msg.value");

        // V-AM-01: Reject transactions that accidentally/maliciously include NACKL or USDC
        // instead of SHELL. Without this check, a confusion attack could credit the
        // buyer with tokens while the BondingCurve receives the wrong ECC currency.
        require(uint256(msg.currencies[NACKL_CURRENCY_ID]) == 0, 217, "NACKL not accepted. Send SHELL (ECC ID=2)");
        require(uint256(msg.currencies[USDC_CURRENCY_ID]) == 0, 218, "USDC not accepted. Send SHELL (ECC ID=2)");

        // Note: internal AMM means trading continues normally on this same contract!
        require(tokenAmount > 0, 202, "Amount must be greater than zero");
        require(tokenAmount <= MAX_BUY_PER_TX, 205, "Amount exceeds max buy limit");
        require(totalSupply + tokenAmount <= TOTAL_SUPPLY_CAP, 206, "Exceeds total supply cap");

        // C-02: Read SHELL payment from Extra Currencies map (cc[2])
        // This is the canonical cross-DappID payment method in Acki Nacki.
        // Unlike msg.value (VMSHELL), cc tokens are NOT zeroed across DappIDs.
        varuint32 shellReceived = msg.currencies[SHELL_CURRENCY_ID];
        uint256 receivedShell = uint256(shellReceived);

        uint256 cost = getBuyPrice(tokenAmount);
        require(cost > 0, 211, "Purchase amount too small, cost rounds to zero");
        require(cost <= maxShellIn, 208, "Slippage protection triggered: cost exceeds maxShellIn");
        require(receivedShell >= cost, 203, "Insufficient SHELL sent for purchase");

        // Update state
        totalSupply += tokenAmount;
        reserveBalance += cost;

        uint32 nonce = ++_mintSeqno;
        mintIdToBuyer[nonce] = msg.sender;
        pendingReserveByNonce[nonce] = cost;
        pendingTokensByNonce[nonce] = tokenAmount;

        emit TokensPurchaseInitiated(msg.sender, cost, tokenAmount, currentPrice());

        // Mint memecoins to buyer via internal message
        ITokenRoot(_tokenRoot).mint(nonce, msg.sender, tokenAmount, 0.1 ton); // sends 0.1 VMSHELL for wallet deployment

        // Refund excess SHELL (Extra Currency) back to buyer
        uint256 excess = receivedShell > cost ? receivedShell - cost : 0;
        if (excess > 0) {
            // Build currency map with refund amount for cc[2]
            mapping(uint32 => varuint32) refundCurrencies;
            refundCurrencies[SHELL_CURRENCY_ID] = varuint32(excess);
            msg.sender.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: refundCurrencies });
        }

        // Check if we reached the migration threshold and aren't AMM yet
        if (reserveBalance >= MIGRATION_THRESHOLD && !isAmm) {
            _migrateToAmm();
        }
    }

    // ─── Receiver for async burns (Sell) ─────────────────────────────────────
    // Called by TokenRoot after TokenWallet burns tokens
    function onTokenBurned(uint32 burnNonce, uint256 amount, address refundAddress) external {
        require(msg.sender == _tokenRoot, 103, "Only TokenRoot can notify burn");
        // Removed the "if (migrated)" block since AMM transition allows users
        // to continue trading organically on this internal contract.
        // It calculates returns via getSellReturn using x*y=k formula.

        uint256 returnAmount = getSellReturn(amount);
        // Audit #8: Prevent silent zero-return sells where user burns tokens and gets nothing
        require(returnAmount > 0, 216, "Sell amount too small, return rounds to zero");
        require(reserveBalance >= returnAmount, 204, "Insufficient reserve for sell");

        totalSupply -= amount;
        reserveBalance -= returnAmount;

        emit TokensSold(refundAddress, amount, returnAmount, currentPrice());

        // Send SHELL payout via Extra Currencies (cc[2]) for cross-DappID compatibility
        tvm.rawReserve(0.5 ton, 0); // Keep 0.5 VMSHELL for contract survival

        mapping(uint32 => varuint32) payoutCurrencies;
        payoutCurrencies[SHELL_CURRENCY_ID] = varuint32(returnAmount);
        refundAddress.transfer({ value: 0, flag: 128, bounce: false, currencies: payoutCurrencies });
    }

    // ─── AMM Migration ───────────────────────────────────────────────────────
    function _migrateToAmm() private {
        uint128 liquidityToMove = uint128(reserveBalance);
        require(TOTAL_SUPPLY_CAP - totalSupply <= MAX_UINT128, 210, "tokensToMove overflow");

        isAmm = true;
        migratedAt = uint32(block.timestamp);
        
        // Setup initial x*y=k invariant
        ammKLast = reserveBalance * (TOTAL_SUPPLY_CAP - totalSupply);
        
        emit MigratedToInternalAmm(liquidityToMove, migratedAt);
    }

    // ─── R-05: onBounce handler (corrected) ───────────────────────────────────
    // When ITokenRoot.mint bounces, msg.sender = address(tokenRoot), NOT the buyer.
    // We use _lastBuyer to resolve who to refund. This is safe because TVM processes
    // messages sequentially — there cannot be a concurrent buy between mint and bounce.
    onBounce(TvmSlice body) external {
        // SEC-2: Ensure the bounce actually came from our TokenRoot
        require(msg.sender == tokenRoot, 150, "Bounce not from tokenRoot");
        
        uint32 funcId = body.load(uint32);
        
        if (funcId == abi.functionId(ITokenRoot.mint)) {
            uint32 nonce = body.load(uint32);
            address buyer = mintIdToBuyer[nonce];
            
            uint256 refundShell = pendingReserveByNonce[nonce];
            uint256 refundTokens = pendingTokensByNonce[nonce];
            
            if (refundShell > 0 && buyer != address(0)) {
                // Revert reserve and supply
                reserveBalance -= refundShell;
                totalSupply -= refundTokens;

                // A-11: If reversal drops reserve below migration threshold,
                // rollback AMM state to prevent corrupted x*y=k invariant
                if (isAmm && reserveBalance < MIGRATION_THRESHOLD) {
                    isAmm = false;
                    ammKLast = 0;
                    migratedAt = 0;
                } else if (isAmm) {
                    // Recalculate AMM invariant with corrected values
                    ammKLast = reserveBalance * (TOTAL_SUPPLY_CAP - totalSupply);
                }

                // Refund SHELL via cc[2] to the actual buyer
                mapping(uint32 => varuint32) refundCurrencies;
                refundCurrencies[SHELL_CURRENCY_ID] = varuint32(refundShell);
                buyer.transfer({value: 0.05 ton, flag: 1, bounce: false, currencies: refundCurrencies});
            }
            delete pendingReserveByNonce[nonce];
            delete pendingTokensByNonce[nonce];
            delete mintIdToBuyer[nonce];
        }
    }
}
