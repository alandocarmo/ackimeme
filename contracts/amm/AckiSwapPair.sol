pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "../interfaces/IAFTWallet.sol";
import "../interfaces/IAFTRoot.sol";
import "../interfaces/IAFTWalletAddressReceiver.sol";

interface IBondingCurve {
    function onPairReady() external;
}

contract AckiSwapPair is IAFTWalletAddressReceiver {
    uint32 constant SHELL_CURRENCY_ID = 2;
    address static _factory;
    address static _tokenRoot;
    address static _feeRecipient;
    
    uint128 public reserveShell;
    uint128 public reserveToken;
    address public tokenWallet;
    address public bondingCurve;

    bool public initialized = false;

    event LiquidityAdded(uint128 amountShell, uint128 amountToken, uint128 liquidity);
    event Swap(address user, uint128 amountInShell, uint128 amountInToken, uint128 amountOutShell, uint128 amountOutToken);

    constructor(address _bondingCurve) {
        require(msg.sender == _factory, 101);
        tvm.accept();
        bondingCurve = _bondingCurve;
        // The Pair relies on TEP-74 onAFTTransfer for AFT tokens
    }

    // Function to add initial liquidity (from BondingCurve)
    // The BondingCurve first transfers AFT tokens via onAFTTransfer with payload = "add_liquidity".
    // Then it sends SHELL via a direct call to `provideInitialShell`.
    function provideInitialShell() external {
        require(msg.sender == bondingCurve, 105, "Only bonding curve");
        uint256 shellReceived = uint256(msg.currencies[SHELL_CURRENCY_ID]);
        reserveShell += uint128(shellReceived);
    }

    function initAftWallet() external {
        require(msg.sender == bondingCurve, 105, "Only bonding curve");
        require(tokenWallet == address(0), 102);
        // We use the SHELL received from msg.currencies
        uint256 shellReceived = uint256(msg.currencies[SHELL_CURRENCY_ID]);
        require(shellReceived >= 2 * 1e9, 203);
        
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
        require(msg.sender == _tokenRoot, 103);
        tokenWallet = walletAddress;
        IBondingCurve(bondingCurve).onPairReady{value: 0.1 ton, flag: 1}();
    }

    function onAFTTransfer(
        uint64 queryId,
        uint128 amount,
        address sender,
        TvmCell forwardPayload
    ) external {
        require(tokenWallet != address(0), 102);
        require(msg.sender == tokenWallet, 102);

        tvm.accept();

        TvmSlice slice = forwardPayload.toSlice();
        uint32 op = 0;
        if (slice.bits() >= 32) {
            op = slice.load(uint32);
        }

        if (!initialized && op == 1) {
            // Op 1: Initial Liquidity
            // reserveShell is already populated by provideInitialShell
            reserveToken = amount;
            initialized = true;

            emit LiquidityAdded(reserveShell, reserveToken, 0);

            if (sender != address(0)) {
                mapping(uint32 => varuint32) emptyCc;
                sender.transfer({value: varuint16(0), flag: 64, bounce: false, currencies: emptyCc});
            }
        } else if (initialized && op == 2) {
            // Op 2: Swap Token for SHELL
            uint128 minAmountOut = slice.bits() >= 128 ? slice.load(uint128) : 0;
            _swapTokenForShell(amount, sender, minAmountOut, sender);
        } else {
            // Unrecognized or invalid operation, return tokens
            _refundTokens(queryId, amount, sender, sender);
        }
    }

    // Swap SHELL for Token
    function swapShellForToken(uint128 minAmountOut, address responseDestination) external {
        require(initialized, 103);
        uint128 amountIn = uint128(msg.currencies[SHELL_CURRENCY_ID]); // SHELL ECC
        require(amountIn > 0, 104);

        tvm.accept();

        // Protocol Fee: 0.05%
        uint128 protocolFee = (amountIn * 5) / 10000;
        uint128 amountInAfterProtocolFee = amountIn - protocolFee;

        // Pool Fee: 0.25%
        uint256 amountInWithPoolFee = uint256(amountInAfterProtocolFee) * 9975;
        uint256 numerator = amountInWithPoolFee * uint256(reserveToken);
        uint256 denominator = (uint256(reserveShell) * 10000) + amountInWithPoolFee;
        uint128 amountOut = uint128(numerator / denominator);

        require(amountOut >= minAmountOut, 105);
        require(amountOut < reserveToken, 106);

        reserveShell += amountInAfterProtocolFee;
        reserveToken -= amountOut;

        emit Swap(msg.sender, amountIn, 0, 0, amountOut);

        // Send Protocol Fee to feeRecipient
        mapping(uint32 => varuint32) feeCc;
        feeCc[SHELL_CURRENCY_ID] = varuint32(protocolFee);
        _feeRecipient.transfer({value: 50000000, flag: 0, bounce: false, currencies: feeCc});

        optional(TvmCell) noPayload;
        TvmCell emptyPayload;
        IAFTWallet(tokenWallet).transfer{value: varuint16(0), flag: 64}(
            0,
            amountOut,
            msg.sender, // destinationOwner
            responseDestination, // responseDestination
            noPayload, // customPayload
            0, // forwardShellAmount
            emptyPayload // forwardPayload
        );
    }

    function _swapTokenForShell(uint128 amountIn, address user, uint128 minAmountOut, address responseDestination) private {
        // Protocol Fee: 0.05%
        uint128 protocolFee = (amountIn * 5) / 10000;
        uint128 amountInAfterProtocolFee = amountIn - protocolFee;

        // Pool Fee: 0.25%
        uint256 amountInWithPoolFee = uint256(amountInAfterProtocolFee) * 9975;
        uint256 numerator = amountInWithPoolFee * uint256(reserveShell);
        uint256 denominator = (uint256(reserveToken) * 10000) + amountInWithPoolFee;
        uint128 amountOut = uint128(numerator / denominator);

        require(amountOut >= minAmountOut, 105);
        require(amountOut < reserveShell, 106);

        reserveToken += amountInAfterProtocolFee;
        reserveShell -= amountOut;

        emit Swap(user, 0, amountIn, amountOut, 0);

        // Send Protocol Fee (Tokens) to feeRecipient
        optional(TvmCell) noPayload;
        TvmCell emptyPayload;
        IAFTWallet(tokenWallet).transfer{value: 50000000, flag: 0}(
            0,
            protocolFee,
            _feeRecipient, // destinationOwner
            _feeRecipient, // responseDestination
            noPayload,
            0,
            emptyPayload
        );

        mapping(uint32 => varuint32) payoutCurrencies;
        payoutCurrencies[SHELL_CURRENCY_ID] = varuint32(amountOut);
        responseDestination.transfer({value: varuint16(0), flag: 64, bounce: false, currencies: payoutCurrencies});
    }

    function _refundTokens(uint64 queryId, uint128 amount, address user, address responseDestination) private {
        optional(TvmCell) noPayload;
        TvmCell emptyPayload;
        IAFTWallet(msg.sender).transfer{value: varuint16(0), flag: 64}(
            queryId,
            amount,
            user,
            responseDestination,
            noPayload,
            0,
            emptyPayload
        );
    }
}
