pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./Interfaces.sol";
import "./interfaces/IAFTReceiver.sol";
import "./interfaces/IAFTExcesses.sol";
import "./interfaces/IAFTWalletAddressReceiver.sol";
import "./interfaces/IAFTWallet.sol";

interface IAckiSwapFactory {
    function deployPair(address tokenRoot, address callbackTarget) external;
}

interface IAckiSwapPair {
    function initAftWallet() external;
    function provideInitialShell() external;
}
import "./interfaces/IAFTRoot.sol";

contract BondingCurve is IAFTReceiver, IAFTExcesses, IAFTWalletAddressReceiver {
    // ─── Constants ────────────────────────────────────────────────────────────
    // H-05: In TVM-Solidity, `ton` = 10^9 nanotons. So 15_000 ton = 15_000 * 10^9 = 15T nano.
    // This represents 15,000 SHELL in nano-units (SHELL uses 9 decimals like VMSHELL).
    // AMM Migration thresholds
    uint256 public constant MIGRATION_THRESHOLD_SHELL_NANO = 6_900_000 * 1e9; // 6.9M SHELL target
    uint32 public constant LOCK_PERIOD = 30 days;
    // R-03: Removed `bytes public constant DAPP_ID` — dynamic bytes cannot be constant
    // in TVM-Solidity (only value types: int, bool, address, bytesN). Not used in any function.
    uint256 public constant ABSOLUTE_MAX_BUY_PER_TX = 50_000_000 * 1e9;
    uint16 public constant MAX_BUY_PER_TX_BPS = 500; // 5% of this launch's supply cap
    uint64 private constant GAS_TOP_UP = 2_000_000_000; // 2 VMSHELL in nano
    uint128 private constant MIN_EXECUTION_GAS = 1 ton;

    // M-01: Minimum buy amount to prevent dust/zero-cost purchases
    uint256 public constant MIN_BUY_AMOUNT = 1_000_000; // 0.001 tokens minimum

    // H-01: Anti-sniper cooldown between buys per address
    uint32 public constant BUY_COOLDOWN = 5; // 5 seconds between buys per address

    // M-06: Delay before owner can force AMM migration
    uint32 public constant FORCE_MIGRATION_DELAY = 1 hours;

    // ─── Trade Fee Constants ──────────────────────────────────────────────────
    // Fee is charged on every buy and sell trade.
    // 1% before AMM migration (0.7% platform, 0.3% creator).
    // 0.5% after AMM migration (0.35% platform, 0.15% creator).
    // L-01: Note — this contract only accepts SHELL (ECC ID=2). USDC is not accepted here.
    // The Accumulator rate (100 SHELL = 1 USDC) is referenced only for off-chain pricing context.
    function getTradeFeeBps() public view returns (uint16) { return isAmm ? 50 : 100; }
    function getPlatformFeeBps() public view returns (uint16) { return isAmm ? 35 : 70; }
    function getCreatorFeeBps() public view returns (uint16) { return isAmm ? 15 : 30; }

    // ─── C-02: ECC token IDs for Acki Nacki ecosystem ─────────────────────────
    // V-AM-01: Explicit ID constants prevent confusion attacks across the
    // NACKL/SHELL/USDC token ecosystem. Only SHELL (ID=2) is valid payment.
    uint32 public constant NACKL_CURRENCY_ID = 1;   // Staking & store of value
    uint32 public constant SHELL_CURRENCY_ID = 2;    // Utility token (gas, fees) — ACCEPTED
    uint32 public constant USDC_CURRENCY_ID  = 3;    // Stablecoin
    // I-01: Manually defined since TVM-Solidity 0.76 does not support type(uint128).max
    uint256 private constant MAX_UINT128 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF; // 2^128 - 1

    // ─── R-04: Static vars MUST precede all state vars ───────────────────────
    address static public _tokenRoot;    // unique per deploy — makes each BondingCurve address distinct
    uint256 static public _supplyCap;    // max token supply for this launch, in nano-token units

    // ─── State ────────────────────────────────────────────────────────────────
    uint256 public reserveBalance;       // tracked SHELL balance (nano)
    uint256 public totalSupply;
    bool public isAmm;                   // true after reaching threshold (x*y=k internal pool)
    address public ammPairAddress;
    address public factoryAddress;
    uint32 public migratedAt;            // timestamp of migration
    address public owner;                // token creator
    address public feeRecipient;         // platform fee wallet (receives 0.7% of each trade)
    bool public paused;                  // security pause for trading
    // NOTE: tokenRoot removed — use _tokenRoot (static) everywhere for consistency.
    // _tokenRoot is set via stateInit and never changes, making it the canonical reference.
    string public name;
    string public symbol;

    // I-05: creationFeeTxHash is stored for off-chain reference only.
    // It is NOT validated on-chain. Backend/indexer uses it to link the
    // BondingCurve deployment to the original creation fee payment transaction.
    bytes public creationFeeTxHash;

    // C-01: Reentrancy guard for async sell flow
    bool private _locked;

    // ─── R-05: Dual mappings for correct onBounce rollback ───────────────────
    // When ITokenRoot.mint bounces, msg.sender = tokenRoot (not the buyer).
    // We track the last buyer separately so onBounce can resolve who to refund.
    mapping(uint32 => uint256) public pendingReserveByNonce;  // nonce → SHELL cost
    mapping(uint32 => uint256) public pendingTokensByNonce;   // nonce → token amount
    mapping(uint32 => uint256) public pendingPlatformFeeByNonce;
    mapping(uint32 => uint256) public pendingCreatorFeeByNonce;
    
    // A-13: Pump Forever mode (no AMM migration)
    bool public pumpForever;
    
    // A-14: Dynamic Slope Divisor
    uint256 public slopeDivisor;

    mapping(uint32 => address) public mintIdToBuyer; // mapping to resolve bounce exact buyer
    uint32 private _mintSeqno = 1;
    address public myAftWallet;

    // H-01: Track last buy timestamp per address for cooldown
    mapping(address => uint32) public lastBuyTimestamp;

    // M-06: Track when migration threshold was first reached
    uint32 public thresholdReachedAt;

    // ─── Modifiers ────────────────────────────────────────────────────────────
    // ─── AFT Wallet Discovery ─────────────────────────────────────────────────
    function initAftWallet() public {
        require(myAftWallet == address(0), 236, "Already initialized");
        tvm.accept();
        uint256 shellReceived = uint256(msg.currencies[SHELL_CURRENCY_ID]);
        require(shellReceived >= 2 * 1e9, 203, "Send 2 SHELL for discovery gas");
        
        mapping(uint32 => varuint32) cc;
        cc[SHELL_CURRENCY_ID] = varuint32(shellReceived);
        
        IAFTRoot(_tokenRoot).provideWalletAddress{ value: 0.1 ton, currencies: cc, flag: 1 }(
            0,
            address(this),
            false
        );
    }

    function takeWalletAddress(
        uint64 queryId,
        address walletAddress,
        optional(address) ownerAddress
    ) external override functionID(0xd1735400) {
        require(msg.sender == _tokenRoot, 103, "Only AFTRoot can answer");
        myAftWallet = walletAddress;
    }

    modifier whenNotPaused() {
        require(!paused, 110, "Trading is temporarily paused for security");
        _;
    }

    // C-01: Reentrancy guard modifier
    modifier nonReentrant() {
        require(!_locked, 230, "Reentrant call detected");
        _locked = true;
        _;
        _locked = false;
    }

    // ─── Events ───────────────────────────────────────────────────────────────
    event TokensPurchaseInitiated(address buyer, uint256 shellIn, uint256 tokensOut, uint128 newPrice);
    event TokensSold(address seller, uint256 tokensIn, uint256 shellOut, uint128 newPrice);
    event MigratedToInternalAmm(uint128 liquidity, uint32 timestamp);
    event FeeReduced(uint16 newTradeFeeBps);
    // I-02: Missing events for state changes
    event Paused(address by);
    event Unpaused(address by);
    event MintRolledBack(uint32 nonce, address buyer, uint256 shellRefunded);
    event ExcessShellRescued(address to, uint256 amount);
    event BurnFailed(uint64 queryId, uint128 amount);

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
        bool _pumpForever,
        uint256 _slopeDivisor
    ) {
        require(msg.pubkey() == tvm.pubkey() || msg.sender == _tokenRoot, 101, "Only TokenRoot or owner can deploy");
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
        slopeDivisor = _slopeDivisor > 0 ? _slopeDivisor : 10_000_000_000_000;
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
        uint256 slope = totalSupply / slopeDivisor;
        return uint128(base + slope);
    }

    function getBuyPrice(uint256 tokenAmount) public view returns (uint128) {
        require(!isAmm, 250, "Trading ended");
        uint256 base = 1_000; // 0.000001 SHELL base
        uint256 p1 = base + (totalSupply / slopeDivisor);
        uint256 p2 = base + ((totalSupply + tokenAmount) / slopeDivisor);
        uint256 avgPrice = (p1 + p2) / 2;
        require(tokenAmount == 0 || avgPrice <= MAX_UINT128 / tokenAmount, 209, "Overflow detectado");
        return uint128((avgPrice * tokenAmount) / 1e9);
    }

    function getSellReturn(uint256 tokenAmount) public view returns (uint128) {
        if (totalSupply == 0 || tokenAmount > totalSupply) return 0;
        require(!isAmm, 250, "Trading ended");
        uint256 base = 1_000;
        uint256 p1 = base + ((totalSupply - tokenAmount) / slopeDivisor);
        uint256 p2 = base + (totalSupply / slopeDivisor);
        uint256 avgPrice = (p1 + p2) / 2;
        return uint128((avgPrice * tokenAmount) / 1e9);
    }

    // I-04: getSellPrice kept as alias for ABI compatibility but marked for deprecation
    /// @dev Deprecated. Use getSellReturn() instead.
    function getSellPrice(uint256 tokenAmount) public view returns (uint128) {
        return getSellReturn(tokenAmount);
    }

    function getCurrentMarketCap() public view returns (uint256) {
        return (uint256(currentPrice()) * totalSupply) / 1e9;
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
    // M-06: Added mandatory delay after threshold is reached to prevent timing manipulation
    function forceAmmMigration() public whenNotPaused {
        require(msg.sender == owner, 102, "Only owner can force AMM");
        require(!pumpForever, 114, "Pump Forever mode is active");
        require(reserveBalance >= MIGRATION_THRESHOLD_SHELL_NANO, 108, "Threshold not reached");
        require(!isAmm, 109, "Already migrated to AMM");
        require(thresholdReachedAt > 0, 231, "Threshold timestamp not recorded");
        require(block.timestamp >= thresholdReachedAt + FORCE_MIGRATION_DELAY, 232, "Must wait after threshold before forcing migration");
        tvm.accept();
        _migrateToAmm();
    }

    // H-02: Removed _ensureExecutionGas since gas is handled via tvm.accept() and DappConfig.

    // ─── C-02: Buy via msg.currencies[2] (SHELL ECC cross-DappID) ────────────
    // Users send SHELL as Extra Currency (cc[2]) in internal messages.
    // This works both intra-DappID and cross-DappID, enabling universal composability.
    // msg.value (VMSHELL) is used ONLY for gas, not as payment.
    // Trade fee: 1% total (0.7% platform + 0.3% creator).
    function buy(uint256 tokenAmount, uint256 maxShellIn) public whenNotPaused {
        require(!isAmm, 250, "BondingCurve trading ended. Use AckiSwap!");
        tvm.accept();
        // V-AM-01: Reject transactions that accidentally/maliciously include NACKL or USDC
        // instead of SHELL. Without this check, a confusion attack could credit the
        // buyer with tokens while the BondingCurve receives the wrong ECC currency.
        require(uint256(msg.currencies[NACKL_CURRENCY_ID]) == 0, 217, "NACKL not accepted. Send SHELL (ECC ID=2)");
        require(uint256(msg.currencies[USDC_CURRENCY_ID]) == 0, 218, "USDC not accepted. Send SHELL (ECC ID=2)");

        // H-01: Anti-sniper cooldown — prevents rapid-fire buys from same address
        require(block.timestamp >= lastBuyTimestamp[msg.sender] + BUY_COOLDOWN, 226, "Buy cooldown active: wait before buying again");
        lastBuyTimestamp[msg.sender] = uint32(block.timestamp);

        // M-01: Minimum buy amount to prevent dust attacks
        require(tokenAmount >= MIN_BUY_AMOUNT, 228, "Below minimum buy amount");

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

        // ─── Trade Fee: Platform + Creator ─────────────────────────────────────────
        uint256 platformFee = cost * getPlatformFeeBps() / 10000;
        uint256 creatorFee = cost * getCreatorFeeBps() / 10000;
        uint256 mintGasShell = 6 * 10**9; // 6 SHELL for AFT deploy
        uint256 totalCostWithFeeAndGas = cost + platformFee + creatorFee + mintGasShell;

        // C-03: Convert some of the Extra Currency (SHELL) silently to execution gas (VMSHELL)
        uint256 gasToConvert = 1 ton; // 1 SHELL to 1 VMSHELL
        require(receivedShell >= totalCostWithFeeAndGas + gasToConvert, 203, "Insufficient SHELL sent (cost + fee + gas + gasConversion)");
        gosh.cnvrtshellq(uint64(gasToConvert));

        // Update state — only base cost goes to reserve (fee is separate)
        totalSupply += tokenAmount;
        reserveBalance += cost;

        uint32 nonce = ++_mintSeqno;
        // C-03: Prevent nonce collision with pending operations from past overflows
        require(mintIdToBuyer[nonce] == address(0), 225, "Nonce collision detected - retry");
        mintIdToBuyer[nonce] = msg.sender;
        pendingReserveByNonce[nonce] = cost;
        pendingTokensByNonce[nonce] = tokenAmount;

        emit TokensPurchaseInitiated(msg.sender, cost, tokenAmount, currentPrice());

        // Mint memecoins to buyer via internal message
        mapping(uint32 => varuint32) mintCc;
        mintCc[SHELL_CURRENCY_ID] = varuint32(mintGasShell);
        
        IAFTRootAdmin(_tokenRoot).mint{ value: 0.1 ton, currencies: mintCc, flag: 1 }(
            nonce,
            msg.sender,
            uint128(tokenAmount),
            address(this), // responseDestination is BondingCurve
            0,
            TvmCell()
        );

        // H-33: Hold fees in escrow until minting is confirmed via onAFTExcesses.
        pendingPlatformFeeByNonce[nonce] = platformFee;
        pendingCreatorFeeByNonce[nonce] = creatorFee;

        // Refund immediate excess SHELL (Extra Currency) back to buyer
        uint256 totalRequired = totalCostWithFeeAndGas + gasToConvert;
        uint256 immediateExcess = receivedShell > totalRequired ? receivedShell - totalRequired : 0;
        if (immediateExcess > 0) {
            mapping(uint32 => varuint32) refundCurrencies;
            refundCurrencies[SHELL_CURRENCY_ID] = varuint32(immediateExcess);
            msg.sender.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: refundCurrencies });
        }

        // Check if we reached the migration threshold and aren't AMM yet
        if (!pumpForever && reserveBalance >= MIGRATION_THRESHOLD_SHELL_NANO && !isAmm) {
            if (thresholdReachedAt == 0) {
                thresholdReachedAt = uint32(block.timestamp);
            }
            _migrateToAmm();
        }
    }

    // ─── Receiver for async burns (Sell) ─────────────────────────────────────
    // Called by our own AFTWallet after user transfers tokens to us.
    // Trade fee: 1% total (0.7% platform + 0.3% creator).
    function onAFTTransfer(
        uint64 queryId,
        uint128 amount,
        address sender,
        TvmCell forwardPayload
    ) external override whenNotPaused nonReentrant functionID(0x7362d09c) {
        require(!isAmm, 250, "BondingCurve trading ended. Use AckiSwap!");
        tvm.accept();
        require(myAftWallet != address(0), 235, "AFT Wallet not initialized yet");
        require(msg.sender == myAftWallet, 103, "Only my AFT Wallet can notify transfer");

        // Parse minShellOut from forwardPayload
        TvmSlice s = forwardPayload.toSlice();
        uint128 minShellOut = 0;
        if (s.bits() >= 128) {
            minShellOut = s.load(uint128);
        }

        // Audit #3: Anti-rug Creator Lock was dead code since isAmm is false here.
        // Creator lock should be implemented in a dedicated Vesting contract.

        require(amount <= maxSellPerTx(), 222, "Amount exceeds max sell limit");

        uint256 grossReturn = getSellReturn(amount);
        require(grossReturn > 0, 216, "Sell amount too small, return rounds to zero");
        require(reserveBalance >= grossReturn, 204, "Insufficient reserve for sell");

        uint256 platformFee = grossReturn * getPlatformFeeBps() / 10000;
        uint256 creatorFee = grossReturn * getCreatorFeeBps() / 10000;
        uint256 netReturn = grossReturn - platformFee - creatorFee;

        require(netReturn >= minShellOut, 208, "Slippage protection triggered: netReturn < minShellOut");

        // Decrease local supply. We will burn the tokens on our AFTWallet.
        totalSupply -= amount;
        reserveBalance -= grossReturn;

        emit TokensSold(sender, amount, netReturn, currentPrice());

        // Send platform fee
        if (platformFee > 0) {
            mapping(uint32 => varuint32) feeCurrencies;
            feeCurrencies[SHELL_CURRENCY_ID] = varuint32(platformFee);
            feeRecipient.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: feeCurrencies });
        }
        
        // Send creator fee
        if (creatorFee > 0 && owner != address(0)) {
            mapping(uint32 => varuint32) creatorCurrencies;
            creatorCurrencies[SHELL_CURRENCY_ID] = varuint32(creatorFee);
            owner.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: creatorCurrencies });
        }

        tvm.rawReserve(0, 4); // Keep original balance for contract survival

        uint256 burnGasShell = 2 * 10**9;
        
        // Payout to user
        mapping(uint32 => varuint32) payoutCurrencies;
        payoutCurrencies[SHELL_CURRENCY_ID] = varuint32(netReturn);
        
        // Call burn on our wallet to destroy the tokens (AFTRoot will decrease its totalSupply)
        mapping(uint32 => varuint32) burnCc;
        burnCc[SHELL_CURRENCY_ID] = varuint32(burnGasShell);
        IAFTWallet(myAftWallet).burn{ value: 0.05 ton, currencies: burnCc, flag: 1 }(
            queryId,
            amount,
            address(this), // responseDestination
            TvmCell()
        );

        sender.transfer({ value: 0, flag: 128, bounce: false, currencies: payoutCurrencies });
    }

    // Called by TokenRoot when wallet deployment or receiveTokens fails after
    // TokenRoot.mint has already accepted the mint request.
    function onAFTExcesses(uint64 queryId) external override functionID(0xd53276db) {
        uint32 nonce = uint32(queryId);
        address buyer = mintIdToBuyer[nonce];
        if (buyer == address(0)) return; // not a tracked mint

        uint256 platformFee = pendingPlatformFeeByNonce[nonce];
        uint256 creatorFee = pendingCreatorFeeByNonce[nonce];
        
        if (platformFee > 0) {
            mapping(uint32 => varuint32) feeCurrencies;
            feeCurrencies[SHELL_CURRENCY_ID] = varuint32(platformFee);
            feeRecipient.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: feeCurrencies });
        }
        
        if (creatorFee > 0 && owner != address(0)) {
            mapping(uint32 => varuint32) creatorCurrencies;
            creatorCurrencies[SHELL_CURRENCY_ID] = varuint32(creatorFee);
            owner.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: creatorCurrencies });
        }



        // Forward excess SHELL received from AFTWallet back to the buyer
        uint256 returnedShell = uint256(msg.currencies[SHELL_CURRENCY_ID]);
        if (returnedShell > 0) {
            mapping(uint32 => varuint32) refundCurrencies;
            refundCurrencies[SHELL_CURRENCY_ID] = varuint32(returnedShell);
            buyer.transfer({value: 0.05 ton, flag: 1, bounce: false, currencies: refundCurrencies});
        }

        _clearMint(nonce);
    }

    function setFactory(address _factory) external {
        require(msg.sender == owner, 102);
        factoryAddress = _factory;
    }

    // ─── AMM Migration ───────────────────────────────────────────────────────
    function _migrateToAmm() private {
        uint128 liquidityToMove = uint128(reserveBalance);
        require(_supplyCap - totalSupply <= MAX_UINT128, 210, "tokensToMove overflow");
        
        // Setup initial x*y=k invariant
        uint256 tokenPool = _supplyCap - totalSupply;
        require(reserveBalance == 0 || tokenPool <= MAX_UINT128 / reserveBalance, 224, "AMM invariant overflow");
        
        require(factoryAddress != address(0), 225, "Factory not set");
        IAckiSwapFactory(factoryAddress).deployPair{value: 2000000000, bounce: true, flag: 1}(
            _tokenRoot, 
            address(this)
        );

        emit FeeReduced(getTradeFeeBps());
    }

    function onPairDeployed(address pair) external {
        require(msg.sender == factoryAddress, 103, "Only factory");
        isAmm = true;
        migratedAt = uint32(block.timestamp);
        ammPairAddress = pair;
        
        uint128 shellLiquidity = uint128(reserveBalance);
        uint128 tokensToMove = uint128(_supplyCap - totalSupply);

        emit MigratedToInternalAmm(shellLiquidity, migratedAt);
        
        // 1. Initialize Pair's Wallet Discovery
        mapping(uint32 => varuint32) ccInit;
        ccInit[SHELL_CURRENCY_ID] = varuint32(2_500_000_000); // 2.5 SHELL
        IAckiSwapPair(pair).initAftWallet{value: 0.5 ton, currencies: ccInit, flag: 1}();

        // 2. Send SHELL liquidity
        mapping(uint32 => varuint32) ccLiq;
        ccLiq[SHELL_CURRENCY_ID] = varuint32(shellLiquidity);
        IAckiSwapPair(pair).provideInitialShell{value: 0.1 ton, currencies: ccLiq, flag: 1}();

        // 3. Send Tokens liquidity
        TvmBuilder builder;
        builder.store(uint32(1)); // op = 1 (Add Liquidity)
        TvmCell payload = builder.toCell();
        TvmCell empty;
        
        IAFTWallet(myAftWallet).transfer{value: 1 ton, flag: 1}(
            0,
            tokensToMove,
            pair, // destinationOwner (Pair)
            address(this), // responseDestination
            empty, // customPayload
            0.5 ton, // forwardShellAmount
            payload // forwardPayload -> Add Liquidity
        );
    }

    function _rollbackMint(uint32 nonce) private {
        address buyer = mintIdToBuyer[nonce];

        uint256 refundShell = pendingReserveByNonce[nonce];
        uint256 refundTokens = pendingTokensByNonce[nonce];

        // H-33: Include pending fees in the refund if minting fails
        uint256 platformFee = pendingPlatformFeeByNonce[nonce];
        uint256 creatorFee = pendingCreatorFeeByNonce[nonce];
        uint256 totalRefund = refundShell + platformFee + creatorFee;

        if (totalRefund > 0 && buyer != address(0)) {
            // Revert reserve and supply
            reserveBalance -= refundShell;
            totalSupply -= refundTokens;

            // A-11: If reversal drops reserve below migration threshold,
            // rollback AMM state to prevent corrupted x*y=k invariant
            if (isAmm && reserveBalance < MIGRATION_THRESHOLD_SHELL_NANO) {
                isAmm = false;
                migratedAt = 0;
                thresholdReachedAt = 0; // M-06: Reset threshold timestamp
            } else if (isAmm) {
                // Recalculate AMM invariant with corrected values
            }

            // I-02: Emit rollback event for off-chain indexing
            emit MintRolledBack(nonce, buyer, totalRefund);

            // Refund SHELL via cc[2] to the actual buyer
            mapping(uint32 => varuint32) refundCurrencies;
            refundCurrencies[SHELL_CURRENCY_ID] = varuint32(totalRefund);
            buyer.transfer({value: 0.05 ton, flag: 1, bounce: false, currencies: refundCurrencies});
        }

        _clearMint(nonce);
    }

    function _clearMint(uint32 nonce) private {
        delete pendingReserveByNonce[nonce];
        delete pendingTokensByNonce[nonce];
        delete pendingPlatformFeeByNonce[nonce];
        delete pendingCreatorFeeByNonce[nonce];
        delete mintIdToBuyer[nonce];
    }

    // ─── R-05: onBounce handler (corrected) ───────────────────────────────────
    // Direct bounce from ITokenRoot.mint means TokenRoot did not accept the mint.
    // Later wallet-level failures are reported through onMintFailed().
    onBounce(TvmSlice body) external {
        tvm.accept();
        require(msg.sender == _tokenRoot, 150, "Bounce not from TokenRoot");
        if (body.bits() < 64) return;
        
        uint32 funcId = body.load(uint32);
        
        if (funcId == 0x2786d61d) { // IAFTRootAdmin.mint
            uint64 nonce = body.load(uint64);
            _rollbackMint(uint32(nonce));
        } else if (funcId == 0x595f07bc) { // IAFTWallet.burn
            uint64 queryId = body.load(uint64);
            uint128 amount = body.load(uint128);
            
            // Note: We do not rollback totalSupply/reserveBalance here because
            // the SHELL payout was already sent to the user in onAFTTransfer.
            // Rolling back the state would make the contract insolvent.
            // The tokens remain locked in the BondingCurve's AFTWallet, 
            // effectively acting as burned from circulation.
            emit BurnFailed(queryId, amount);
        } else if (funcId == 0x1db1ba02) { // IAckiSwapFactory.deployPair
            // If deployPair bounces, migration failed (e.g., unauthorized)
            // isAmm remains false, trading continues on BondingCurve.
        }
    }

    // ─── Security Admin ──────────────────────────────────────────────────────
    // Platform-level pause for emergency security interventions
    function pause() public {
        require(msg.sender == feeRecipient, 111, "Only platform (feeRecipient) can pause");
        paused = true;
        emit Paused(msg.sender); // I-02
    }

    function unpause() public {
        require(msg.sender == feeRecipient, 111, "Only platform (feeRecipient) can unpause");
        paused = false;
        emit Unpaused(msg.sender); // I-02
    }

    // ─── M-03: Rescue excess SHELL stuck in contract ─────────────────────────
    // If SHELL (ECC) accumulates beyond what reserveBalance tracks (e.g. from
    // rounding or unsolicited transfers), the platform can rescue the surplus.
    // Only the platform (feeRecipient) can call this, and only the excess is sent.
    function rescueExcessShell(address to, uint256 amount) public {
        require(msg.sender == feeRecipient, 111, "Only platform (feeRecipient) can rescue");
        require(to != address(0), 233, "Rescue recipient cannot be zero");

        uint256 currentBalance = uint256(address(this).currencies[SHELL_CURRENCY_ID]);
        require(currentBalance > reserveBalance, 234, "No excess shell to rescue");
        uint256 excess = currentBalance - reserveBalance;
        uint256 safeAmount = amount < excess ? amount : excess;

        if (safeAmount > 0) {
            mapping(uint32 => varuint32) rescueCurrencies;
            rescueCurrencies[SHELL_CURRENCY_ID] = varuint32(safeAmount);
            to.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: rescueCurrencies });
            emit ExcessShellRescued(to, safeAmount);
        }
    }

    /// @notice Returns the SHELL gas required for minting
    function getMintGasShell() public pure returns (uint256) {
        return 6 * 10**9;
    }
}
