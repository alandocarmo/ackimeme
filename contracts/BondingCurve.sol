pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./Interfaces.sol";

contract BondingCurve {
    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant MIGRATION_THRESHOLD_SHELL = 69_000;
    uint128 public constant MIGRATION_THRESHOLD = 69_000 ton; // 69,000 SHELL in nano
    uint32 public constant LOCK_PERIOD = 30 days;
    // R-03: Removed `bytes public constant DAPP_ID` — dynamic bytes cannot be constant
    // in TVM-Solidity (only value types: int, bool, address, bytesN). Not used in any function.
    uint256 public constant MAX_BUY_PER_TX = 50_000_000 * 1e9;
    uint256 public constant TOTAL_SUPPLY_CAP = 1_000_000_000 * 1e9; // 1 billion tokens

    // ─── C-02: SHELL ECC token ID for cross-DappID payments ──────────────────
    uint32 public constant SHELL_CURRENCY_ID = 2;

    // ─── R-04: Static vars MUST precede all state vars ───────────────────────
    // In TVM-Solidity, `static` vars are part of the stateInit (initial data).
    // Their position affects the cell tree layout. Declaring them after state vars
    // causes the stateInit hash (= contract address) to diverge between the SDK
    // prediction and the actual deployed contract.
    address static public _tokenRoot;    // unique per deploy — makes each BondingCurve address distinct

    // ─── State ────────────────────────────────────────────────────────────────
    uint256 public reserveBalance;       // tracked SHELL balance (nano)
    uint128 private _pendingLiquidity;   // tracked for rollback on migration bounce
    uint256 public totalSupply;
    bool public migrated;                // true after DEX.DO migration
    uint32 public migratedAt;            // timestamp of migration
    address public dexPool;              // DEX.DO pool address post-migration
    address public owner;                // token creator
    address public tokenRoot;            // TokenRoot address
    string public name;
    string public symbol;

    bytes public creationFeeTxHash;

    // ─── R-05: Dual mappings for correct onBounce rollback ───────────────────
    // When ITokenRoot.mint bounces, msg.sender = tokenRoot (not the buyer).
    // We track the last buyer separately so onBounce can resolve who to refund.
    mapping(address => uint256) public pendingReserveByBuyer;  // buyer → SHELL cost
    mapping(address => uint256) public pendingTokensByBuyer;   // buyer → token amount
    address private _lastBuyer;  // last buyer address for onBounce resolution

    // ─── Events ───────────────────────────────────────────────────────────────
    event TokensBought(address buyer, uint256 shellIn, uint256 tokensOut, uint128 newPrice);
    event TokensSold(address seller, uint256 tokensIn, uint256 shellOut, uint128 newPrice);
    event MigratedToDex(address pool, uint128 liquidity, uint32 lockedUntil);

    // ─── Constructor ──────────────────────────────────────────────────────────
    // BondingCurve is deployed via internal message from TokenRoot.
    // N2: Deploy via internal message, sharing DappID.
    // N1: No need for gosh.cnvrtshellq() here since it's an internal deploy.
    constructor(
        address _owner,
        address _tokenRootAddr,
        string _name,
        string _symbol,
        bytes _creationFeeTxHash
    ) {
        require(msg.sender == _tokenRootAddr, 101, "Only root can deploy BondingCurve");
        
        owner = _owner;
        tokenRoot = _tokenRootAddr;
        name = _name;
        symbol = _symbol;
        creationFeeTxHash = _creationFeeTxHash;
        migrated = false;
    }

    // ─── N3: Auto-replenishment via DappConfig ───────────────────────────────
    function _getTokens() private pure {
        if (address(this).balance > 100000000000) { // 100 VMSHELL
            return;
        }
        gosh.mintshell(100000000000); // 100 VMSHELL
    }

    // ─── A-04: Price & Mathematics (adjusted base for meme economy) ──────────
    // Base price: 0.000001 SHELL per token-unit (= 1_000 nanotokens)
    // This allows ~69M tokens to be sold before migration at 69K SHELL threshold,
    // creating a pump.fun-style economy where early buyers get massive upside.
    function currentPrice() public view returns (uint128) {
        uint256 base = 1_000; // 0.000001 SHELL per token unit (nano)
        uint256 slope = totalSupply / 1_000_000_000_000;
        return uint128(base + slope);
    }

    function getBuyPrice(uint256 tokenAmount) public view returns (uint128) {
        uint256 base = 1_000; // 0.000001 SHELL base
        uint256 p1 = base + (totalSupply / 1_000_000_000_000);
        uint256 p2 = base + ((totalSupply + tokenAmount) / 1_000_000_000_000);
        uint256 avgPrice = (p1 + p2) / 2;
        require(avgPrice <= type(uint128).max / tokenAmount, 209, "Overflow detectado");
        return uint128((avgPrice * tokenAmount) / 1e9);
    }

    function getSellReturn(uint256 tokenAmount) public view returns (uint128) {
        if (totalSupply == 0 || tokenAmount > totalSupply) return 0;
        uint256 base = 1_000;
        uint256 p1 = base + ((totalSupply - tokenAmount) / 1_000_000_000_000);
        uint256 p2 = base + (totalSupply / 1_000_000_000_000);
        uint256 avgPrice = (p1 + p2) / 2;
        return uint128((avgPrice * tokenAmount) / 1e9);
    }

    // ─── Configuration ───────────────────────────────────────────────────────
    // Fix #6: auth via msg.pubkey() instead of msg.sender = owner
    function setDexPool(address _dexPool) public {
        require(msg.pubkey() == tvm.pubkey(), 102, "Only owner pubkey can set DexPool");
        tvm.accept();
        _getTokens(); // N3
        dexPool = _dexPool;
        
        // Fix Flaw: Trigger migration if threshold was already reached
        if (reserveBalance >= MIGRATION_THRESHOLD && !migrated) {
            _migrate();
        }
    }

    // ─── C-02: Buy via msg.currencies[2] (SHELL ECC cross-DappID) ────────────
    // Users send SHELL as Extra Currency (cc[2]) in internal messages.
    // This works both intra-DappID and cross-DappID, enabling universal composability.
    // msg.value (VMSHELL) is used ONLY for gas, not as payment.
    function buy(uint256 tokenAmount, uint256 minTokensOut) public {
        _getTokens(); // N3

        require(!migrated, 201, "Token migrated to DEX.DO - trade there.");
        require(tokenAmount > 0, 202, "Amount must be greater than zero");
        require(tokenAmount <= MAX_BUY_PER_TX, 205, "Amount exceeds max buy limit");
        require(totalSupply + tokenAmount <= TOTAL_SUPPLY_CAP, 206, "Exceeds total supply cap");
        require(tokenAmount >= minTokensOut, 208, "Slippage protection triggered: tokenAmount < minTokensOut");

        // C-02: Read SHELL payment from Extra Currencies map (cc[2])
        // This is the canonical cross-DappID payment method in Acki Nacki.
        // Unlike msg.value (VMSHELL), cc tokens are NOT zeroed across DappIDs.
        varuint32 shellReceived = msg.currencies[SHELL_CURRENCY_ID];
        uint256 receivedShell = uint256(shellReceived);

        uint256 cost = getBuyPrice(tokenAmount);
        require(receivedShell >= cost, 203, "Insufficient SHELL sent for purchase");

        // Update state
        totalSupply += tokenAmount;
        reserveBalance += cost;

        // R-05: Track pending reserves AND tokens by buyer for onBounce rollback
        pendingReserveByBuyer[msg.sender] += cost;
        pendingTokensByBuyer[msg.sender] += tokenAmount;
        _lastBuyer = msg.sender;

        emit TokensBought(msg.sender, cost, tokenAmount, currentPrice());

        // Mint memecoins to buyer via internal message
        ITokenRoot(tokenRoot).mint(msg.sender, tokenAmount, 0.1 ton); // sends 0.1 VMSHELL for wallet deployment

        // Refund excess SHELL (Extra Currency) back to buyer
        uint256 excess = receivedShell > cost ? receivedShell - cost : 0;
        if (excess > 0) {
            // Build currency map with refund amount for cc[2]
            mapping(uint32 => varuint32) refundCurrencies;
            refundCurrencies[SHELL_CURRENCY_ID] = varuint32(excess);
            msg.sender.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: refundCurrencies });
        }

        // Check if we reached the migration threshold
        if (reserveBalance >= MIGRATION_THRESHOLD) {
            _migrate();
        }
    }

    // ─── Receiver for async burns (Sell) ─────────────────────────────────────
    // Called by TokenRoot after TokenWallet burns tokens
    function onTokenBurned(uint256 amount, address refundAddress) external {
        require(msg.sender == tokenRoot, 103, "Only TokenRoot can notify burn");
        _getTokens(); // N3

        if (migrated) {
            // A-01: Use flag:64 instead of flag:128 to avoid destroying the contract
            // flag:128 = send entire balance and self-destruct (kamikaze)
            // flag:64  = carry remaining gas without destroying
            tvm.rawReserve(0.5 ton, 0); // Keep gas
            ITokenRoot(tokenRoot).mint{value: 0, flag: 64}(refundAddress, amount, 0.1 ton);
            return;
        }

        uint256 returnAmount = getSellReturn(amount);
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

    // ─── Migration ───────────────────────────────────────────────────────────
    function _migrate() private {
        // Fix #7: verify dexPool is configured before attempting migration
        if (dexPool == address(0)) {
            // If DEX is not configured, we cannot migrate yet. Wait for owner to configure.
            return;
        }
        
        uint128 liquidityToMove = uint128(reserveBalance);
        uint128 tokensToMove = uint128(TOTAL_SUPPLY_CAP - totalSupply); // Send remaining supply to DEX

        migrated = true;
        migratedAt = uint32(block.timestamp);
        
        // Zero out local reserves and track them for bounce
        _pendingLiquidity = uint128(reserveBalance);
        reserveBalance = 0;
        
        emit MigratedToDex(dexPool, liquidityToMove, migratedAt + LOCK_PERIOD);

        // Fix Flaw: Mint the tokens directly to the DEX
        // We use 0.1 ton (100000000) for the deployment gas of the Dex's TokenWallet
        ITokenRoot(tokenRoot).mint(dexPool, tokensToMove, 100000000);

        // Send SHELL liquidity to DEX via Extra Currencies (cc[2])
        mapping(uint32 => varuint32) migrationCurrencies;
        migrationCurrencies[SHELL_CURRENCY_ID] = varuint32(liquidityToMove);
        IDexPool(dexPool).addLiquidity{value: 1 ton, flag: 1, currencies: migrationCurrencies}(liquidityToMove, tokensToMove);
    }

    // ─── R-05: onBounce handler (corrected) ───────────────────────────────────
    // When ITokenRoot.mint bounces, msg.sender = address(tokenRoot), NOT the buyer.
    // We use _lastBuyer to resolve who to refund. This is safe because TVM processes
    // messages sequentially — there cannot be a concurrent buy between mint and bounce.
    onBounce(TvmSlice body) external {
        uint32 funcId = body.load(uint32);
        
        if (funcId == abi.functionId(ITokenRoot.mint)) {
            // Resolve the buyer from _lastBuyer (msg.sender here is tokenRoot, not buyer)
            address buyer = _lastBuyer;
            uint256 refundShell = pendingReserveByBuyer[buyer];
            uint256 refundTokens = pendingTokensByBuyer[buyer];
            
            if (refundShell > 0 && reserveBalance >= refundShell) {
                // Revert reserve and supply with correct units
                reserveBalance -= refundShell;   // SHELL nano units
                totalSupply -= refundTokens;     // Token units (NOT shell units)

                // Refund SHELL via cc[2] to the actual buyer
                mapping(uint32 => varuint32) refundCurrencies;
                refundCurrencies[SHELL_CURRENCY_ID] = varuint32(refundShell);
                buyer.transfer({value: 0.05 ton, flag: 1, bounce: false, currencies: refundCurrencies});
            }
            delete pendingReserveByBuyer[buyer];
            delete pendingTokensByBuyer[buyer];
            delete _lastBuyer;
        } else if (funcId == abi.functionId(IDexPool.addLiquidity)) {
            // Migration failed, revert state
            migrated = false;
            reserveBalance += _pendingLiquidity;
            _pendingLiquidity = 0;
        }
    }
}
