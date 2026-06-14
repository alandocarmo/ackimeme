# Audit – USDCShellRouter.sol

*Source: `C:\Users\alanp\ackimeme\contracts\USDCShellRouter.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 2 | `` | — | https://docs.acki-nacki.org/solidity |
| 3 | `pragma AbiHeader expire;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 4 | `pragma AbiHeader pubkey;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 5 | `` | — | https://docs.acki-nacki.org/solidity |
| 6 | `interface IAcceptTokensTransferCallback {` | — | [interfaces](https://docs.acki-nacki.org/solidity/interfaces.html) |
| 7 | `    function onAcceptTokensTransfer(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 8 | `        address tokenRoot,` | — | https://docs.acki-nacki.org/solidity |
| 9 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 10 | `        address sender,` | — | https://docs.acki-nacki.org/solidity |
| 11 | `        address senderWallet,` | — | https://docs.acki-nacki.org/solidity |
| 12 | `        address remainingGasTo,` | — | https://docs.acki-nacki.org/solidity |
| 13 | `        TvmCell payload` | — | https://docs.acki-nacki.org/solidity |
| 14 | `    ) external;` | — | https://docs.acki-nacki.org/solidity |
| 15 | `}` | — | https://docs.acki-nacki.org/solidity |
| 16 | `` | — | https://docs.acki-nacki.org/solidity |
| 17 | `interface ITIP3TokenWallet {` | — | [interfaces](https://docs.acki-nacki.org/solidity/interfaces.html) |
| 18 | `    function transfer(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 19 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 20 | `        address recipient,` | — | https://docs.acki-nacki.org/solidity |
| 21 | `        uint128 deployWalletValue,` | — | https://docs.acki-nacki.org/solidity |
| 22 | `        address remainingGasTo,` | — | https://docs.acki-nacki.org/solidity |
| 23 | `        bool notify,` | — | https://docs.acki-nacki.org/solidity |
| 24 | `        TvmCell payload` | — | https://docs.acki-nacki.org/solidity |
| 25 | `    ) external;` | — | https://docs.acki-nacki.org/solidity |
| 26 | `}` | — | https://docs.acki-nacki.org/solidity |
| 27 | `` | — | https://docs.acki-nacki.org/solidity |
| 28 | `contract USDCShellRouter is IAcceptTokensTransferCallback {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 29 | `    // ─── Static vars (immutable, define contract address) ────────────────────` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 30 | `    address public static owner;` | — | https://docs.acki-nacki.org/solidity |
| 31 | `    address public static usdcRoot;` | — | https://docs.acki-nacki.org/solidity |
| 32 | `    address public static accumulatorAddress;` | — | https://docs.acki-nacki.org/solidity |
| 33 | `` | — | https://docs.acki-nacki.org/solidity |
| 34 | `    // ─── State vars (mutable) ────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 35 | `    // P1-1 FIX: feeWallet moved from static to state so updateFeeWallet() works` | — | https://docs.acki-nacki.org/solidity |
| 36 | `    address public feeWallet;` | — | https://docs.acki-nacki.org/solidity |
| 37 | `    address public routerUsdcWallet;` | — | https://docs.acki-nacki.org/solidity |
| 38 | `    uint16 public feeBps = 100; // 1% = 100 bps` | — | https://docs.acki-nacki.org/solidity |
| 39 | `` | — | https://docs.acki-nacki.org/solidity |
| 40 | `    // H-03: Track pending swaps for bounce refund` | — | https://docs.acki-nacki.org/solidity |
| 41 | `    mapping(address => uint128) public pendingSwapRefunds;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 42 | `` | — | https://docs.acki-nacki.org/solidity |
| 43 | `    // M-07: Timelock for rescue operations` | — | https://docs.acki-nacki.org/solidity |
| 44 | `    uint128 public constant RESCUE_TIMELOCK_THRESHOLD = 10_000_000; // 10 USDC` | — | https://docs.acki-nacki.org/solidity |
| 45 | `    uint32 public constant RESCUE_TIMELOCK_DURATION = 24 hours;` | — | https://docs.acki-nacki.org/solidity |
| 46 | `    struct RescueRequest {` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 47 | `        uint128 amount;` | — | https://docs.acki-nacki.org/solidity |
| 48 | `        address recipient;` | — | https://docs.acki-nacki.org/solidity |
| 49 | `        uint32 requestedAt;` | — | https://docs.acki-nacki.org/solidity |
| 50 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 51 | `    RescueRequest public pendingRescue;` | — | https://docs.acki-nacki.org/solidity |
| 52 | `    event RescueRequested(uint128 amount, address recipient, uint32 executeAfter);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 53 | `    event RescueExecuted(uint128 amount, address recipient);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 54 | `    event RescueCancelled();` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 55 | `` | — | https://docs.acki-nacki.org/solidity |
| 56 | `    // P1-3 FIX: Minimum 1 USDC (6 decimals) to prevent micro-spam` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 57 | `    uint128 public constant MIN_USDC_AMOUNT = 1_000_000;` | — | https://docs.acki-nacki.org/solidity |
| 58 | `` | — | https://docs.acki-nacki.org/solidity |
| 59 | `    event RouterInitialized(address usdcWallet, address feeWallet);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 60 | `    event SwapRouted(address sender, uint128 totalAmount, uint128 feeAmount, uint128 swapAmount);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 61 | `    event BounceRefund(address sender, uint128 amount);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 62 | `    event FeeUpdated(uint16 newFeeBps);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 63 | `    event FeeWalletUpdated(address newFeeWallet);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 64 | `` | — | https://docs.acki-nacki.org/solidity |
| 65 | `    // P1-1 FIX: feeWallet is now a constructor param instead of static` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 66 | `    constructor(address _routerUsdcWallet, address _feeWallet) {` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 67 | `        require(tvm.pubkey() == msg.pubkey(), 100, "Only deployer pubkey");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 68 | `        require(_feeWallet != address(0), 105, "Fee wallet cannot be zero");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 69 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 70 | `        routerUsdcWallet = _routerUsdcWallet;` | — | https://docs.acki-nacki.org/solidity |
| 71 | `        feeWallet = _feeWallet;` | — | https://docs.acki-nacki.org/solidity |
| 72 | `        emit RouterInitialized(_routerUsdcWallet, _feeWallet);` | — | https://docs.acki-nacki.org/solidity |
| 73 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 74 | `` | — | https://docs.acki-nacki.org/solidity |
| 75 | `    function onAcceptTokensTransfer(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 76 | `        address tokenRoot,` | — | https://docs.acki-nacki.org/solidity |
| 77 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 78 | `        address sender,` | — | https://docs.acki-nacki.org/solidity |
| 79 | `        address /* senderWallet */,` | — | https://docs.acki-nacki.org/solidity |
| 80 | `        address remainingGasTo,` | — | https://docs.acki-nacki.org/solidity |
| 81 | `        TvmCell payload` | — | https://docs.acki-nacki.org/solidity |
| 82 | `    ) external override {` | — | https://docs.acki-nacki.org/solidity |
| 83 | `        // Only accept transfers from our registered USDC wallet` | — | https://docs.acki-nacki.org/solidity |
| 84 | `        require(msg.sender == routerUsdcWallet, 101, "Only router USDC wallet");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 85 | `        require(tokenRoot == usdcRoot, 102, "Invalid token root");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 86 | `` | — | https://docs.acki-nacki.org/solidity |
| 87 | `        // P1-3 FIX: Reject micro-transactions that waste gas` | — | https://docs.acki-nacki.org/solidity |
| 88 | `        require(amount >= MIN_USDC_AMOUNT, 106, "Amount below minimum (1 USDC)");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 89 | `` | — | https://docs.acki-nacki.org/solidity |
| 90 | `        // P1-4 FIX: Use mode 4 (reserve original balance) to prevent underflow` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 91 | `        tvm.rawReserve(0, 4);` | — | https://docs.acki-nacki.org/solidity |
| 92 | `` | — | https://docs.acki-nacki.org/solidity |
| 93 | `        uint128 feeAmount = (amount * feeBps) / 10000;` | — | https://docs.acki-nacki.org/solidity |
| 94 | `        uint128 swapAmount = amount - feeAmount;` | — | https://docs.acki-nacki.org/solidity |
| 95 | `` | — | https://docs.acki-nacki.org/solidity |
| 96 | `        emit SwapRouted(sender, amount, feeAmount, swapAmount);` | — | https://docs.acki-nacki.org/solidity |
| 97 | `` | — | https://docs.acki-nacki.org/solidity |
| 98 | `        // 1. Send fee to FEE_WALLET` | — | https://docs.acki-nacki.org/solidity |
| 99 | `        if (feeAmount > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 100 | `            TvmCell emptyPayload;` | — | https://docs.acki-nacki.org/solidity |
| 101 | `            ITIP3TokenWallet(routerUsdcWallet).transfer{value: 0.1 ever, flag: 0}(` | — | https://docs.acki-nacki.org/solidity |
| 102 | `                feeAmount,` | — | https://docs.acki-nacki.org/solidity |
| 103 | `                feeWallet,` | — | https://docs.acki-nacki.org/solidity |
| 104 | `                0.1 ever,` | — | https://docs.acki-nacki.org/solidity |
| 105 | `                remainingGasTo,` | — | https://docs.acki-nacki.org/solidity |
| 106 | `                false,` | — | https://docs.acki-nacki.org/solidity |
| 107 | `                emptyPayload` | — | https://docs.acki-nacki.org/solidity |
| 108 | `            );` | — | https://docs.acki-nacki.org/solidity |
| 109 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 110 | `` | — | https://docs.acki-nacki.org/solidity |
| 111 | `        // H-03: Track pending swap for bounce recovery` | — | https://docs.acki-nacki.org/solidity |
| 112 | `        pendingSwapRefunds[sender] += swapAmount;` | — | https://docs.acki-nacki.org/solidity |
| 113 | `` | — | https://docs.acki-nacki.org/solidity |
| 114 | `        // 2. Send the rest to Accumulator` | — | https://docs.acki-nacki.org/solidity |
| 115 | `        if (swapAmount > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 116 | `            ITIP3TokenWallet(routerUsdcWallet).transfer{value: 0, flag: 128}(` | — | https://docs.acki-nacki.org/solidity |
| 117 | `                swapAmount,` | — | https://docs.acki-nacki.org/solidity |
| 118 | `                accumulatorAddress,` | — | https://docs.acki-nacki.org/solidity |
| 119 | `                0.1 ever,` | — | https://docs.acki-nacki.org/solidity |
| 120 | `                remainingGasTo,` | — | https://docs.acki-nacki.org/solidity |
| 121 | `                true,` | — | https://docs.acki-nacki.org/solidity |
| 122 | `                payload` | — | https://docs.acki-nacki.org/solidity |
| 123 | `            );` | — | https://docs.acki-nacki.org/solidity |
| 124 | `        } else {` | — | https://docs.acki-nacki.org/solidity |
| 125 | `            remainingGasTo.transfer({value: 0, flag: 128});` | — | https://docs.acki-nacki.org/solidity |
| 126 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 127 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 128 | `` | — | https://docs.acki-nacki.org/solidity |
| 129 | `    // H-03: onBounce handler to track failed transfers for admin recovery` | — | https://docs.acki-nacki.org/solidity |
| 130 | `    onBounce(TvmSlice body) external {` | — | https://docs.acki-nacki.org/solidity |
| 131 | `        if (body.bits() < 32) {` | — | https://docs.acki-nacki.org/solidity |
| 132 | `            return;` | — | https://docs.acki-nacki.org/solidity |
| 133 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 134 | `        uint32 funcId = body.load(uint32);` | — | https://docs.acki-nacki.org/solidity |
| 135 | `        // If a transfer to Accumulator bounced, funds remain in router wallet` | — | https://docs.acki-nacki.org/solidity |
| 136 | `        // Emit event for off-chain monitoring and admin recovery via rescueTokens` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 137 | `        if (funcId == abi.functionId(ITIP3TokenWallet.transfer)) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 138 | `            emit BounceRefund(msg.sender, 0);` | — | https://docs.acki-nacki.org/solidity |
| 139 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 140 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 141 | `` | — | https://docs.acki-nacki.org/solidity |
| 142 | `    // ─── Admin functions ─────────────────────────────────────────────────────` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 143 | `    // P1-2 FIX: Use msg.pubkey() for external message auth (consistent with TVM pattern)` | — | https://docs.acki-nacki.org/solidity |
| 144 | `    function setFeeBps(uint16 _feeBps) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 145 | `        require(msg.pubkey() == tvm.pubkey(), 103, "Not authorized");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 146 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 147 | `        require(_feeBps <= 1000, 104, "Max fee is 10%");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 148 | `        feeBps = _feeBps;` | — | https://docs.acki-nacki.org/solidity |
| 149 | `        emit FeeUpdated(_feeBps);` | — | https://docs.acki-nacki.org/solidity |
| 150 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 151 | `` | — | https://docs.acki-nacki.org/solidity |
| 152 | `    // P1-1 FIX: This now actually works because feeWallet is a state var` | — | https://docs.acki-nacki.org/solidity |
| 153 | `    function updateFeeWallet(address _feeWallet) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 154 | `        require(msg.pubkey() == tvm.pubkey(), 103, "Not authorized");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 155 | `        require(_feeWallet != address(0), 105, "Fee wallet cannot be zero");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 156 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 157 | `        feeWallet = _feeWallet;` | — | https://docs.acki-nacki.org/solidity |
| 158 | `        emit FeeWalletUpdated(_feeWallet);` | — | https://docs.acki-nacki.org/solidity |
| 159 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 160 | `` | — | https://docs.acki-nacki.org/solidity |
| 161 | `    // M-07: Two-step rescue with timelock for large amounts` | — | https://docs.acki-nacki.org/solidity |
| 162 | `    function requestRescue(uint128 amount, address recipient) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 163 | `        require(msg.pubkey() == tvm.pubkey(), 103, "Not authorized");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 164 | `        require(recipient != address(0), 107, "Recipient cannot be zero");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 165 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 166 | `` | — | https://docs.acki-nacki.org/solidity |
| 167 | `        if (amount < RESCUE_TIMELOCK_THRESHOLD) {` | — | https://docs.acki-nacki.org/solidity |
| 168 | `            // Small amounts: immediate rescue` | — | https://docs.acki-nacki.org/solidity |
| 169 | `            TvmCell emptyPayload;` | — | https://docs.acki-nacki.org/solidity |
| 170 | `            ITIP3TokenWallet(routerUsdcWallet).transfer{value: 0.1 ever, flag: 0}(` | — | https://docs.acki-nacki.org/solidity |
| 171 | `                amount,` | — | https://docs.acki-nacki.org/solidity |
| 172 | `                recipient,` | — | https://docs.acki-nacki.org/solidity |
| 173 | `                0.1 ever,` | — | https://docs.acki-nacki.org/solidity |
| 174 | `                recipient,` | — | https://docs.acki-nacki.org/solidity |
| 175 | `                false,` | — | https://docs.acki-nacki.org/solidity |
| 176 | `                emptyPayload` | — | https://docs.acki-nacki.org/solidity |
| 177 | `            );` | — | https://docs.acki-nacki.org/solidity |
| 178 | `            emit RescueExecuted(amount, recipient);` | — | https://docs.acki-nacki.org/solidity |
| 179 | `        } else {` | — | https://docs.acki-nacki.org/solidity |
| 180 | `            // Large amounts: require timelock` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 181 | `            pendingRescue = RescueRequest(amount, recipient, uint32(block.timestamp));` | — | https://docs.acki-nacki.org/solidity |
| 182 | `            emit RescueRequested(amount, recipient, uint32(block.timestamp) + RESCUE_TIMELOCK_DURATION);` | — | https://docs.acki-nacki.org/solidity |
| 183 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 184 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 185 | `` | — | https://docs.acki-nacki.org/solidity |
| 186 | `    function executeRescue() external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 187 | `        require(msg.pubkey() == tvm.pubkey(), 103, "Not authorized");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 188 | `        require(pendingRescue.amount > 0, 108, "No pending rescue");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 189 | `        require(block.timestamp >= pendingRescue.requestedAt + RESCUE_TIMELOCK_DURATION, 109, "Timelock not expired");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 190 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 191 | `` | — | https://docs.acki-nacki.org/solidity |
| 192 | `        TvmCell emptyPayload;` | — | https://docs.acki-nacki.org/solidity |
| 193 | `        ITIP3TokenWallet(routerUsdcWallet).transfer{value: 0.1 ever, flag: 0}(` | — | https://docs.acki-nacki.org/solidity |
| 194 | `            pendingRescue.amount,` | — | https://docs.acki-nacki.org/solidity |
| 195 | `            pendingRescue.recipient,` | — | https://docs.acki-nacki.org/solidity |
| 196 | `            0.1 ever,` | — | https://docs.acki-nacki.org/solidity |
| 197 | `            pendingRescue.recipient,` | — | https://docs.acki-nacki.org/solidity |
| 198 | `            false,` | — | https://docs.acki-nacki.org/solidity |
| 199 | `            emptyPayload` | — | https://docs.acki-nacki.org/solidity |
| 200 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 201 | `        emit RescueExecuted(pendingRescue.amount, pendingRescue.recipient);` | — | https://docs.acki-nacki.org/solidity |
| 202 | `        delete pendingRescue;` | — | https://docs.acki-nacki.org/solidity |
| 203 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 204 | `` | — | https://docs.acki-nacki.org/solidity |
| 205 | `    function cancelRescue() external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 206 | `        require(msg.pubkey() == tvm.pubkey(), 103, "Not authorized");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 207 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 208 | `        delete pendingRescue;` | — | https://docs.acki-nacki.org/solidity |
| 209 | `        emit RescueCancelled();` | — | https://docs.acki-nacki.org/solidity |
| 210 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 211 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
