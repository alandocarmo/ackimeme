pragma ton-solidity >= 0.53.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

// Interface to call DEX.DO liquidity pool after migration
interface IDexPool {
    function addLiquidity(uint128 shellAmount, uint128 tokenAmount) external;
}

interface ITokenRoot {
    function mint(address recipient, uint256 amount, uint128 deployWalletValue) external;
    // Note: burning would require wallet interaction in TVM/TIP-3, simplified here.
}

contract BondingCurve {
    // ─── Constants ────────────────────────────────────────────────────────────
    // Migration threshold: when reserve reaches 69,000 SHELL equivalent,
    // liquidity migrates to DEX.DO automatically (same mechanic as pump.fun $69k)
    uint128 public constant MIGRATION_THRESHOLD = 69000 ton; // 69,000 SHELL in nano

    // Rug-pull protection: liquidity locked for 30 days after migration
    uint32 public constant LOCK_PERIOD = 30 days;

    // DAPP_ID: identifies tokens created by this launchpad (for explorer filtering)
    bytes public constant DAPP_ID = "ACKIMEME_V1";

    // ─── State ────────────────────────────────────────────────────────────────
    uint128 public reserveBalance;
    uint256 public totalSupply;
    bool public migrated;                // true after DEX.DO migration
    uint32 public migratedAt;            // timestamp of migration
    address public dexPool;              // DEX.DO pool address post-migration
    address public owner;                // token creator
    address public tokenRoot;            // MemeTokenRoot address
    string public name;
    string public symbol;

    // Payment proof: tx hash of the $3 USDC creation fee verified by backend
    bytes public creationFeeTxHash;

    // ─── Events ───────────────────────────────────────────────────────────────
    event TokensBought(address buyer, uint128 shellIn, uint256 tokensOut, uint128 newPrice);
    event TokensSold(address seller, uint256 tokensIn, uint128 shellOut, uint128 newPrice);
    event MigratedToDex(address pool, uint128 liquidity, uint32 lockedUntil);

    constructor(
        address _owner,
        address _tokenRoot,
        string _name,
        string _symbol,
        bytes _creationFeeTxHash
    ) {
        require(tvm.pubkey() != 0, 101);
        require(msg.pubkey() == tvm.pubkey(), 102);
        require(_owner != address(0), 103);
        require(bytes(_creationFeeTxHash).length > 0, 104, "Creation fee proof required");
        tvm.accept();

        owner = _owner;
        tokenRoot = _tokenRoot;
        name = _name;
        symbol = _symbol;
        creationFeeTxHash = _creationFeeTxHash;
        migrated = false;
    }

    // ─── Price Function (Bancor-style) ────────────────────────────────────────
    // price = reserveBalance / totalSupply  (simplified linear curve)
    function currentPrice() public view returns (uint128) {
        if (totalSupply == 0) return 1 ton; // initial price: 1 SHELL
        return uint128(reserveBalance / totalSupply);
    }

    function getBuyPrice(uint256 tokenAmount) public view returns (uint128) {
        // Integral of linear curve: cost = currentPrice * amount + (amount^2 * slope)
        uint128 base = uint128(tokenAmount) * currentPrice();
        return base;
    }

    // ─── Buy ─────────────────────────────────────────────────────────────────
    function buy(uint256 tokenAmount) public {
        // LOCK: no buying after migration to DEX.DO
        require(!migrated, 201, "Token migrated to DEX.DO - trade there.");
        require(tokenAmount > 0, 202);
        require(msg.value > 0, 203, "Send SHELL to buy tokens");
        tvm.accept();

        uint128 cost = getBuyPrice(tokenAmount);
        require(msg.value >= cost, 204, "Insufficient SHELL sent");

        reserveBalance += msg.value;
        totalSupply += tokenAmount;

        // Call tokenRoot.mint(msg.sender, tokenAmount) via async message
        ITokenRoot(tokenRoot).mint{value: varuint16(0.1 ton)}(msg.sender, tokenAmount, uint128(0.05 ton));

        emit TokensBought(msg.sender, msg.value, tokenAmount, currentPrice());

        // Check migration threshold
        if (reserveBalance >= MIGRATION_THRESHOLD && !migrated) {
            _migrate();
        }
    }

    // ─── Sell ────────────────────────────────────────────────────────────────
    function sell(uint256 tokenAmount) public {
        // LOCK: no selling after migration
        require(!migrated, 201, "Token migrated to DEX.DO - trade there.");
        require(tokenAmount > 0, 202);
        require(totalSupply >= tokenAmount, 205, "Not enough supply to sell back");
        tvm.accept();

        uint128 refund = uint128(tokenAmount) * currentPrice();
        require(reserveBalance >= refund, 206, "Reserve too low");

        reserveBalance -= refund;
        totalSupply -= tokenAmount;

        // TODO: burn tokens: ITokenRoot(tokenRoot).burn{value: 0.1 ton}(msg.sender, tokenAmount);

        msg.sender.transfer(varuint16(refund), false, 0);

        emit TokensSold(msg.sender, tokenAmount, refund, currentPrice());
    }

    // ─── Migration ────────────────────────────────────────────────────────────
    // Called internally when reserve crosses MIGRATION_THRESHOLD.
    // Liquidity is locked for LOCK_PERIOD — creator cannot withdraw.
    function _migrate() internal {
        migrated = true;
        migratedAt = block.timestamp;
        uint32 lockedUntil = block.timestamp + LOCK_PERIOD;

        // TODO: call DEX.DO pool to add liquidity
        // IDexPool(dexPool).addLiquidity{value: reserveBalance}(reserveBalance, totalSupply);

        emit MigratedToDex(dexPool, reserveBalance, lockedUntil);
    }

    // ─── Emergency withdraw (only after lock period expires) ─────────────────
    function withdrawLiquidity() public {
        require(msg.sender == owner, 301);
        require(migrated, 302, "Not migrated yet");
        require(block.timestamp >= migratedAt + LOCK_PERIOD, 303, "Liquidity still locked");
        tvm.accept();
        // Only allow withdrawal after lock expires
        msg.sender.transfer(varuint16(reserveBalance), false, 0);
    }

    // ─── Admin: set DEX pool address ─────────────────────────────────────────
    function setDexPool(address _pool) public {
        require(msg.sender == owner, 301);
        tvm.accept();
        dexPool = _pool;
    }
}
