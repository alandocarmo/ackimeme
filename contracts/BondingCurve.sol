pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./Interfaces.sol";

contract BondingCurve {
    // ─── Constants ────────────────────────────────────────────────────────────
    // H-05: In TVM-Solidity, `ton` = 10^9 nanotons. So 15_000 ton = 15_000 * 10^9 = 15T nano.
    // This represents 15,000 SHELL in nano-units (SHELL uses 9 decimals like VMSHELL).
    uint128 public constant MIGRATION_THRESHOLD_SHELL_NANO = 15_000 * 1e9;
    uint32 public constant LOCK_PERIOD = 30 days;
    // R-03: Removed `bytes public constant DAPP_ID` — dynamic bytes cannot be constant
    // in TVM-Solidity (only value types: int, bool, address, bytesN). Not used in any function.
    uint256 public constant ABSOLUTE_MAX_BUY_PER_TX = 50_000_000 * 1e9;
    uint16 public constant MAX_BUY_PER_TX_BPS = 500; // 5% of this launch's supply cap
    uint64 private constant GAS_TOP_UP = 2_000_000_000; // 2 VMSHELL in nano
    uint128 private constant MIN_EXECUTION_GAS = 1 ton;

    // ─── Trade Fee Constants ──────────────────────────────────────────────────
    // Fee is charged on every buy and sell trade.
    // 1% before AMM migration (0.8% platform, 0.2% burn).
    // 0.5% after AMM migration (0.4% platform, 0.1% burn).
    // L-01: Note — this contract only accepts SHELL (ECC ID=2). USDC is not accepted here.
    // The Accumulator rate (100 SHELL = 1 USDC) is referenced only for off-chain pricing context.
    function getTradeFeeBps() public view returns (uint16) { return isAmm ? 50 : 100; }
    function getPlatformFeeBps() public view returns (uint16) { return isAmm ? 40 : 80; }
    function getBurnFeeBps() public view returns (uint16) { return isAmm ? 10 : 20; }

    // ─── C-02: ECC token IDs for Acki Nacki ecosystem ─────────────────────────
    // V-AM-01: Explicit ID constants prevent confusion attacks across the
    // NACKL/SHELL/USDC token ecosystem. Only SHELL (ID=2) is valid payment.
    uint32 public constant NACKL_CURRENCY_ID = 1;   // Staking & store of value
    uint32 public constant SHELL_CURRENCY_ID = 2;    // Utility token (gas, fees) — ACCEPTED
    uint32 public constant USDC_CURRENCY_ID  = 3;    // Stablecoin
    uint256 private constant MAX_UINT128 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF; // 2^128 - 1

    // ─── R-04: Static vars MUST precede all state vars ───────────────────────
    address static public _tokenRoot;    // unique per deploy — makes each BondingCurve address distinct
    uint256 static public _supplyCap;    // max token supply for this launch, in nano-token units

    // ─── State ────────────────────────────────────────────────────────────────
    uint256 public reserveBalance;       // tracked SHELL balance (nano)
    uint256 public totalSupply;
    bool public isAmm;                   // true after reaching threshold (x*y=k internal pool)
    uint256 public ammKLast;             // AMM invariant
    uint32 public migratedAt;            // timestamp of migration
    address public owner;                // token creator
    address public feeRecipient;         // platform fee wallet (receives 0.8% of each trade)
    bool public paused;                  // security pause for trading
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
    
    // A-13: Pump Forever mode (no AMM migration)
    bool public pumpForever;

    mapping(uint32 => address) public mintIdToBuyer; // mapping to resolve bounce exact buyer
    uint32 private _mintSeqno = 1;

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier whenNotPaused() {
        require(!paused, 110, "Trading is temporarily paused for security");
        _;
    }

    // ─── Events ───────────────────────────────────────────────────────────────
    event TokensPurchaseInitiated(address buyer, uint256 shellIn, uint256 tokensOut, uint128 newPrice);
    event TokensSold(address seller, uint256 tokensIn, uint256 shellOut, uint128 newPrice);
    event MigratedToInternalAmm(uint128 liquidity, uint32 timestamp);
    event FeeReduced(uint16 newTradeFeeBps);

    // ─── Constructor ──────────────────────────────────────────────────────────
    // BondingCurve is deployed via internal message from TokenRoot.
    // msg.sender == address(TokenRoot) == _tokenRoot (stateInit static var).
    constructor(
        address _owner,
        address _tokenRootAddr,
        string _name,
        string _symbol,
        bytes _creationFeeTxHash,
        address _feeRecipient,
        bool _pumpForever
    ) {
        require(msg.sender == _tokenRoot, 101, "Only TokenRoot can deploy BondingCurve");
        require(_tokenRootAddr == _tokenRoot, 104, "tokenRootAddr must match static _tokenRoot");
        require(_supplyCap > 0, 105, "Supply cap must be set");
        require(_feeRecipient != address(0), 106, "Fee recipient cannot be zero address");

        tvm.accept(); // Accept VMSHELL from TokenRoot's internal message deployment
        owner = _owner;
        feeRecipient = _feeRecipient;
        // _tokenRoot is the canonical reference — no separate tokenRoot variable needed
        name = _name;
        symbol = _symbol;
        creationFeeTxHash = _creationFeeTxHash;
        pumpForever = _pumpForever;
        isAmm = false;
    }



    // ─── A-04: Price & Mathematics (adjusted base for meme economy) ──────────
    // Base price: 0.000001 SHELL per token-unit (= 1_000 nanotokens)
    // This allows ~15M tokens to be sold before migration at 15K SHELL threshold,
    // creating a pump.fun-style economy where early buyers get massive upside.
    function currentPrice() public view returns (uint128) {
        if (isAmm) {
            uint256 tokenPool = _supplyCap - totalSupply;
            if (tokenPool == 0) return 0;
            return uint128((reserveBalance * 1e9) / tokenPool);
        }
        uint256 base = 1_000; // 0.000001 SHELL per token unit (nano)
        uint256 slope = totalSupply / 10_000_000_000_000;
        return uint128(base + slope);
    }

    function getBuyPrice(uint256 tokenAmount) public view returns (uint128) {
        if (isAmm) {
            uint256 tokenPool = _supplyCap - totalSupply;
            require(ammKLast > 0, 219, "AMM invariant is zero - pool corrupted");
            require(tokenPool > tokenAmount + 1, 215, "Not enough AMM liquidity");
            uint256 newReserve = ammKLast / (tokenPool - tokenAmount);
            return uint128(newReserve - reserveBalance);
        }
        uint256 base = 1_000; // 0.000001 SHELL base
        uint256 p1 = base + (totalSupply / 10_000_000_000_000);
        uint256 p2 = base + ((totalSupply + tokenAmount) / 10_000_000_000_000);
        uint256 avgPrice = (p1 + p2) / 2;
        require(tokenAmount == 0 || avgPrice <= MAX_UINT128 / tokenAmount, 209, "Overflow detectado");
        return uint128((avgPrice * tokenAmount) / 1e9);
    }

    function getSellReturn(uint256 tokenAmount) public view returns (uint128) {
        if (totalSupply == 0 || tokenAmount > totalSupply) return 0;
        if (isAmm) {
            uint256 tokenPool = _supplyCap - totalSupply;
            require(ammKLast > 0, 219, "AMM invariant is zero - pool corrupted");
            require(tokenPool > tokenAmount + 1, 215, "Not enough AMM liquidity");
            uint256 newReserve = ammKLast / (tokenPool + tokenAmount);
            // C-02: Prevent underflow when sell amount is too large for current reserve
            require(reserveBalance >= newReserve, 220, "Sell too large for current reserve");
            return uint128(reserveBalance - newReserve);
        }
        uint256 base = 1_000;
        uint256 p1 = base + ((totalSupply - tokenAmount) / 10_000_000_000_000);
        uint256 p2 = base + (totalSupply / 10_000_000_000_000);
        uint256 avgPrice = (p1 + p2) / 2;
        return uint128((avgPrice * tokenAmount) / 1e9);
    }

    function maxBuyPerTx() public view returns (uint256) {
        uint256 capBasedLimit = (_supplyCap * MAX_BUY_PER_TX_BPS) / 10_000;
        if (capBasedLimit == 0) {
            return 1;
        }
        return capBasedLimit < ABSOLUTE_MAX_BUY_PER_TX ? capBasedLimit : ABSOLUTE_MAX_BUY_PER_TX;
    }

    function maxSellPerTx() public view returns (uint256) {
        return maxBuyPerTx();
    }

    // ─── Fee Views ────────────────────────────────────────────────────────────
    /// @notice Returns the total trade fee for a given base amount.
    function getTradeFee(uint256 baseAmount) public view returns (uint256) {
        return baseAmount * getTradeFeeBps() / 10000;
    }

    /// @notice Returns the buy cost INCLUDING the fee for a given token amount.
    function getBuyPriceWithFee(uint256 tokenAmount) public view returns (uint128 baseCost, uint128 fee, uint128 total) {
        baseCost = getBuyPrice(tokenAmount);
        fee = uint128(uint256(baseCost) * getTradeFeeBps() / 10000);
        total = baseCost + fee;
    }

    /// @notice Returns the sell return AFTER deducting the fee.
    function getSellReturnAfterFee(uint256 tokenAmount) public view returns (uint128 grossReturn, uint128 fee, uint128 netReturn) {
        grossReturn = uint128(getSellReturn(tokenAmount));
        fee = uint128(uint256(grossReturn) * getTradeFeeBps() / 10000);
        netReturn = grossReturn - fee;
    }

    // ─── Configuration ───────────────────────────────────────────────────────
    // Fix: auth via msg.sender == owner (internal message from owner's wallet)
    // instead of msg.pubkey() which only works for external messages.
    // Browser wallets (EVER Wallet, etc.) send internal messages where msg.pubkey() == 0.
    // C-01: Removed tvm.accept() — this is an internal message function (msg.sender check).
    // H-02: Added whenNotPaused — platform can halt migration during emergencies.
    function forceAmmMigration() public whenNotPaused {
        require(msg.sender == owner, 102, "Only owner can force AMM");
        require(!pumpForever, 114, "Pump Forever mode is active");
        require(reserveBalance >= MIGRATION_THRESHOLD_SHELL_NANO, 108, "Threshold not reached");
        require(!isAmm, 109, "Already migrated to AMM");
        _ensureExecutionGas();
        _migrateToAmm();
    }

    function _ensureExecutionGas() private {
        if (address(this).balance > MIN_EXECUTION_GAS) {
            return;
        }
        gosh.mintshell(GAS_TOP_UP);
    }

    // ─── C-02: Buy via msg.currencies[2] (SHELL ECC cross-DappID) ────────────
    // Users send SHELL as Extra Currency (cc[2]) in internal messages.
    // This works both intra-DappID and cross-DappID, enabling universal composability.
    // msg.value (VMSHELL) is used ONLY for gas, not as payment.
    // Trade fee: 1% total (0.8% platform + 0.2% burn locked in contract).
    function buy(uint256 tokenAmount, uint256 maxShellIn) public whenNotPaused {
        _ensureExecutionGas();
        // V-AM-01: Reject transactions that accidentally/maliciously include NACKL or USDC
        // instead of SHELL. Without this check, a confusion attack could credit the
        // buyer with tokens while the BondingCurve receives the wrong ECC currency.
        require(uint256(msg.currencies[NACKL_CURRENCY_ID]) == 0, 217, "NACKL not accepted. Send SHELL (ECC ID=2)");
        require(uint256(msg.currencies[USDC_CURRENCY_ID]) == 0, 218, "USDC not accepted. Send SHELL (ECC ID=2)");

        // Note: internal AMM means trading continues normally on this same contract!
        require(tokenAmount > 0, 202, "Amount must be greater than zero");
        require(tokenAmount <= maxBuyPerTx(), 205, "Amount exceeds max buy limit");
        require(totalSupply + tokenAmount <= _supplyCap, 206, "Exceeds total supply cap");

        // C-02: Read SHELL payment from Extra Currencies map (cc[2])
        // This is the canonical cross-DappID payment method in Acki Nacki.
        // Unlike msg.value (VMSHELL), cc tokens are NOT zeroed across DappIDs.
        varuint32 shellReceived = msg.currencies[SHELL_CURRENCY_ID];
        uint256 receivedShell = uint256(shellReceived);

        uint256 cost = getBuyPrice(tokenAmount);
        require(cost > 0, 211, "Purchase amount too small, cost rounds to zero");

        // ─── Trade Fee: Platform + Burn ─────────────────────────────────────────
        uint256 platformFee = cost * getPlatformFeeBps() / 10000;
        uint256 burnFee = cost * getBurnFeeBps() / 10000;
        uint256 totalCostWithFee = cost + platformFee + burnFee;

        require(totalCostWithFee <= maxShellIn, 208, "Slippage protection triggered: cost+fee exceeds maxShellIn");
        require(receivedShell >= totalCostWithFee, 203, "Insufficient SHELL sent (cost + 1% fee)");

        // Cross-Dapp calls arrive with msg.value/VMSHELL zeroed by the protocol.
        // After validating the paid SHELL ECC amount, the Dapp pays execution gas.
        tvm.accept();
        require(address(this).balance >= 0.2 ton, 213, "BondingCurve VMSHELL reserve unavailable");

        // Update state — only base cost goes to reserve (fee is separate)
        totalSupply += tokenAmount;
        reserveBalance += cost;

        uint32 nonce = ++_mintSeqno;
        mintIdToBuyer[nonce] = msg.sender;
        pendingReserveByNonce[nonce] = cost;
        pendingTokensByNonce[nonce] = tokenAmount;

        emit TokensPurchaseInitiated(msg.sender, cost, tokenAmount, currentPrice());

        // Mint memecoins to buyer via internal message
        ITokenRoot(_tokenRoot).mint(nonce, msg.sender, tokenAmount, 0.1 ton); // sends 0.1 VMSHELL for wallet deployment

        // Send platform fee (0.8%) to feeRecipient via cc[2]
        if (platformFee > 0) {
            mapping(uint32 => varuint32) feeCurrencies;
            feeCurrencies[SHELL_CURRENCY_ID] = varuint32(platformFee);
            feeRecipient.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: feeCurrencies });
        }
        // Burn fee (0.2%) stays locked in this contract — effectively out of circulation

        // Refund excess SHELL (Extra Currency) back to buyer
        uint256 excess = receivedShell > totalCostWithFee ? receivedShell - totalCostWithFee : 0;
        if (excess > 0) {
            // Build currency map with refund amount for cc[2]
            mapping(uint32 => varuint32) refundCurrencies;
            refundCurrencies[SHELL_CURRENCY_ID] = varuint32(excess);
            msg.sender.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: refundCurrencies });
        }

        // Check if we reached the migration threshold and aren't AMM yet
        if (!pumpForever && reserveBalance >= MIGRATION_THRESHOLD_SHELL_NANO && !isAmm) {
            _migrateToAmm();
        }
    }

    // ─── Receiver for async burns (Sell) ─────────────────────────────────────
    // Called by TokenRoot after TokenWallet burns tokens.
    // Trade fee: 1% total (0.8% platform + 0.2% burn locked in contract).
    function onTokenBurned(uint32 burnNonce, uint256 amount, address refundAddress) external whenNotPaused {
        _ensureExecutionGas();
        require(msg.sender == _tokenRoot, 103, "Only TokenRoot can notify burn");
        // C-03: Ensure sufficient gas for fee transfer + payout execution
        require(msg.value >= 0.3 ton, 221, "Insufficient gas for sell execution");
        require(amount <= maxSellPerTx(), 222, "Amount exceeds max sell limit");
        // Removed the "if (migrated)" block since AMM transition allows users
        // to continue trading organically on this internal contract.
        // It calculates returns via getSellReturn using x*y=k formula.

        uint256 grossReturn = getSellReturn(amount);
        // Audit #8: Prevent silent zero-return sells where user burns tokens and gets nothing
        require(grossReturn > 0, 216, "Sell amount too small, return rounds to zero");
        require(reserveBalance >= grossReturn, 204, "Insufficient reserve for sell");

        // ─── Trade Fee: Platform + Burn ─────────────────────────────────────────
        uint256 platformFee = grossReturn * getPlatformFeeBps() / 10000;
        uint256 burnFee = grossReturn * getBurnFeeBps() / 10000;
        uint256 netReturn = grossReturn - platformFee - burnFee;

        totalSupply -= amount;
        reserveBalance -= grossReturn;

        emit TokensSold(refundAddress, amount, netReturn, currentPrice());

        // Send platform fee (0.8%) to feeRecipient via cc[2]
        if (platformFee > 0) {
            mapping(uint32 => varuint32) feeCurrencies;
            feeCurrencies[SHELL_CURRENCY_ID] = varuint32(platformFee);
            feeRecipient.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: feeCurrencies });
        }
        // Burn fee (0.2%) stays locked in this contract — effectively out of circulation

        // Send net SHELL payout via Extra Currencies (cc[2]) for cross-DappID compatibility
        tvm.rawReserve(0.5 ton, 0); // Keep 0.5 VMSHELL for contract survival

        mapping(uint32 => varuint32) payoutCurrencies;
        payoutCurrencies[SHELL_CURRENCY_ID] = varuint32(netReturn);
        refundAddress.transfer({ value: 0, flag: 128, bounce: false, currencies: payoutCurrencies });
    }

    // Called by TokenRoot when wallet deployment or receiveTokens fails after
    // TokenRoot.mint has already accepted the mint request.
    function onMintFailed(uint32 mintNonce) external {
        require(msg.sender == _tokenRoot, 151, "Only TokenRoot can report mint failure");
        _rollbackMint(mintNonce);
    }

    // Called by TokenRoot after the target TokenWallet accepted receiveTokens().
    // This is the positive async counterpart to onMintFailed/onBounce and prevents
    // permanent growth of pending mint storage on every successful buy.
    function onMintSuccess(uint32 mintNonce) external {
        require(msg.sender == _tokenRoot, 152, "Only TokenRoot can confirm mint success");
        _clearMint(mintNonce);
    }

    // ─── AMM Migration ───────────────────────────────────────────────────────
    function _migrateToAmm() private {
        uint128 liquidityToMove = uint128(reserveBalance);
        require(_supplyCap - totalSupply <= MAX_UINT128, 210, "tokensToMove overflow");

        isAmm = true;
        migratedAt = uint32(block.timestamp);
        
        // Setup initial x*y=k invariant
        ammKLast = reserveBalance * (_supplyCap - totalSupply);
        
        emit MigratedToInternalAmm(liquidityToMove, migratedAt);
        emit FeeReduced(getTradeFeeBps());
    }

    function _rollbackMint(uint32 nonce) private {
        address buyer = mintIdToBuyer[nonce];

        uint256 refundShell = pendingReserveByNonce[nonce];
        uint256 refundTokens = pendingTokensByNonce[nonce];

        if (refundShell > 0 && buyer != address(0)) {
            // Revert reserve and supply
            reserveBalance -= refundShell;
            totalSupply -= refundTokens;

            // A-11: If reversal drops reserve below migration threshold,
            // rollback AMM state to prevent corrupted x*y=k invariant
            if (isAmm && reserveBalance < MIGRATION_THRESHOLD_SHELL_NANO) {
                isAmm = false;
                ammKLast = 0;
                migratedAt = 0;
            } else if (isAmm) {
                // Recalculate AMM invariant with corrected values
                ammKLast = reserveBalance * (_supplyCap - totalSupply);
            }

            // Refund SHELL via cc[2] to the actual buyer
            mapping(uint32 => varuint32) refundCurrencies;
            refundCurrencies[SHELL_CURRENCY_ID] = varuint32(refundShell);
            buyer.transfer({value: 0.05 ton, flag: 1, bounce: false, currencies: refundCurrencies});
        }

        _clearMint(nonce);
    }

    function _clearMint(uint32 nonce) private {
        delete pendingReserveByNonce[nonce];
        delete pendingTokensByNonce[nonce];
        delete mintIdToBuyer[nonce];
    }

    // ─── R-05: onBounce handler (corrected) ───────────────────────────────────
    // Direct bounce from ITokenRoot.mint means TokenRoot did not accept the mint.
    // Later wallet-level failures are reported through onMintFailed().
    onBounce(TvmSlice body) external {
        // SEC-2: Ensure the bounce actually came from our TokenRoot
        require(msg.sender == _tokenRoot, 150, "Bounce not from TokenRoot");
        // H-08: We need exactly 64 bits minimum: 32 for funcId + 32 for nonce
        if (body.bits() < 64) {
            return;
        }
        
        uint32 funcId = body.load(uint32);
        
        if (funcId == abi.functionId(ITokenRoot.mint)) {
            uint32 nonce = body.load(uint32);
            _rollbackMint(nonce);
        }
    }

    // ─── Security Admin ──────────────────────────────────────────────────────
    // Platform-level pause for emergency security interventions
    function pause() public {
        require(msg.sender == feeRecipient, 111, "Only platform (feeRecipient) can pause");
        paused = true;
    }

    function unpause() public {
        require(msg.sender == feeRecipient, 111, "Only platform (feeRecipient) can unpause");
        paused = false;
    }
}
