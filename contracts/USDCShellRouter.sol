pragma tvm-solidity >= 0.76.1;

pragma AbiHeader expire;
pragma AbiHeader pubkey;

interface IAcceptTokensTransferCallback {
    function onAcceptTokensTransfer(
        address tokenRoot,
        uint128 amount,
        address sender,
        address senderWallet,
        address remainingGasTo,
        TvmCell payload
    ) external;
}

interface ITIP3TokenWallet {
    function transfer(
        uint128 amount,
        address recipient,
        uint128 deployWalletValue,
        address remainingGasTo,
        bool notify,
        TvmCell payload
    ) external;
}

contract USDCShellRouter is IAcceptTokensTransferCallback {
    // ─── Static vars (immutable, define contract address) ────────────────────
    address public static owner;
    address public static usdcRoot;
    address public static accumulatorAddress;

    // ─── State vars (mutable) ────────────────────────────────────────────────
    // P1-1 FIX: feeWallet moved from static to state so updateFeeWallet() works
    address public feeWallet;
    address public routerUsdcWallet;
    uint16 public feeBps = 100; // 1% = 100 bps

    // H-03: Track pending swaps for bounce refund
    mapping(address => uint128) public pendingSwapRefunds;

    // M-07: Timelock for rescue operations
    uint128 public constant RESCUE_TIMELOCK_THRESHOLD = 10_000_000; // 10 USDC
    uint32 public constant RESCUE_TIMELOCK_DURATION = 24 hours;
    struct RescueRequest {
        uint128 amount;
        address recipient;
        uint32 requestedAt;
    }
    RescueRequest public pendingRescue;
    event RescueRequested(uint128 amount, address recipient, uint32 executeAfter);
    event RescueExecuted(uint128 amount, address recipient);
    event RescueCancelled();

    // P1-3 FIX: Minimum 1 USDC (6 decimals) to prevent micro-spam
    uint128 public constant MIN_USDC_AMOUNT = 1_000_000;

    event RouterInitialized(address usdcWallet, address feeWallet);
    event SwapRouted(address sender, uint128 totalAmount, uint128 feeAmount, uint128 swapAmount);
    event BounceRefund(address sender, uint128 amount);
    event FeeUpdated(uint16 newFeeBps);
    event FeeWalletUpdated(address newFeeWallet);

    // P1-1 FIX: feeWallet is now a constructor param instead of static
    constructor(address _routerUsdcWallet, address _feeWallet) {
        require(tvm.pubkey() == msg.pubkey(), 100, "Only deployer pubkey");
        require(_feeWallet != address(0), 105, "Fee wallet cannot be zero");
        tvm.accept();
        routerUsdcWallet = _routerUsdcWallet;
        feeWallet = _feeWallet;
        emit RouterInitialized(_routerUsdcWallet, _feeWallet);
    }

    function onAcceptTokensTransfer(
        address tokenRoot,
        uint128 amount,
        address sender,
        address /* senderWallet */,
        address remainingGasTo,
        TvmCell payload
    ) external override {
        // Only accept transfers from our registered USDC wallet
        require(msg.sender == routerUsdcWallet, 101, "Only router USDC wallet");
        require(tokenRoot == usdcRoot, 102, "Invalid token root");

        // P1-3 FIX: Reject micro-transactions that waste gas
        require(amount >= MIN_USDC_AMOUNT, 106, "Amount below minimum (1 USDC)");

        // P1-4 FIX: Use mode 4 (reserve original balance) to prevent underflow
        tvm.rawReserve(0, 4);

        uint128 feeAmount = (amount * feeBps) / 10000;
        uint128 swapAmount = amount - feeAmount;

        emit SwapRouted(sender, amount, feeAmount, swapAmount);

        // 1. Send fee to FEE_WALLET
        if (feeAmount > 0) {
            TvmCell emptyPayload;
            ITIP3TokenWallet(routerUsdcWallet).transfer{value: 0.1 ever, flag: 0}(
                feeAmount,
                feeWallet,
                0.1 ever,
                remainingGasTo,
                false,
                emptyPayload
            );
        }

        // H-03: Track pending swap for bounce recovery
        pendingSwapRefunds[sender] += swapAmount;

        // 2. Send the rest to Accumulator
        if (swapAmount > 0) {
            ITIP3TokenWallet(routerUsdcWallet).transfer{value: 0, flag: 128}(
                swapAmount,
                accumulatorAddress,
                0.1 ever,
                remainingGasTo,
                true,
                payload
            );
        } else {
            remainingGasTo.transfer({value: 0, flag: 128});
        }
    }

    // H-03: onBounce handler to track failed transfers for admin recovery
    onBounce(TvmSlice body) external {
        if (body.bits() < 32) {
            return;
        }
        uint32 funcId = body.load(uint32);
        // If a transfer to Accumulator bounced, funds remain in router wallet
        // Emit event for off-chain monitoring and admin recovery via rescueTokens
        if (funcId == abi.functionId(ITIP3TokenWallet.transfer)) {
            emit BounceRefund(msg.sender, 0);
        }
    }

    // ─── Admin functions ─────────────────────────────────────────────────────
    // P1-2 FIX: Use msg.pubkey() for external message auth (consistent with TVM pattern)
    function setFeeBps(uint16 _feeBps) external {
        require(msg.pubkey() == tvm.pubkey(), 103, "Not authorized");
        tvm.accept();
        require(_feeBps <= 1000, 104, "Max fee is 10%");
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    // P1-1 FIX: This now actually works because feeWallet is a state var
    function updateFeeWallet(address _feeWallet) external {
        require(msg.pubkey() == tvm.pubkey(), 103, "Not authorized");
        require(_feeWallet != address(0), 105, "Fee wallet cannot be zero");
        tvm.accept();
        feeWallet = _feeWallet;
        emit FeeWalletUpdated(_feeWallet);
    }

    // M-07: Two-step rescue with timelock for large amounts
    function requestRescue(uint128 amount, address recipient) external {
        require(msg.pubkey() == tvm.pubkey(), 103, "Not authorized");
        require(recipient != address(0), 107, "Recipient cannot be zero");
        tvm.accept();

        if (amount < RESCUE_TIMELOCK_THRESHOLD) {
            // Small amounts: immediate rescue
            TvmCell emptyPayload;
            ITIP3TokenWallet(routerUsdcWallet).transfer{value: 0.1 ever, flag: 0}(
                amount,
                recipient,
                0.1 ever,
                recipient,
                false,
                emptyPayload
            );
            emit RescueExecuted(amount, recipient);
        } else {
            // Large amounts: require timelock
            pendingRescue = RescueRequest(amount, recipient, uint32(block.timestamp));
            emit RescueRequested(amount, recipient, uint32(block.timestamp) + RESCUE_TIMELOCK_DURATION);
        }
    }

    function executeRescue() external {
        require(msg.pubkey() == tvm.pubkey(), 103, "Not authorized");
        require(pendingRescue.amount > 0, 108, "No pending rescue");
        require(block.timestamp >= pendingRescue.requestedAt + RESCUE_TIMELOCK_DURATION, 109, "Timelock not expired");
        tvm.accept();

        TvmCell emptyPayload;
        ITIP3TokenWallet(routerUsdcWallet).transfer{value: 0.1 ever, flag: 0}(
            pendingRescue.amount,
            pendingRescue.recipient,
            0.1 ever,
            pendingRescue.recipient,
            false,
            emptyPayload
        );
        emit RescueExecuted(pendingRescue.amount, pendingRescue.recipient);
        delete pendingRescue;
    }

    function cancelRescue() external {
        require(msg.pubkey() == tvm.pubkey(), 103, "Not authorized");
        tvm.accept();
        delete pendingRescue;
        emit RescueCancelled();
    }
}
