pragma ton-solidity >= 0.53.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

// Interface to call DEX.DO liquidity pool after migration
interface IDexPool {
    function addLiquidity(uint128 shellAmount, uint128 tokenAmount) external;
}

interface ITokenRoot {
    function mint(address recipient, uint256 amount, uint128 deployWalletValue) external;
    function burn(address sender, uint256 amount, uint128 deployWalletValue) external;
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
    bool private _locked;                // Reentrancy guard

    // Payment proof: tx hash of the $3 USDC creation fee verified by backend
    bytes public creationFeeTxHash;

    // ─── Events ───────────────────────────────────────────────────────────────
    event TokensBought(address buyer, uint128 shellIn, uint256 tokensOut, uint128 newPrice);
    event TokensSold(address seller, uint256 tokensIn, uint128 shellOut, uint128 newPrice);
    event MigratedToDex(address pool, uint128 liquidity, uint32 lockedUntil);

    modifier nonReentrant() {
        require(!_locked, 111, "Reentrancy guard triggered");
        _locked = true;
        _;
        _locked = false;
    }

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
        _locked = false;
    }

    // ─── Price Function (Bancor-style) ────────────────────────────────────────
    // Safe linear slope avoiding div by zero. Start at 1 nanowVMSHELL, slope = 1 per 10k tokens
    function currentPrice() public view returns (uint128) {
        // Safe math: totalSupply is uint256, slope is calculated in uint256 before casting down to uint128
        uint256 base = 1 ton;
        uint256 slope = totalSupply / 1000;
        return uint128(base + slope);
    }

    function getBuyPrice(uint256 tokenAmount) public view returns (uint128) {
        return uint128(tokenAmount * uint256(currentPrice()));
    }

    // ─── Buy ─────────────────────────────────────────────────────────────────
    function buy(uint256 tokenAmount) public nonReentrant {
        // LOCK: no buying after migration to DEX.DO
        require(!migrated, 201, "Token migrated to DEX.DO - trade there.");
        require(tokenAmount > 0, 202, "Amount must be greater than zero");
        require(msg.value > 0, 203, "Send SHELL to buy tokens");
        tvm.accept();

        uint128 cost = getBuyPrice(tokenAmount);
        require(msg.value >= cost, 204, "Insufficient SHELL sent");

        reserveBalance += cost; // Only add the actual cost to reserve
        totalSupply += tokenAmount;

        // Call tokenRoot.mint(msg.sender, tokenAmount) via async message
        ITokenRoot(tokenRoot).mint{value: 0.1 ton}(msg.sender, tokenAmount, 0.05 ton);

        // Refund excess SHELL to sender
        if (msg.value > cost) {
            msg.sender.transfer({ value: (msg.value - cost), flag: 1, bounce: false });
        }

        emit TokensBought(msg.sender, uint128(cost), tokenAmount, currentPrice());

        // Check migration threshold
        if (reserveBalance >= MIGRATION_THRESHOLD && !migrated) {
            _migrate();
        }
    }

    // ─── Security Fix: Async Sell via Burn Callback ─────────────────────────
    // This replaces the old public sell() which was vulnerable to async desync.
    // Logic: User calls TokenWallet.burn() -> TokenRoot.notifyBurn() -> BondingCurve.onTokenBurned()
    function onTokenBurned(uint256 amount, address refundAddress) external {
        // SEGURANÇA CRÍTICA: Somente o TokenRoot real pode confirmar que tokens foram destruídos
        require(msg.sender == tokenRoot, 107, "Security: Only TokenRoot can confirm burns");
        require(!migrated, 201, "Token migrated to DEX.DO");
        
        // Reservar o gás que chegou na mensagem e usar o saldo do contrato para o refund
        tvm.rawReserve(0, 4);

        uint128 refund = uint128(amount * uint256(currentPrice()));
        
        // Se por algum motivo o reserve balance for menor que o refund (erro matemático),
        // capamos o refund para o saldo disponível para evitar quebra do contrato.
        if (refund > reserveBalance) {
            refund = reserveBalance;
        }

        reserveBalance -= refund;
        totalSupply -= amount;

        // Envia o reembolso para o usuário
        refundAddress.transfer({ value: refund, flag: 0, bounce: false });

        emit TokensSold(refundAddress, amount, refund, currentPrice());
    }

    // ─── Migration ────────────────────────────────────────────────────────────
    // Called internally when reserve crosses MIGRATION_THRESHOLD.
    function _migrate() internal {
        migrated = true;
        migratedAt = uint32(now);
        uint32 lockedUntil = uint32(now) + LOCK_PERIOD;

        // Prepara mensagem para o DEX.DO (payload real sugerido)
        if (dexPool != address(0)) {
            IDexPool(dexPool).addLiquidity{value: 0, flag: 128}(reserveBalance, uint128(totalSupply));
        }

        emit MigratedToDex(dexPool, reserveBalance, lockedUntil);
    }

    // ─── Emergency withdraw (only after lock period expires) ─────────────────
    function withdrawLiquidity() public {
        require(msg.sender == owner, 301);
        require(migrated, 302, "Not migrated yet");
        require(now >= migratedAt + LOCK_PERIOD, 303, "Liquidity still locked");
        tvm.accept();
        msg.sender.transfer({ value: 0, flag: 128, bounce: false });
    }

    // ─── Admin: set DEX pool address ─────────────────────────────────────────
    function setDexPool(address _pool) public {
        require(msg.sender == owner, 301);
        tvm.accept();
        dexPool = _pool;
    }
}
