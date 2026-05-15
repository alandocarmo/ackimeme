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
    address public static owner;
    address public static usdcRoot;
    address public static feeWallet;
    address public static accumulatorAddress;
    
    address public routerUsdcWallet;

    uint16 public feeBps = 100; // 1% = 100 bps

    event RouterInitialized(address usdcWallet);
    event SwapRouted(address sender, uint128 totalAmount, uint128 feeAmount, uint128 swapAmount);

    constructor(address _routerUsdcWallet) {
        require(tvm.pubkey() == msg.pubkey(), 100);
        tvm.accept();
        routerUsdcWallet = _routerUsdcWallet;
        emit RouterInitialized(_routerUsdcWallet);
    }

    function onAcceptTokensTransfer(
        address tokenRoot,
        uint128 amount,
        address sender,
        address senderWallet,
        address remainingGasTo,
        TvmCell payload
    ) external override {
        // Only accept transfers from our registered USDC wallet
        require(msg.sender == routerUsdcWallet, 101, "Only router USDC wallet");
        require(tokenRoot == usdcRoot, 102, "Invalid token root");

        // We must have enough gas to process this and send two transfers
        tvm.rawReserve(address(this).balance - msg.value, 0);

        uint128 feeAmount = (amount * feeBps) / 10000;
        uint128 swapAmount = amount - feeAmount;

        emit SwapRouted(sender, amount, feeAmount, swapAmount);

        // 1. Send fee to FEE_WALLET
        if (feeAmount > 0) {
            TvmCell emptyPayload;
            ITIP3TokenWallet(routerUsdcWallet).transfer{value: 0.1 ever, flag: 0}(
                feeAmount,
                feeWallet,
                0.1 ever, // deploy wallet if needed
                remainingGasTo,
                false, // notify
                emptyPayload
            );
        }

        // 2. Send the rest to Accumulator
        if (swapAmount > 0) {
            // The Accumulator expects a specific payload or just standard transfer to convert to SHELL.
            // Usually, standard transfer is enough, and the Accumulator will mint SHELL back to the 'sender'
            // or 'remainingGasTo' depending on its implementation.
            // We pass the payload we received forward if needed, or an empty one.
            ITIP3TokenWallet(routerUsdcWallet).transfer{value: 0, flag: 128}(
                swapAmount,
                accumulatorAddress,
                0.1 ever,
                remainingGasTo,
                true, // notify Accumulator
                payload // forward payload so Accumulator knows who initiated the swap
            );
        } else {
            // If amount was too small, just return the gas
            remainingGasTo.transfer({value: 0, flag: 128});
        }
    }

    // Admin functions
    function setFeeBps(uint16 _feeBps) external {
        require(msg.sender == owner, 103, "Not owner");
        tvm.accept();
        require(_feeBps <= 1000, 104, "Max fee is 10%");
        feeBps = _feeBps;
    }

    function updateFeeWallet(address _feeWallet) external {
        require(msg.sender == owner, 103, "Not owner");
        tvm.accept();
        feeWallet = _feeWallet;
    }
}
