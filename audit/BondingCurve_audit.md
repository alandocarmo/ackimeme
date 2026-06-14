# Audit – BondingCurve.sol

*Source: `C:\Users\alanp\ackimeme\contracts\BondingCurve.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 2 | `pragma AbiHeader expire;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `pragma AbiHeader pubkey;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 4 | `` | — | https://docs.acki-nacki.org/solidity |
| 5 | `import "./Interfaces.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 6 | `import "./interfaces/IAFTReceiver.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 7 | `import "./interfaces/IAFTExcesses.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 8 | `import "./interfaces/IAFTWalletAddressReceiver.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 9 | `import "./interfaces/IAFTWallet.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 10 | `` | — | https://docs.acki-nacki.org/solidity |
| 11 | `interface IAckiSwapFactory {` | — | [interfaces](https://docs.acki-nacki.org/solidity/interfaces.html) |
| 12 | `    function deployPair(address tokenRoot, address callbackTarget) external;` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 13 | `    function approveBondingCurve(address bc) external;` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 14 | `}` | — | https://docs.acki-nacki.org/solidity |
| 15 | `` | — | https://docs.acki-nacki.org/solidity |
| 16 | `interface IAckiSwapPair {` | — | [interfaces](https://docs.acki-nacki.org/solidity/interfaces.html) |
| 17 | `    function initAftWallet() external;` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 18 | `    function provideInitialShell() external;` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 19 | `}` | — | https://docs.acki-nacki.org/solidity |
| 20 | `import "./interfaces/IAFTRoot.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 21 | `` | — | https://docs.acki-nacki.org/solidity |
| 22 | `contract BondingCurve is IAFTReceiver, IAFTExcesses, IAFTWalletAddressReceiver {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 23 | `    // ─── Constants ────────────────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 24 | `    // H-05: In TVM-Solidity, `ton` = 10^9 nanotons. So 15_000 ton = 15_000 * 10^9 = 15T nano.` | — | https://docs.acki-nacki.org/solidity |
| 25 | `    // This represents 15,000 SHELL in nano-units (SHELL uses 9 decimals like VMSHELL).` | — | https://docs.acki-nacki.org/solidity |
| 26 | `    // AMM Migration thresholds` | — | https://docs.acki-nacki.org/solidity |
| 27 | `    uint256 public constant MIGRATION_THRESHOLD_SHELL_NANO = 6_900_000 * 1e9; // 6.9M SHELL target` | — | https://docs.acki-nacki.org/solidity |
| 28 | `    uint32 public constant LOCK_PERIOD = 30 days;` | — | https://docs.acki-nacki.org/solidity |
| 29 | `    // R-03: Removed `bytes public constant DAPP_ID` — dynamic bytes cannot be constant` | — | https://docs.acki-nacki.org/solidity |
| 30 | `    // in TVM-Solidity (only value types: int, bool, address, bytesN). Not used in any function.` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 31 | `    uint256 public constant ABSOLUTE_MAX_BUY_PER_TX = 50_000_000 * 1e9;` | — | https://docs.acki-nacki.org/solidity |
| 32 | `    uint16 public constant MAX_BUY_PER_TX_BPS = 500; // 5% of this launch's supply cap` | — | https://docs.acki-nacki.org/solidity |
| 33 | `    uint64 private constant GAS_TOP_UP = 2_000_000_000; // 2 VMSHELL in nano` | — | https://docs.acki-nacki.org/solidity |
| 34 | `    uint128 private constant MIN_EXECUTION_GAS = 1 ton;` | — | https://docs.acki-nacki.org/solidity |
| 35 | `` | — | https://docs.acki-nacki.org/solidity |
| 36 | `    // R7-C1: SHELL fuel for AMM migration plumbing, held back from the pool.` | — | https://docs.acki-nacki.org/solidity |
| 37 | `    // MIGRATION_TOKEN_GAS_SHELL is attached to the token-liquidity transfer and` | — | https://docs.acki-nacki.org/solidity |
| 38 | `    // covers the wallet entry conversion (~0.6), a possible cold-form deploy of` | — | https://docs.acki-nacki.org/solidity |
| 39 | `    // the pair's AFT wallet (5) and the op=1 notification forward (0.5).` | — | https://docs.acki-nacki.org/solidity |
| 40 | `    // MIGRATION_GAS_RESERVE_SHELL additionally covers the 2.5 SHELL discovery` | — | https://docs.acki-nacki.org/solidity |
| 41 | `    // sent in onPairDeployed plus margin for in-flight duplicate migrations.` | — | https://docs.acki-nacki.org/solidity |
| 42 | `    uint128 private constant MIGRATION_TOKEN_GAS_SHELL = 8_000_000_000;    // 8 SHELL` | — | https://docs.acki-nacki.org/solidity |
| 43 | `    uint128 private constant MIGRATION_GAS_RESERVE_SHELL = 20_000_000_000; // 20 SHELL` | — | https://docs.acki-nacki.org/solidity |
| 44 | `` | — | https://docs.acki-nacki.org/solidity |
| 45 | `    // M-01: Minimum buy amount to prevent dust/zero-cost purchases` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 46 | `    uint256 public constant MIN_BUY_AMOUNT = 1_000_000; // 0.001 tokens minimum` | — | https://docs.acki-nacki.org/solidity |
| 47 | `` | — | https://docs.acki-nacki.org/solidity |
| 48 | `    // H-01: Anti-sniper cooldown between buys per address` | — | https://docs.acki-nacki.org/solidity |
| 49 | `    uint32 public constant BUY_COOLDOWN = 5; // 5 seconds between buys per address` | — | https://docs.acki-nacki.org/solidity |
| 50 | `` | — | https://docs.acki-nacki.org/solidity |
| 51 | `    // M-06: Delay before owner can force AMM migration` | — | https://docs.acki-nacki.org/solidity |
| 52 | `    uint32 public constant FORCE_MIGRATION_DELAY = 1 hours;` | — | https://docs.acki-nacki.org/solidity |
| 53 | `` | — | https://docs.acki-nacki.org/solidity |
| 54 | `    // ─── Trade Fee Constants ──────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 55 | `    // Fee is charged on every buy and sell trade.` | — | https://docs.acki-nacki.org/solidity |
| 56 | `    // 1% before AMM migration (0.7% platform, 0.3% creator).` | — | https://docs.acki-nacki.org/solidity |
| 57 | `    // 0.5% after AMM migration (0.35% platform, 0.15% creator).` | — | https://docs.acki-nacki.org/solidity |
| 58 | `    // L-01: Note — this contract only accepts SHELL (ECC ID=2). USDC is not accepted here.` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 59 | `    // The Accumulator rate (100 SHELL = 1 USDC) is referenced only for off-chain pricing context.` | — | https://docs.acki-nacki.org/solidity |
| 60 | `    function getTradeFeeBps() public view returns (uint16) { return isAmm ? 50 : 100; }` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 61 | `    function getPlatformFeeBps() public view returns (uint16) { return isAmm ? 35 : 70; }` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 62 | `    function getCreatorFeeBps() public view returns (uint16) { return isAmm ? 15 : 30; }` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 63 | `` | — | https://docs.acki-nacki.org/solidity |
| 64 | `    // ─── C-02: ECC token IDs for Acki Nacki ecosystem ─────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 65 | `    // V-AM-01: Explicit ID constants prevent confusion attacks across the` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 66 | `    // NACKL/SHELL/USDC token ecosystem. Only SHELL (ID=2) is valid payment.` | — | https://docs.acki-nacki.org/solidity |
| 67 | `    uint32 public constant NACKL_CURRENCY_ID = 1;   // Staking & store of value` | — | https://docs.acki-nacki.org/solidity |
| 68 | `    uint32 public constant SHELL_CURRENCY_ID = 2;    // Utility token (gas, fees) — ACCEPTED` | — | https://docs.acki-nacki.org/solidity |
| 69 | `    uint32 public constant USDC_CURRENCY_ID  = 3;    // Stablecoin` | — | https://docs.acki-nacki.org/solidity |
| 70 | `    // I-01: Manually defined since TVM-Solidity 0.76 does not support type(uint128).max` | — | https://docs.acki-nacki.org/solidity |
| 71 | `    uint256 private constant MAX_UINT128 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF; // 2^128 - 1` | — | https://docs.acki-nacki.org/solidity |
| 72 | `` | — | https://docs.acki-nacki.org/solidity |
| 73 | `    // ─── R-04: Static vars MUST precede all state vars ───────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 74 | `    address static public _tokenRoot;    // unique per deploy — makes each BondingCurve address distinct` | — | https://docs.acki-nacki.org/solidity |
| 75 | `    uint256 static public _supplyCap;    // max token supply for this launch, in nano-token units` | — | https://docs.acki-nacki.org/solidity |
| 76 | `    address static public _factory;      // the launch factory that deployed this curve` | — | https://docs.acki-nacki.org/solidity |
| 77 | `` | — | https://docs.acki-nacki.org/solidity |
| 78 | `    // ─── State ────────────────────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 79 | `    uint256 public reserveBalance;       // tracked SHELL balance (nano)` | — | https://docs.acki-nacki.org/solidity |
| 80 | `    uint256 public totalSupply;` | — | https://docs.acki-nacki.org/solidity |
| 81 | `    bool public isAmm;                   // true after reaching threshold (x*y=k internal pool)` | — | https://docs.acki-nacki.org/solidity |
| 82 | `    address public ammPairAddress;` | — | https://docs.acki-nacki.org/solidity |
| 83 | `    address public ammFactory;` | — | https://docs.acki-nacki.org/solidity |
| 84 | `    uint32 public migratedAt;            // timestamp of migration` | — | https://docs.acki-nacki.org/solidity |
| 85 | `    address public owner;                // token creator` | — | https://docs.acki-nacki.org/solidity |
| 86 | `    address public feeRecipient;         // platform fee wallet (receives 0.7% of each trade)` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 87 | `    bool public paused;                  // security pause for trading` | — | https://docs.acki-nacki.org/solidity |
| 88 | `    // NOTE: tokenRoot removed — use _tokenRoot (static) everywhere for consistency.` | — | https://docs.acki-nacki.org/solidity |
| 89 | `    // _tokenRoot is set via stateInit and never changes, making it the canonical reference.` | — | https://docs.acki-nacki.org/solidity |
| 90 | `    string public name;` | — | https://docs.acki-nacki.org/solidity |
| 91 | `    string public symbol;` | — | https://docs.acki-nacki.org/solidity |
| 92 | `` | — | https://docs.acki-nacki.org/solidity |
| 93 | `    // I-05: creationFeeTxHash is stored for off-chain reference only.` | — | https://docs.acki-nacki.org/solidity |
| 94 | `    // It is NOT validated on-chain. Backend/indexer uses it to link the` | — | https://docs.acki-nacki.org/solidity |
| 95 | `    // BondingCurve deployment to the original creation fee payment transaction.` | — | https://docs.acki-nacki.org/solidity |
| 96 | `    bytes public creationFeeTxHash;` | — | https://docs.acki-nacki.org/solidity |
| 97 | `` | — | https://docs.acki-nacki.org/solidity |
| 98 | `    // C-01: Reentrancy guard for async sell flow` | — | https://docs.acki-nacki.org/solidity |
| 99 | `    bool private _locked;` | — | https://docs.acki-nacki.org/solidity |
| 100 | `` | — | https://docs.acki-nacki.org/solidity |
| 101 | `    // ─── R-05: Dual mappings for correct onBounce rollback ───────────────────` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 102 | `    // When ITokenRoot.mint bounces, msg.sender = tokenRoot (not the buyer).` | — | https://docs.acki-nacki.org/solidity |
| 103 | `    // We track the last buyer separately so onBounce can resolve who to refund.` | — | https://docs.acki-nacki.org/solidity |
| 104 | `    mapping(uint32 => uint256) public pendingReserveByNonce;  // nonce → SHELL cost` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 105 | `    mapping(uint32 => uint256) public pendingTokensByNonce;   // nonce → token amount` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 106 | `    mapping(uint32 => uint256) public pendingPlatformFeeByNonce;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 107 | `    mapping(uint32 => uint256) public pendingCreatorFeeByNonce;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 108 | `` | — | https://docs.acki-nacki.org/solidity |
| 109 | `    // A-13: Pump Forever mode (no AMM migration)` | — | https://docs.acki-nacki.org/solidity |
| 110 | `    bool public pumpForever;` | — | https://docs.acki-nacki.org/solidity |
| 111 | `` | — | https://docs.acki-nacki.org/solidity |
| 112 | `    // A-14: Dynamic Slope Divisor` | — | https://docs.acki-nacki.org/solidity |
| 113 | `    uint256 public slopeDivisor;` | — | https://docs.acki-nacki.org/solidity |
| 114 | `` | — | https://docs.acki-nacki.org/solidity |
| 115 | `    mapping(uint32 => address) public mintIdToBuyer; // mapping to resolve bounce exact buyer` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 116 | `    uint32 private _mintSeqno = 1;` | — | https://docs.acki-nacki.org/solidity |
| 117 | `    address public myAftWallet;` | — | https://docs.acki-nacki.org/solidity |
| 118 | `` | — | https://docs.acki-nacki.org/solidity |
| 119 | `    // H-01: Track last buy timestamp per address for cooldown` | — | https://docs.acki-nacki.org/solidity |
| 120 | `    mapping(address => uint32) public lastBuyTimestamp;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 121 | `` | — | https://docs.acki-nacki.org/solidity |
| 122 | `    // M-06: Track when migration threshold was first reached` | — | https://docs.acki-nacki.org/solidity |
| 123 | `    uint32 public thresholdReachedAt;` | — | https://docs.acki-nacki.org/solidity |
| 124 | `` | — | https://docs.acki-nacki.org/solidity |
| 125 | `    // R7-C1: one-shot guard — liquidity must only ever be pushed to the pair once` | — | https://docs.acki-nacki.org/solidity |
| 126 | `    bool public liquiditySent;` | — | https://docs.acki-nacki.org/solidity |
| 127 | `` | — | https://docs.acki-nacki.org/solidity |
| 128 | `    // ─── Modifiers ────────────────────────────────────────────────────────────` | — | [modifiers](https://docs.acki-nacki.org/solidity/modifiers.html) |
| 129 | `    // ─── AFT Wallet Discovery ─────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 130 | `    function initAftWallet() public {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 131 | `        require(myAftWallet == address(0), 236, "Already initialized");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 132 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 133 | `        uint256 shellReceived = uint256(msg.currencies[SHELL_CURRENCY_ID]);` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 134 | `        require(shellReceived >= 2 * 1e9, 203, "Send 2 SHELL for discovery gas");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 135 | `` | — | https://docs.acki-nacki.org/solidity |
| 136 | `        mapping(uint32 => varuint32) cc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 137 | `        cc[SHELL_CURRENCY_ID] = varuint32(shellReceived);` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 138 | `` | — | https://docs.acki-nacki.org/solidity |
| 139 | `        IAFTRoot(_tokenRoot).provideWalletAddress{ value: 0.1 ton, currencies: cc, flag: 1 }(` | — | https://docs.acki-nacki.org/solidity |
| 140 | `            0,` | — | https://docs.acki-nacki.org/solidity |
| 141 | `            address(this),` | — | https://docs.acki-nacki.org/solidity |
| 142 | `            false` | — | https://docs.acki-nacki.org/solidity |
| 143 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 144 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 145 | `` | — | https://docs.acki-nacki.org/solidity |
| 146 | `    function takeWalletAddress(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 147 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 148 | `        address walletAddress,` | — | https://docs.acki-nacki.org/solidity |
| 149 | `        optional(address) ownerAddress` | — | https://docs.acki-nacki.org/solidity |
| 150 | `    ) external override functionID(0xd1735400) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 151 | `        require(msg.sender == _tokenRoot, 103, "Only AFTRoot can answer");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 152 | `        myAftWallet = walletAddress;` | — | https://docs.acki-nacki.org/solidity |
| 153 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 154 | `` | — | https://docs.acki-nacki.org/solidity |
| 155 | `    modifier whenNotPaused() {` | — | [modifiers](https://docs.acki-nacki.org/solidity/modifiers.html) |
| 156 | `        require(!paused, 110, "Trading is temporarily paused for security");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 157 | `        _;` | — | https://docs.acki-nacki.org/solidity |
| 158 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 159 | `` | — | https://docs.acki-nacki.org/solidity |
| 160 | `    // C-01: Reentrancy guard modifier` | — | [modifiers](https://docs.acki-nacki.org/solidity/modifiers.html) |
| 161 | `    modifier nonReentrant() {` | — | [modifiers](https://docs.acki-nacki.org/solidity/modifiers.html) |
| 162 | `        require(!_locked, 230, "Reentrant call detected");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 163 | `        _locked = true;` | — | https://docs.acki-nacki.org/solidity |
| 164 | `        _;` | — | https://docs.acki-nacki.org/solidity |
| 165 | `        _locked = false;` | — | https://docs.acki-nacki.org/solidity |
| 166 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 167 | `` | — | https://docs.acki-nacki.org/solidity |
| 168 | `    // ─── Events ───────────────────────────────────────────────────────────────` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 169 | `    event TokensPurchaseInitiated(address buyer, uint256 shellIn, uint256 tokensOut, uint128 newPrice);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 170 | `    event TokensSold(address seller, uint256 tokensIn, uint256 shellOut, uint128 newPrice);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 171 | `    event MigratedToInternalAmm(uint128 liquidity, uint32 timestamp);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 172 | `    event FeeReduced(uint16 newTradeFeeBps);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 173 | `    // I-02: Missing events for state changes` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 174 | `    event Paused(address by);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 175 | `    event Unpaused(address by);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 176 | `    event MintRolledBack(uint32 nonce, address buyer, uint256 shellRefunded);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 177 | `    event ExcessShellRescued(address to, uint256 amount);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 178 | `    event BurnFailed(uint64 queryId, uint128 amount);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 179 | `` | — | https://docs.acki-nacki.org/solidity |
| 180 | `    // ─── Constructor ──────────────────────────────────────────────────────────` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 181 | `    // BondingCurve is deployed via internal message from the LaunchFactory.` | — | https://docs.acki-nacki.org/solidity |
| 182 | `    // msg.sender == _factory (stateInit static var) — enforced below.` | — | https://docs.acki-nacki.org/solidity |
| 183 | `    constructor(` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 184 | `        address _owner,` | — | https://docs.acki-nacki.org/solidity |
| 185 | `        address _tokenRootAddr,` | — | https://docs.acki-nacki.org/solidity |
| 186 | `        string _name,` | — | https://docs.acki-nacki.org/solidity |
| 187 | `        string _symbol,` | — | https://docs.acki-nacki.org/solidity |
| 188 | `        bytes _creationFeeTxHash,` | — | https://docs.acki-nacki.org/solidity |
| 189 | `        address _feeRecipient,` | — | https://docs.acki-nacki.org/solidity |
| 190 | `        bool _pumpForever,` | — | https://docs.acki-nacki.org/solidity |
| 191 | `        uint256 _slopeDivisor,` | — | https://docs.acki-nacki.org/solidity |
| 192 | `        address _ammFactory` | — | https://docs.acki-nacki.org/solidity |
| 193 | `    ) {` | — | https://docs.acki-nacki.org/solidity |
| 194 | `        require(msg.sender == _factory, 101, "Only Factory can deploy");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 195 | `        require(_tokenRootAddr == _tokenRoot, 104, "tokenRootAddr must match static _tokenRoot");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 196 | `        require(_supplyCap > 0, 105, "Supply cap must be set");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 197 | `        require(_feeRecipient != address(0), 106, "Fee recipient cannot be zero address");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 198 | `` | — | https://docs.acki-nacki.org/solidity |
| 199 | `        tvm.accept(); // Accept VMSHELL from TokenRoot's internal message deployment` | — | https://docs.acki-nacki.org/solidity |
| 200 | `        owner = _owner;` | — | https://docs.acki-nacki.org/solidity |
| 201 | `        feeRecipient = _feeRecipient;` | — | https://docs.acki-nacki.org/solidity |
| 202 | `        // _tokenRoot is the canonical reference — no separate tokenRoot variable needed` | — | https://docs.acki-nacki.org/solidity |
| 203 | `        name = _name;` | — | https://docs.acki-nacki.org/solidity |
| 204 | `        symbol = _symbol;` | — | https://docs.acki-nacki.org/solidity |
| 205 | `        creationFeeTxHash = _creationFeeTxHash;` | — | https://docs.acki-nacki.org/solidity |
| 206 | `        pumpForever = _pumpForever;` | — | https://docs.acki-nacki.org/solidity |
| 207 | `        slopeDivisor = _slopeDivisor > 0 ? _slopeDivisor : 10_000_000_000_000;` | — | https://docs.acki-nacki.org/solidity |
| 208 | `        ammFactory = _ammFactory;` | — | https://docs.acki-nacki.org/solidity |
| 209 | `        isAmm = false;` | — | https://docs.acki-nacki.org/solidity |
| 210 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 211 | `` | — | https://docs.acki-nacki.org/solidity |
| 212 | `` | — | https://docs.acki-nacki.org/solidity |
| 213 | `` | — | https://docs.acki-nacki.org/solidity |
| 214 | `    // ─── A-04: Price & Mathematics (adjusted base for meme economy) ──────────` | — | https://docs.acki-nacki.org/solidity |
| 215 | `    // Base price: 0.000001 SHELL per token-unit (= 1_000 nanotokens)` | — | https://docs.acki-nacki.org/solidity |
| 216 | `    // This allows ~15M tokens to be sold before migration at 15K SHELL threshold,` | — | https://docs.acki-nacki.org/solidity |
| 217 | `    // creating a pump.fun-style economy where early buyers get massive upside.` | — | https://docs.acki-nacki.org/solidity |
| 218 | `    function currentPrice() public view returns (uint128) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 219 | `        if (isAmm) {` | — | https://docs.acki-nacki.org/solidity |
| 220 | `            uint256 tokenPool = _supplyCap - totalSupply;` | — | https://docs.acki-nacki.org/solidity |
| 221 | `            if (tokenPool == 0) return 0;` | — | https://docs.acki-nacki.org/solidity |
| 222 | `            return uint128((reserveBalance * 1e9) / tokenPool);` | — | https://docs.acki-nacki.org/solidity |
| 223 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 224 | `        uint256 base = 1_000; // 0.000001 SHELL per token unit (nano)` | — | https://docs.acki-nacki.org/solidity |
| 225 | `        uint256 slope = totalSupply / slopeDivisor;` | — | https://docs.acki-nacki.org/solidity |
| 226 | `        return uint128(base + slope);` | — | https://docs.acki-nacki.org/solidity |
| 227 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 228 | `` | — | https://docs.acki-nacki.org/solidity |
| 229 | `    function getBuyPrice(uint256 tokenAmount) public view returns (uint128) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 230 | `        require(!isAmm, 250, "Trading ended");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 231 | `        uint256 base = 1_000; // 0.000001 SHELL base` | — | https://docs.acki-nacki.org/solidity |
| 232 | `        uint256 p1 = base + (totalSupply / slopeDivisor);` | — | https://docs.acki-nacki.org/solidity |
| 233 | `        uint256 p2 = base + ((totalSupply + tokenAmount) / slopeDivisor);` | — | https://docs.acki-nacki.org/solidity |
| 234 | `        uint256 avgPrice = (p1 + p2) / 2;` | — | https://docs.acki-nacki.org/solidity |
| 235 | `        require(tokenAmount == 0 \|\| avgPrice <= MAX_UINT128 / tokenAmount, 209, "Overflow detectado");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 236 | `        return uint128((avgPrice * tokenAmount) / 1e9);` | — | https://docs.acki-nacki.org/solidity |
| 237 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 238 | `` | — | https://docs.acki-nacki.org/solidity |
| 239 | `    function getSellReturn(uint256 tokenAmount) public view returns (uint128) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 240 | `        if (totalSupply == 0 \|\| tokenAmount > totalSupply) return 0;` | — | https://docs.acki-nacki.org/solidity |
| 241 | `        require(!isAmm, 250, "Trading ended");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 242 | `        uint256 base = 1_000;` | — | https://docs.acki-nacki.org/solidity |
| 243 | `        uint256 p1 = base + ((totalSupply - tokenAmount) / slopeDivisor);` | — | https://docs.acki-nacki.org/solidity |
| 244 | `        uint256 p2 = base + (totalSupply / slopeDivisor);` | — | https://docs.acki-nacki.org/solidity |
| 245 | `        uint256 avgPrice = (p1 + p2) / 2;` | — | https://docs.acki-nacki.org/solidity |
| 246 | `        return uint128((avgPrice * tokenAmount) / 1e9);` | — | https://docs.acki-nacki.org/solidity |
| 247 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 248 | `` | — | https://docs.acki-nacki.org/solidity |
| 249 | `    // I-04: getSellPrice kept as alias for ABI compatibility but marked for deprecation` | — | https://docs.acki-nacki.org/solidity |
| 250 | `    /// @dev Deprecated. Use getSellReturn() instead.` | — | https://docs.acki-nacki.org/solidity |
| 251 | `    function getSellPrice(uint256 tokenAmount) public view returns (uint128) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 252 | `        return getSellReturn(tokenAmount);` | — | https://docs.acki-nacki.org/solidity |
| 253 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 254 | `` | — | https://docs.acki-nacki.org/solidity |
| 255 | `    function getCurrentMarketCap() public view returns (uint256) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 256 | `        return (uint256(currentPrice()) * totalSupply) / 1e9;` | — | https://docs.acki-nacki.org/solidity |
| 257 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 258 | `` | — | https://docs.acki-nacki.org/solidity |
| 259 | `    function maxBuyPerTx() public view returns (uint256) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 260 | `        uint256 capBasedLimit = (_supplyCap * MAX_BUY_PER_TX_BPS) / 10_000;` | — | https://docs.acki-nacki.org/solidity |
| 261 | `        if (capBasedLimit == 0) {` | — | https://docs.acki-nacki.org/solidity |
| 262 | `            return 1;` | — | https://docs.acki-nacki.org/solidity |
| 263 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 264 | `        return capBasedLimit < ABSOLUTE_MAX_BUY_PER_TX ? capBasedLimit : ABSOLUTE_MAX_BUY_PER_TX;` | — | https://docs.acki-nacki.org/solidity |
| 265 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 266 | `` | — | https://docs.acki-nacki.org/solidity |
| 267 | `    function maxSellPerTx() public view returns (uint256) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 268 | `        return maxBuyPerTx();` | — | https://docs.acki-nacki.org/solidity |
| 269 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 270 | `` | — | https://docs.acki-nacki.org/solidity |
| 271 | `    // ─── Fee Views ────────────────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 272 | `    /// @notice Returns the total trade fee for a given base amount.` | — | https://docs.acki-nacki.org/solidity |
| 273 | `    function getTradeFee(uint256 baseAmount) public view returns (uint256) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 274 | `        return baseAmount * getTradeFeeBps() / 10000;` | — | https://docs.acki-nacki.org/solidity |
| 275 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 276 | `` | — | https://docs.acki-nacki.org/solidity |
| 277 | `    /// @notice Returns the buy cost INCLUDING the fee for a given token amount.` | — | https://docs.acki-nacki.org/solidity |
| 278 | `    function getBuyPriceWithFee(uint256 tokenAmount) public view returns (uint128 baseCost, uint128 fee, uint128 total) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 279 | `        baseCost = getBuyPrice(tokenAmount);` | — | https://docs.acki-nacki.org/solidity |
| 280 | `        fee = uint128(uint256(baseCost) * getTradeFeeBps() / 10000);` | — | https://docs.acki-nacki.org/solidity |
| 281 | `        total = baseCost + fee;` | — | https://docs.acki-nacki.org/solidity |
| 282 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 283 | `` | — | https://docs.acki-nacki.org/solidity |
| 284 | `    /// @notice Returns the sell return AFTER deducting the fee.` | — | https://docs.acki-nacki.org/solidity |
| 285 | `    function getSellReturnAfterFee(uint256 tokenAmount) public view returns (uint128 grossReturn, uint128 fee, uint128 netReturn) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 286 | `        grossReturn = uint128(getSellReturn(tokenAmount));` | — | https://docs.acki-nacki.org/solidity |
| 287 | `        fee = uint128(uint256(grossReturn) * getTradeFeeBps() / 10000);` | — | https://docs.acki-nacki.org/solidity |
| 288 | `        netReturn = grossReturn - fee;` | — | https://docs.acki-nacki.org/solidity |
| 289 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 290 | `` | — | https://docs.acki-nacki.org/solidity |
| 291 | `    // ─── Configuration ───────────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 292 | `    // Fix: auth via msg.sender == owner (internal message from owner's wallet)` | — | https://docs.acki-nacki.org/solidity |
| 293 | `    // instead of msg.pubkey() which only works for external messages.` | — | https://docs.acki-nacki.org/solidity |
| 294 | `    // Browser wallets (EVER Wallet, etc.) send internal messages where msg.pubkey() == 0.` | — | https://docs.acki-nacki.org/solidity |
| 295 | `    // C-01: Removed tvm.accept() — this is an internal message function (msg.sender check).` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 296 | `    // H-02: Added whenNotPaused — platform can halt migration during emergencies.` | — | https://docs.acki-nacki.org/solidity |
| 297 | `    // M-06: Added mandatory delay after threshold is reached to prevent timing manipulation` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 298 | `    function forceAmmMigration() public whenNotPaused {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 299 | `        require(msg.sender == owner, 102, "Only owner can force AMM");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 300 | `        require(!pumpForever, 114, "Pump Forever mode is active");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 301 | `        require(reserveBalance >= MIGRATION_THRESHOLD_SHELL_NANO, 108, "Threshold not reached");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 302 | `        require(!isAmm, 109, "Already migrated to AMM");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 303 | `        require(thresholdReachedAt > 0, 231, "Threshold timestamp not recorded");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 304 | `        require(block.timestamp >= thresholdReachedAt + FORCE_MIGRATION_DELAY, 232, "Must wait after threshold before forcing migration");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 305 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 306 | `        _migrateToAmm();` | — | https://docs.acki-nacki.org/solidity |
| 307 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 308 | `` | — | https://docs.acki-nacki.org/solidity |
| 309 | `    // H-02: Removed _ensureExecutionGas since gas is handled via tvm.accept() and DappConfig.` | — | https://docs.acki-nacki.org/solidity |
| 310 | `` | — | https://docs.acki-nacki.org/solidity |
| 311 | `    // ─── C-02: Buy via msg.currencies[2] (SHELL ECC cross-DappID) ────────────` | — | https://docs.acki-nacki.org/solidity |
| 312 | `    // Users send SHELL as Extra Currency (cc[2]) in internal messages.` | — | https://docs.acki-nacki.org/solidity |
| 313 | `    // This works both intra-DappID and cross-DappID, enabling universal composability.` | — | https://docs.acki-nacki.org/solidity |
| 314 | `    // msg.value (VMSHELL) is used ONLY for gas, not as payment.` | — | https://docs.acki-nacki.org/solidity |
| 315 | `    // Trade fee: 1% total (0.7% platform + 0.3% creator).` | — | https://docs.acki-nacki.org/solidity |
| 316 | `    function buy(uint256 tokenAmount, uint256 maxShellIn) public whenNotPaused {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 317 | `        require(!isAmm, 250, "BondingCurve trading ended. Use AckiSwap!");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 318 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 319 | `        // V-AM-01: Reject transactions that accidentally/maliciously include NACKL or USDC` | — | https://docs.acki-nacki.org/solidity |
| 320 | `        // instead of SHELL. Without this check, a confusion attack could credit the` | — | https://docs.acki-nacki.org/solidity |
| 321 | `        // buyer with tokens while the BondingCurve receives the wrong ECC currency.` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 322 | `        require(uint256(msg.currencies[NACKL_CURRENCY_ID]) == 0, 217, "NACKL not accepted. Send SHELL (ECC ID=2)");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 323 | `        require(uint256(msg.currencies[USDC_CURRENCY_ID]) == 0, 218, "USDC not accepted. Send SHELL (ECC ID=2)");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 324 | `` | — | https://docs.acki-nacki.org/solidity |
| 325 | `        // H-01: Anti-sniper cooldown — prevents rapid-fire buys from same address` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 326 | `        require(block.timestamp >= lastBuyTimestamp[msg.sender] + BUY_COOLDOWN, 226, "Buy cooldown active: wait before buying again");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 327 | `        lastBuyTimestamp[msg.sender] = uint32(block.timestamp);` | — | https://docs.acki-nacki.org/solidity |
| 328 | `` | — | https://docs.acki-nacki.org/solidity |
| 329 | `        // M-01: Minimum buy amount to prevent dust attacks` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 330 | `        require(tokenAmount >= MIN_BUY_AMOUNT, 228, "Below minimum buy amount");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 331 | `` | — | https://docs.acki-nacki.org/solidity |
| 332 | `        // Note: internal AMM means trading continues normally on this same contract!` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 333 | `        require(tokenAmount > 0, 202, "Amount must be greater than zero");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 334 | `        require(tokenAmount <= maxBuyPerTx(), 205, "Amount exceeds max buy limit");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 335 | `        require(totalSupply + tokenAmount <= _supplyCap, 206, "Exceeds total supply cap");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 336 | `` | — | https://docs.acki-nacki.org/solidity |
| 337 | `        // C-02: Read SHELL payment from Extra Currencies map (cc[2])` | — | https://docs.acki-nacki.org/solidity |
| 338 | `        // This is the canonical cross-DappID payment method in Acki Nacki.` | — | https://docs.acki-nacki.org/solidity |
| 339 | `        // Unlike msg.value (VMSHELL), cc tokens are NOT zeroed across DappIDs.` | — | https://docs.acki-nacki.org/solidity |
| 340 | `        varuint32 shellReceived = msg.currencies[SHELL_CURRENCY_ID];` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 341 | `        uint256 receivedShell = uint256(shellReceived);` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 342 | `` | — | https://docs.acki-nacki.org/solidity |
| 343 | `        uint256 cost = getBuyPrice(tokenAmount);` | — | https://docs.acki-nacki.org/solidity |
| 344 | `        require(cost > 0, 211, "Purchase amount too small, cost rounds to zero");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 345 | `` | — | https://docs.acki-nacki.org/solidity |
| 346 | `        // ─── Trade Fee: Platform + Creator ─────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 347 | `        uint256 platformFee = cost * getPlatformFeeBps() / 10000;` | — | https://docs.acki-nacki.org/solidity |
| 348 | `        uint256 creatorFee = cost * getCreatorFeeBps() / 10000;` | — | https://docs.acki-nacki.org/solidity |
| 349 | `        uint256 mintGasShell = 6 * 10**9; // 6 SHELL for AFT deploy` | — | https://docs.acki-nacki.org/solidity |
| 350 | `        uint256 totalCostWithFeeAndGas = cost + platformFee + creatorFee + mintGasShell;` | — | https://docs.acki-nacki.org/solidity |
| 351 | `` | — | https://docs.acki-nacki.org/solidity |
| 352 | `        // C-03: Convert some of the Extra Currency (SHELL) silently to execution gas (VMSHELL)` | — | https://docs.acki-nacki.org/solidity |
| 353 | `        uint256 gasToConvert = getGasToConvert();` | — | https://docs.acki-nacki.org/solidity |
| 354 | `        require(receivedShell >= totalCostWithFeeAndGas + gasToConvert, 203, "Insufficient SHELL sent (cost + fee + gas + gasConversion)");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 355 | `        require(totalCostWithFeeAndGas + gasToConvert <= maxShellIn, 208, "Slippage protection triggered");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 356 | `        gosh.cnvrtshellq(uint64(gasToConvert));` | — | https://docs.acki-nacki.org/solidity |
| 357 | `` | — | https://docs.acki-nacki.org/solidity |
| 358 | `        // Update state — only base cost goes to reserve (fee is separate)` | — | https://docs.acki-nacki.org/solidity |
| 359 | `        totalSupply += tokenAmount;` | — | https://docs.acki-nacki.org/solidity |
| 360 | `        reserveBalance += cost;` | — | https://docs.acki-nacki.org/solidity |
| 361 | `` | — | https://docs.acki-nacki.org/solidity |
| 362 | `        uint32 nonce = ++_mintSeqno;` | — | https://docs.acki-nacki.org/solidity |
| 363 | `        // C-03: Prevent nonce collision with pending operations from past overflows` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 364 | `        require(mintIdToBuyer[nonce] == address(0), 225, "Nonce collision detected - retry");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 365 | `        mintIdToBuyer[nonce] = msg.sender;` | — | https://docs.acki-nacki.org/solidity |
| 366 | `        pendingReserveByNonce[nonce] = cost;` | — | https://docs.acki-nacki.org/solidity |
| 367 | `        pendingTokensByNonce[nonce] = tokenAmount;` | — | https://docs.acki-nacki.org/solidity |
| 368 | `` | — | https://docs.acki-nacki.org/solidity |
| 369 | `        emit TokensPurchaseInitiated(msg.sender, cost, tokenAmount, currentPrice());` | — | https://docs.acki-nacki.org/solidity |
| 370 | `` | — | https://docs.acki-nacki.org/solidity |
| 371 | `        // Mint memecoins to buyer via internal message` | — | https://docs.acki-nacki.org/solidity |
| 372 | `        mapping(uint32 => varuint32) mintCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 373 | `        mintCc[SHELL_CURRENCY_ID] = varuint32(mintGasShell);` | — | https://docs.acki-nacki.org/solidity |
| 374 | `` | — | https://docs.acki-nacki.org/solidity |
| 375 | `        IAFTRootAdmin(_tokenRoot).mint{ value: 0.1 ton, currencies: mintCc, flag: 1 }(` | — | https://docs.acki-nacki.org/solidity |
| 376 | `            nonce,` | — | https://docs.acki-nacki.org/solidity |
| 377 | `            msg.sender,` | — | https://docs.acki-nacki.org/solidity |
| 378 | `            uint128(tokenAmount),` | — | https://docs.acki-nacki.org/solidity |
| 379 | `            address(this), // responseDestination is BondingCurve` | — | https://docs.acki-nacki.org/solidity |
| 380 | `            0,` | — | https://docs.acki-nacki.org/solidity |
| 381 | `            TvmCell()` | — | https://docs.acki-nacki.org/solidity |
| 382 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 383 | `` | — | https://docs.acki-nacki.org/solidity |
| 384 | `        // H-33: Hold fees in escrow until minting is confirmed via onAFTExcesses.` | — | https://docs.acki-nacki.org/solidity |
| 385 | `        pendingPlatformFeeByNonce[nonce] = platformFee;` | — | https://docs.acki-nacki.org/solidity |
| 386 | `        pendingCreatorFeeByNonce[nonce] = creatorFee;` | — | https://docs.acki-nacki.org/solidity |
| 387 | `` | — | https://docs.acki-nacki.org/solidity |
| 388 | `        // Refund immediate excess SHELL (Extra Currency) back to buyer` | — | https://docs.acki-nacki.org/solidity |
| 389 | `        uint256 totalRequired = totalCostWithFeeAndGas + gasToConvert;` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 390 | `        uint256 immediateExcess = receivedShell > totalRequired ? receivedShell - totalRequired : 0;` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 391 | `        if (immediateExcess > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 392 | `            mapping(uint32 => varuint32) refundCurrencies;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 393 | `            refundCurrencies[SHELL_CURRENCY_ID] = varuint32(immediateExcess);` | — | https://docs.acki-nacki.org/solidity |
| 394 | `            msg.sender.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: refundCurrencies });` | — | https://docs.acki-nacki.org/solidity |
| 395 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 396 | `` | — | https://docs.acki-nacki.org/solidity |
| 397 | `        // Check if we reached the migration threshold and aren't AMM yet` | — | https://docs.acki-nacki.org/solidity |
| 398 | `        if (!pumpForever && reserveBalance >= MIGRATION_THRESHOLD_SHELL_NANO && !isAmm) {` | — | https://docs.acki-nacki.org/solidity |
| 399 | `            if (thresholdReachedAt == 0) {` | — | https://docs.acki-nacki.org/solidity |
| 400 | `                thresholdReachedAt = uint32(block.timestamp);` | — | https://docs.acki-nacki.org/solidity |
| 401 | `            }` | — | https://docs.acki-nacki.org/solidity |
| 402 | `            _migrateToAmm();` | — | https://docs.acki-nacki.org/solidity |
| 403 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 404 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 405 | `` | — | https://docs.acki-nacki.org/solidity |
| 406 | `    // ─── Receiver for async burns (Sell) ─────────────────────────────────────` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 407 | `    // Called by our own AFTWallet after user transfers tokens to us.` | — | https://docs.acki-nacki.org/solidity |
| 408 | `    // Trade fee: 1% total (0.7% platform + 0.3% creator).` | — | https://docs.acki-nacki.org/solidity |
| 409 | `    function onAFTTransfer(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 410 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 411 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 412 | `        address sender,` | — | https://docs.acki-nacki.org/solidity |
| 413 | `        TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 414 | `    ) external override whenNotPaused nonReentrant functionID(0x7362d09c) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 415 | `        require(!isAmm, 250, "BondingCurve trading ended. Use AckiSwap!");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 416 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 417 | `        require(myAftWallet != address(0), 235, "AFT Wallet not initialized yet");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 418 | `        require(msg.sender == myAftWallet, 103, "Only my AFT Wallet can notify transfer");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 419 | `` | — | https://docs.acki-nacki.org/solidity |
| 420 | `        // Parse minShellOut from forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 421 | `        TvmSlice s = forwardPayload.toSlice();` | — | https://docs.acki-nacki.org/solidity |
| 422 | `        uint128 minShellOut = 0;` | — | https://docs.acki-nacki.org/solidity |
| 423 | `        if (s.bits() >= 128) {` | — | https://docs.acki-nacki.org/solidity |
| 424 | `            minShellOut = s.load(uint128);` | — | https://docs.acki-nacki.org/solidity |
| 425 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 426 | `` | — | https://docs.acki-nacki.org/solidity |
| 427 | `        // Audit #3: Anti-rug Creator Lock was dead code since isAmm is false here.` | — | https://docs.acki-nacki.org/solidity |
| 428 | `        // Creator lock should be implemented in a dedicated Vesting contract.` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 429 | `` | — | https://docs.acki-nacki.org/solidity |
| 430 | `        require(amount <= maxSellPerTx(), 222, "Amount exceeds max sell limit");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 431 | `` | — | https://docs.acki-nacki.org/solidity |
| 432 | `        uint256 grossReturn = getSellReturn(amount);` | — | https://docs.acki-nacki.org/solidity |
| 433 | `        require(grossReturn > 0, 216, "Sell amount too small, return rounds to zero");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 434 | `        require(reserveBalance >= grossReturn, 204, "Insufficient reserve for sell");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 435 | `` | — | https://docs.acki-nacki.org/solidity |
| 436 | `        uint256 platformFee = grossReturn * getPlatformFeeBps() / 10000;` | — | https://docs.acki-nacki.org/solidity |
| 437 | `        uint256 creatorFee = grossReturn * getCreatorFeeBps() / 10000;` | — | https://docs.acki-nacki.org/solidity |
| 438 | `        uint256 netReturn = grossReturn - platformFee - creatorFee;` | — | https://docs.acki-nacki.org/solidity |
| 439 | `` | — | https://docs.acki-nacki.org/solidity |
| 440 | `        require(netReturn >= minShellOut, 208, "Slippage protection triggered: netReturn < minShellOut");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 441 | `` | — | https://docs.acki-nacki.org/solidity |
| 442 | `        // Decrease local supply. We will burn the tokens on our AFTWallet.` | — | https://docs.acki-nacki.org/solidity |
| 443 | `        totalSupply -= amount;` | — | https://docs.acki-nacki.org/solidity |
| 444 | `        reserveBalance -= grossReturn;` | — | https://docs.acki-nacki.org/solidity |
| 445 | `` | — | https://docs.acki-nacki.org/solidity |
| 446 | `        emit TokensSold(sender, amount, netReturn, currentPrice());` | — | https://docs.acki-nacki.org/solidity |
| 447 | `` | — | https://docs.acki-nacki.org/solidity |
| 448 | `        // Send platform fee` | — | https://docs.acki-nacki.org/solidity |
| 449 | `        if (platformFee > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 450 | `            mapping(uint32 => varuint32) feeCurrencies;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 451 | `            feeCurrencies[SHELL_CURRENCY_ID] = varuint32(platformFee);` | — | https://docs.acki-nacki.org/solidity |
| 452 | `            feeRecipient.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: feeCurrencies });` | — | https://docs.acki-nacki.org/solidity |
| 453 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 454 | `` | — | https://docs.acki-nacki.org/solidity |
| 455 | `        // Send creator fee` | — | https://docs.acki-nacki.org/solidity |
| 456 | `        if (creatorFee > 0 && owner != address(0)) {` | — | https://docs.acki-nacki.org/solidity |
| 457 | `            mapping(uint32 => varuint32) creatorCurrencies;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 458 | `            creatorCurrencies[SHELL_CURRENCY_ID] = varuint32(creatorFee);` | — | https://docs.acki-nacki.org/solidity |
| 459 | `            owner.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: creatorCurrencies });` | — | https://docs.acki-nacki.org/solidity |
| 460 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 461 | `` | — | https://docs.acki-nacki.org/solidity |
| 462 | `        tvm.rawReserve(0, 4); // Keep original balance for contract survival` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 463 | `` | — | https://docs.acki-nacki.org/solidity |
| 464 | `        uint256 burnGasShell = 2 * 10**9;` | — | https://docs.acki-nacki.org/solidity |
| 465 | `` | — | https://docs.acki-nacki.org/solidity |
| 466 | `        // Payout to user` | — | https://docs.acki-nacki.org/solidity |
| 467 | `        mapping(uint32 => varuint32) payoutCurrencies;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 468 | `        payoutCurrencies[SHELL_CURRENCY_ID] = varuint32(netReturn);` | — | https://docs.acki-nacki.org/solidity |
| 469 | `` | — | https://docs.acki-nacki.org/solidity |
| 470 | `        // Call burn on our wallet to destroy the tokens (AFTRoot will decrease its totalSupply)` | — | https://docs.acki-nacki.org/solidity |
| 471 | `        mapping(uint32 => varuint32) burnCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 472 | `        burnCc[SHELL_CURRENCY_ID] = varuint32(burnGasShell);` | — | https://docs.acki-nacki.org/solidity |
| 473 | `        IAFTWallet(myAftWallet).burn{ value: 0.05 ton, currencies: burnCc, flag: 1 }(` | — | https://docs.acki-nacki.org/solidity |
| 474 | `            queryId,` | — | https://docs.acki-nacki.org/solidity |
| 475 | `            amount,` | — | https://docs.acki-nacki.org/solidity |
| 476 | `            address(this), // responseDestination` | — | https://docs.acki-nacki.org/solidity |
| 477 | `            TvmCell()` | — | https://docs.acki-nacki.org/solidity |
| 478 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 479 | `` | — | https://docs.acki-nacki.org/solidity |
| 480 | `        sender.transfer({ value: 0, flag: 128, bounce: false, currencies: payoutCurrencies });` | — | https://docs.acki-nacki.org/solidity |
| 481 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 482 | `` | — | https://docs.acki-nacki.org/solidity |
| 483 | `    // Called by TokenRoot when wallet deployment or receiveTokens fails after` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 484 | `    // TokenRoot.mint has already accepted the mint request.` | — | https://docs.acki-nacki.org/solidity |
| 485 | `    function onAFTExcesses(uint64 queryId) external override functionID(0xd53276db) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 486 | `        require(msg.sender == _tokenRoot, 102);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 487 | `        uint32 nonce = uint32(queryId);` | — | https://docs.acki-nacki.org/solidity |
| 488 | `        address buyer = mintIdToBuyer[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 489 | `        if (buyer == address(0)) return; // not a tracked mint` | — | https://docs.acki-nacki.org/solidity |
| 490 | `` | — | https://docs.acki-nacki.org/solidity |
| 491 | `        uint256 platformFee = pendingPlatformFeeByNonce[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 492 | `        uint256 creatorFee = pendingCreatorFeeByNonce[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 493 | `` | — | https://docs.acki-nacki.org/solidity |
| 494 | `        if (platformFee > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 495 | `            mapping(uint32 => varuint32) feeCurrencies;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 496 | `            feeCurrencies[SHELL_CURRENCY_ID] = varuint32(platformFee);` | — | https://docs.acki-nacki.org/solidity |
| 497 | `            feeRecipient.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: feeCurrencies });` | — | https://docs.acki-nacki.org/solidity |
| 498 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 499 | `` | — | https://docs.acki-nacki.org/solidity |
| 500 | `        if (creatorFee > 0 && owner != address(0)) {` | — | https://docs.acki-nacki.org/solidity |
| 501 | `            mapping(uint32 => varuint32) creatorCurrencies;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 502 | `            creatorCurrencies[SHELL_CURRENCY_ID] = varuint32(creatorFee);` | — | https://docs.acki-nacki.org/solidity |
| 503 | `            owner.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: creatorCurrencies });` | — | https://docs.acki-nacki.org/solidity |
| 504 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 505 | `` | — | https://docs.acki-nacki.org/solidity |
| 506 | `` | — | https://docs.acki-nacki.org/solidity |
| 507 | `` | — | https://docs.acki-nacki.org/solidity |
| 508 | `        // Forward excess SHELL received from AFTWallet back to the buyer` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 509 | `        uint256 returnedShell = uint256(msg.currencies[SHELL_CURRENCY_ID]);` | — | https://docs.acki-nacki.org/solidity |
| 510 | `        if (returnedShell > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 511 | `            mapping(uint32 => varuint32) refundCurrencies;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 512 | `            refundCurrencies[SHELL_CURRENCY_ID] = varuint32(returnedShell);` | — | https://docs.acki-nacki.org/solidity |
| 513 | `            buyer.transfer({value: 0.05 ton, flag: 1, bounce: false, currencies: refundCurrencies});` | — | https://docs.acki-nacki.org/solidity |
| 514 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 515 | `` | — | https://docs.acki-nacki.org/solidity |
| 516 | `        _clearMint(nonce);` | — | https://docs.acki-nacki.org/solidity |
| 517 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 518 | `` | — | https://docs.acki-nacki.org/solidity |
| 519 | `    // ─── AMM Migration ───────────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 520 | `    function _migrateToAmm() private {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 521 | `        uint128 liquidityToMove = uint128(reserveBalance);` | — | https://docs.acki-nacki.org/solidity |
| 522 | `        require(_supplyCap - totalSupply <= MAX_UINT128, 210, "tokensToMove overflow");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 523 | `` | — | https://docs.acki-nacki.org/solidity |
| 524 | `        // Setup initial x*y=k invariant` | — | https://docs.acki-nacki.org/solidity |
| 525 | `        uint256 tokenPool = _supplyCap - totalSupply;` | — | https://docs.acki-nacki.org/solidity |
| 526 | `        require(reserveBalance == 0 \|\| tokenPool <= MAX_UINT128 / reserveBalance, 224, "AMM invariant overflow");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 527 | `` | — | https://docs.acki-nacki.org/solidity |
| 528 | `        require(ammFactory != address(0), 225, "Factory not set");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 529 | `        IAckiSwapFactory(ammFactory).deployPair{value: 2000000000, bounce: true, flag: 1}(` | — | https://docs.acki-nacki.org/solidity |
| 530 | `            _tokenRoot,` | — | https://docs.acki-nacki.org/solidity |
| 531 | `            address(this)` | — | https://docs.acki-nacki.org/solidity |
| 532 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 533 | `` | — | https://docs.acki-nacki.org/solidity |
| 534 | `        emit FeeReduced(getTradeFeeBps());` | — | https://docs.acki-nacki.org/solidity |
| 535 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 536 | `` | — | https://docs.acki-nacki.org/solidity |
| 537 | `    function onPairDeployed(address pair) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 538 | `        require(msg.sender == ammFactory, 103, "Only factory");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 539 | `        // R7-C1: the AMM factory lives in another Dapp ID — msg.value arrives` | — | https://docs.acki-nacki.org/solidity |
| 540 | `        // zeroed cross-dapp, so execution gas must come from our own balance.` | — | https://docs.acki-nacki.org/solidity |
| 541 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 542 | `        isAmm = true;` | — | https://docs.acki-nacki.org/solidity |
| 543 | `        migratedAt = uint32(block.timestamp);` | — | https://docs.acki-nacki.org/solidity |
| 544 | `        ammPairAddress = pair;` | — | https://docs.acki-nacki.org/solidity |
| 545 | `` | — | https://docs.acki-nacki.org/solidity |
| 546 | `        emit MigratedToInternalAmm(uint128(reserveBalance), migratedAt);` | — | https://docs.acki-nacki.org/solidity |
| 547 | `` | — | https://docs.acki-nacki.org/solidity |
| 548 | `        // 1. Initialize Pair's Wallet Discovery` | — | https://docs.acki-nacki.org/solidity |
| 549 | `        mapping(uint32 => varuint32) ccInit;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 550 | `        ccInit[SHELL_CURRENCY_ID] = varuint32(2_500_000_000); // 2.5 SHELL` | — | https://docs.acki-nacki.org/solidity |
| 551 | `        IAckiSwapPair(pair).initAftWallet{value: 0.5 ton, currencies: ccInit, flag: 1}();` | — | https://docs.acki-nacki.org/solidity |
| 552 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 553 | `` | — | https://docs.acki-nacki.org/solidity |
| 554 | `    function onPairReady() external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 555 | `        require(msg.sender == ammPairAddress, 103, "Only pair");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 556 | `        require(!liquiditySent, 237, "Liquidity already sent");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 557 | `        // R7-C1: cross-Dapp-ID callback — msg.value arrives zeroed; self-fund.` | — | https://docs.acki-nacki.org/solidity |
| 558 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 559 | `        liquiditySent = true;` | — | https://docs.acki-nacki.org/solidity |
| 560 | `` | — | https://docs.acki-nacki.org/solidity |
| 561 | `        // Hold back a slice of the SHELL as fuel: 2.5 already spent on the` | — | https://docs.acki-nacki.org/solidity |
| 562 | `        // discovery in onPairDeployed + 8 attached to the token transfer below.` | — | https://docs.acki-nacki.org/solidity |
| 563 | `        require(reserveBalance > uint256(MIGRATION_GAS_RESERVE_SHELL), 238, "Reserve too small to migrate");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 564 | `        uint128 shellLiquidity = uint128(reserveBalance) - MIGRATION_GAS_RESERVE_SHELL;` | — | https://docs.acki-nacki.org/solidity |
| 565 | `        uint128 tokensToMove = uint128(_supplyCap - totalSupply);` | — | https://docs.acki-nacki.org/solidity |
| 566 | `` | — | https://docs.acki-nacki.org/solidity |
| 567 | `        // 2. Send SHELL liquidity` | — | https://docs.acki-nacki.org/solidity |
| 568 | `        mapping(uint32 => varuint32) ccLiq;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 569 | `        ccLiq[SHELL_CURRENCY_ID] = varuint32(shellLiquidity);` | — | https://docs.acki-nacki.org/solidity |
| 570 | `        IAckiSwapPair(ammPairAddress).provideInitialShell{value: 0.1 ton, currencies: ccLiq, flag: 1}();` | — | https://docs.acki-nacki.org/solidity |
| 571 | `` | — | https://docs.acki-nacki.org/solidity |
| 572 | `        // 3. Send Tokens liquidity — the AFT wallet hops self-fund from the` | — | https://docs.acki-nacki.org/solidity |
| 573 | `        // attached SHELL (entry conversion + cold wallet deploy + notification).` | — | https://docs.acki-nacki.org/solidity |
| 574 | `        TvmBuilder builder;` | — | https://docs.acki-nacki.org/solidity |
| 575 | `        builder.store(uint32(1)); // op = 1 (Add Liquidity)` | — | https://docs.acki-nacki.org/solidity |
| 576 | `        TvmCell payload = builder.toCell();` | — | https://docs.acki-nacki.org/solidity |
| 577 | `        TvmCell empty;` | — | https://docs.acki-nacki.org/solidity |
| 578 | `` | — | https://docs.acki-nacki.org/solidity |
| 579 | `        mapping(uint32 => varuint32) ccGas;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 580 | `        ccGas[SHELL_CURRENCY_ID] = varuint32(MIGRATION_TOKEN_GAS_SHELL);` | — | https://docs.acki-nacki.org/solidity |
| 581 | `        IAFTWallet(myAftWallet).transfer{value: 1 ton, currencies: ccGas, flag: 1}(` | — | https://docs.acki-nacki.org/solidity |
| 582 | `            0,` | — | https://docs.acki-nacki.org/solidity |
| 583 | `            tokensToMove,` | — | https://docs.acki-nacki.org/solidity |
| 584 | `            ammPairAddress, // destinationOwner (Pair)` | — | https://docs.acki-nacki.org/solidity |
| 585 | `            address(this), // responseDestination` | — | https://docs.acki-nacki.org/solidity |
| 586 | `            empty, // customPayload` | — | https://docs.acki-nacki.org/solidity |
| 587 | `            0.5 ton, // forwardShellAmount` | — | https://docs.acki-nacki.org/solidity |
| 588 | `            payload // forwardPayload -> Add Liquidity` | — | https://docs.acki-nacki.org/solidity |
| 589 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 590 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 591 | `` | — | https://docs.acki-nacki.org/solidity |
| 592 | `    function _rollbackMint(uint32 nonce) private {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 593 | `        address buyer = mintIdToBuyer[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 594 | `` | — | https://docs.acki-nacki.org/solidity |
| 595 | `        uint256 refundShell = pendingReserveByNonce[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 596 | `        uint256 refundTokens = pendingTokensByNonce[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 597 | `` | — | https://docs.acki-nacki.org/solidity |
| 598 | `        // H-33: Include pending fees in the refund if minting fails` | — | https://docs.acki-nacki.org/solidity |
| 599 | `        uint256 platformFee = pendingPlatformFeeByNonce[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 600 | `        uint256 creatorFee = pendingCreatorFeeByNonce[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 601 | `        uint256 totalRefund = refundShell + platformFee + creatorFee;` | — | https://docs.acki-nacki.org/solidity |
| 602 | `` | — | https://docs.acki-nacki.org/solidity |
| 603 | `        if (totalRefund > 0 && buyer != address(0)) {` | — | https://docs.acki-nacki.org/solidity |
| 604 | `            // Revert reserve and supply` | — | [revert](https://docs.acki-nacki.org/solidity/revert.html) |
| 605 | `            reserveBalance -= refundShell;` | — | https://docs.acki-nacki.org/solidity |
| 606 | `            totalSupply -= refundTokens;` | — | https://docs.acki-nacki.org/solidity |
| 607 | `` | — | https://docs.acki-nacki.org/solidity |
| 608 | `            // A-11: If reversal drops reserve below migration threshold,` | — | https://docs.acki-nacki.org/solidity |
| 609 | `            // rollback AMM state to prevent corrupted x*y=k invariant` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 610 | `            if (isAmm && reserveBalance < MIGRATION_THRESHOLD_SHELL_NANO) {` | — | https://docs.acki-nacki.org/solidity |
| 611 | `                isAmm = false;` | — | https://docs.acki-nacki.org/solidity |
| 612 | `                migratedAt = 0;` | — | https://docs.acki-nacki.org/solidity |
| 613 | `                thresholdReachedAt = 0; // M-06: Reset threshold timestamp` | — | https://docs.acki-nacki.org/solidity |
| 614 | `            } else if (isAmm) {` | — | https://docs.acki-nacki.org/solidity |
| 615 | `                // Recalculate AMM invariant with corrected values` | — | https://docs.acki-nacki.org/solidity |
| 616 | `            }` | — | https://docs.acki-nacki.org/solidity |
| 617 | `` | — | https://docs.acki-nacki.org/solidity |
| 618 | `            // I-02: Emit rollback event for off-chain indexing` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 619 | `            emit MintRolledBack(nonce, buyer, totalRefund);` | — | https://docs.acki-nacki.org/solidity |
| 620 | `` | — | https://docs.acki-nacki.org/solidity |
| 621 | `            // Refund SHELL via cc[2] to the actual buyer` | — | https://docs.acki-nacki.org/solidity |
| 622 | `            mapping(uint32 => varuint32) refundCurrencies;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 623 | `            refundCurrencies[SHELL_CURRENCY_ID] = varuint32(totalRefund);` | — | https://docs.acki-nacki.org/solidity |
| 624 | `            buyer.transfer({value: 0.05 ton, flag: 1, bounce: false, currencies: refundCurrencies});` | — | https://docs.acki-nacki.org/solidity |
| 625 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 626 | `` | — | https://docs.acki-nacki.org/solidity |
| 627 | `        _clearMint(nonce);` | — | https://docs.acki-nacki.org/solidity |
| 628 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 629 | `` | — | https://docs.acki-nacki.org/solidity |
| 630 | `    function _clearMint(uint32 nonce) private {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 631 | `        delete pendingReserveByNonce[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 632 | `        delete pendingTokensByNonce[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 633 | `        delete pendingPlatformFeeByNonce[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 634 | `        delete pendingCreatorFeeByNonce[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 635 | `        delete mintIdToBuyer[nonce];` | — | https://docs.acki-nacki.org/solidity |
| 636 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 637 | `` | — | https://docs.acki-nacki.org/solidity |
| 638 | `    // ─── R-05: onBounce handler (corrected) ───────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 639 | `    // Direct bounce from ITokenRoot.mint means TokenRoot did not accept the mint.` | — | https://docs.acki-nacki.org/solidity |
| 640 | `    // Later wallet-level failures are reported through onMintFailed().` | — | https://docs.acki-nacki.org/solidity |
| 641 | `    onBounce(TvmSlice body) external {` | — | https://docs.acki-nacki.org/solidity |
| 642 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 643 | `        require(msg.sender == _tokenRoot, 150, "Bounce not from TokenRoot");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 644 | `        if (body.bits() < 64) return;` | — | https://docs.acki-nacki.org/solidity |
| 645 | `` | — | https://docs.acki-nacki.org/solidity |
| 646 | `        uint32 funcId = body.load(uint32);` | — | https://docs.acki-nacki.org/solidity |
| 647 | `` | — | https://docs.acki-nacki.org/solidity |
| 648 | `        if (funcId == 0x2786d61d) { // IAFTRootAdmin.mint` | — | https://docs.acki-nacki.org/solidity |
| 649 | `            uint64 nonce = body.load(uint64);` | — | https://docs.acki-nacki.org/solidity |
| 650 | `            _rollbackMint(uint32(nonce));` | — | https://docs.acki-nacki.org/solidity |
| 651 | `        } else if (funcId == 0x595f07bc) { // IAFTWallet.burn` | — | https://docs.acki-nacki.org/solidity |
| 652 | `            uint64 queryId = body.load(uint64);` | — | https://docs.acki-nacki.org/solidity |
| 653 | `            uint128 amount = body.load(uint128);` | — | https://docs.acki-nacki.org/solidity |
| 654 | `` | — | https://docs.acki-nacki.org/solidity |
| 655 | `            // Note: We do not rollback totalSupply/reserveBalance here because` | — | https://docs.acki-nacki.org/solidity |
| 656 | `            // the SHELL payout was already sent to the user in onAFTTransfer.` | — | https://docs.acki-nacki.org/solidity |
| 657 | `            // Rolling back the state would make the contract insolvent.` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 658 | `            // The tokens remain locked in the BondingCurve's AFTWallet,` | — | https://docs.acki-nacki.org/solidity |
| 659 | `            // effectively acting as burned from circulation.` | — | https://docs.acki-nacki.org/solidity |
| 660 | `            emit BurnFailed(queryId, amount);` | — | https://docs.acki-nacki.org/solidity |
| 661 | `        } else if (funcId == 0x1db1ba02) { // IAckiSwapFactory.deployPair` | — | https://docs.acki-nacki.org/solidity |
| 662 | `            // If deployPair bounces, migration failed (e.g., unauthorized)` | — | https://docs.acki-nacki.org/solidity |
| 663 | `            // isAmm remains false, trading continues on BondingCurve.` | — | https://docs.acki-nacki.org/solidity |
| 664 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 665 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 666 | `` | — | https://docs.acki-nacki.org/solidity |
| 667 | `    // ─── Security Admin ──────────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 668 | `    // Platform-level pause for emergency security interventions` | — | https://docs.acki-nacki.org/solidity |
| 669 | `    function pause() public {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 670 | `        require(msg.sender == feeRecipient, 111, "Only platform (feeRecipient) can pause");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 671 | `        paused = true;` | — | https://docs.acki-nacki.org/solidity |
| 672 | `        emit Paused(msg.sender); // I-02` | — | https://docs.acki-nacki.org/solidity |
| 673 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 674 | `` | — | https://docs.acki-nacki.org/solidity |
| 675 | `    function unpause() public {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 676 | `        require(msg.sender == feeRecipient, 111, "Only platform (feeRecipient) can unpause");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 677 | `        paused = false;` | — | https://docs.acki-nacki.org/solidity |
| 678 | `        emit Unpaused(msg.sender); // I-02` | — | https://docs.acki-nacki.org/solidity |
| 679 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 680 | `` | — | https://docs.acki-nacki.org/solidity |
| 681 | `    // ─── M-03: Rescue excess SHELL stuck in contract ─────────────────────────` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 682 | `    // If SHELL (ECC) accumulates beyond what reserveBalance tracks (e.g. from` | — | https://docs.acki-nacki.org/solidity |
| 683 | `    // rounding or unsolicited transfers), the platform can rescue the surplus.` | — | https://docs.acki-nacki.org/solidity |
| 684 | `    // Only the platform (feeRecipient) can call this, and only the excess is sent.` | — | https://docs.acki-nacki.org/solidity |
| 685 | `    function rescueExcessShell(address to, uint256 amount) public {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 686 | `        require(msg.sender == feeRecipient, 111, "Only platform (feeRecipient) can rescue");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 687 | `        require(to != address(0), 233, "Rescue recipient cannot be zero");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 688 | `` | — | https://docs.acki-nacki.org/solidity |
| 689 | `        uint256 currentBalance = uint256(address(this).currencies[SHELL_CURRENCY_ID]);` | — | https://docs.acki-nacki.org/solidity |
| 690 | `        require(currentBalance > reserveBalance, 234, "No excess shell to rescue");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 691 | `        uint256 excess = currentBalance - reserveBalance;` | — | https://docs.acki-nacki.org/solidity |
| 692 | `        uint256 safeAmount = amount < excess ? amount : excess;` | — | https://docs.acki-nacki.org/solidity |
| 693 | `` | — | https://docs.acki-nacki.org/solidity |
| 694 | `        if (safeAmount > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 695 | `            mapping(uint32 => varuint32) rescueCurrencies;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 696 | `            rescueCurrencies[SHELL_CURRENCY_ID] = varuint32(safeAmount);` | — | https://docs.acki-nacki.org/solidity |
| 697 | `            to.transfer({ value: 0.05 ton, flag: 1, bounce: false, currencies: rescueCurrencies });` | — | https://docs.acki-nacki.org/solidity |
| 698 | `            emit ExcessShellRescued(to, safeAmount);` | — | https://docs.acki-nacki.org/solidity |
| 699 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 700 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 701 | `` | — | https://docs.acki-nacki.org/solidity |
| 702 | `    /// @notice Returns the SHELL gas required for minting` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 703 | `    function getMintGasShell() public pure returns (uint256) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 704 | `        return 6 * 10**9;` | — | https://docs.acki-nacki.org/solidity |
| 705 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 706 | `` | — | https://docs.acki-nacki.org/solidity |
| 707 | `    /// @notice Returns the SHELL gas required for VMSHELL conversion during buys` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 708 | `    function getGasToConvert() public pure returns (uint256) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 709 | `        return 1 ton; // 1 SHELL` | — | https://docs.acki-nacki.org/solidity |
| 710 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 711 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
