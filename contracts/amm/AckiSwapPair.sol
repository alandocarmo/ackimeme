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

    // R7-A2: fuel model — entries reachable cross-Dapp-ID arrive with msg.value
    // zeroed, so the pair accepts and refuels itself by converting inbound
    // SHELL (never pooled reserves) into VMSHELL via gosh.cnvrtshellq.
    uint64 constant GAS_CONVERT_SHELL = 1_000_000_000;   // 1 SHELL → VMSHELL per swap entry
    uint128 constant PAYOUT_HOP_SHELL = 6_000_000_000;   // funds outbound token-wallet hops (covers cold wallet deploy)
    uint128 constant FEE_HOP_SHELL = 2_000_000_000;      // funds protocol-fee token transfers (warm hop)

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
        // R7-C1: the BondingCurve lives in another Dapp ID — msg.value arrives
        // zeroed; self-fund execution from the pair's own balance.
        tvm.accept();
        uint256 shellReceived = uint256(msg.currencies[SHELL_CURRENCY_ID]);
        reserveShell += uint128(shellReceived);
    }

    function initAftWallet() external {
        require(msg.sender == bondingCurve, 105, "Only bonding curve");
        require(tokenWallet == address(0), 102);
        // R7-C1: cross-Dapp-ID entry — self-fund execution.
        tvm.accept();
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
        // R7-C1: the TokenRoot lives in another Dapp ID — self-fund execution
        // and refuel from the discovery-leftover SHELL forwarded by the root.
        tvm.accept();
        uint128 inboundShell = uint128(msg.currencies[SHELL_CURRENCY_ID]);
        if (inboundShell > 0) {
            gosh.cnvrtshellq(uint64(inboundShell));
        }
        bool firstDiscovery = tokenWallet == address(0);
        tokenWallet = walletAddress;
        if (firstDiscovery) {
            IBondingCurve(bondingCurve).onPairReady{value: 0.1 ton, flag: 1}();
        }
    }

    /// R7-C1: permissionless retry — if the curve's liquidity push aborted
    /// (e.g. transient SHELL insolvency), anyone can poke the curve to re-send
    /// it. Attached SHELL is converted to refuel the pair. Reverts once the
    /// pool is initialized, closing the gas-drain window.
    function pokeBondingCurve() external {
        require(tokenWallet != address(0), 102);
        require(!initialized, 103);
        tvm.accept();
        uint128 inboundShell = uint128(msg.currencies[SHELL_CURRENCY_ID]);
        if (inboundShell > 0) {
            gosh.cnvrtshellq(uint64(inboundShell));
        }
        IBondingCurve(bondingCurve).onPairReady{value: 0.1 ton, flag: 1}();
    }

    function onAFTTransfer(
        uint64 queryId,
        uint128 amount,
        address sender,
        TvmCell forwardPayload
    ) external functionID(0x7362d09c) {
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

            // R7-A2: the forwarded SHELL is pure fuel (never reserves) — refuel.
            uint128 inboundShell = uint128(msg.currencies[SHELL_CURRENCY_ID]);
            if (inboundShell > 0) {
                gosh.cnvrtshellq(uint64(inboundShell));
            }

            emit LiquidityAdded(reserveShell, reserveToken, 0);

            if (sender != address(0)) {
                // R7-A2: flag 64 of a zeroed cross-dapp message carries nothing —
                // send an explicit non-zero value from the pair's balance.
                sender.transfer({value: 0.05 ton, flag: 1, bounce: false});
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
    // R7-A2: a fixed SHELL overhead is deducted from the input — 1 SHELL is
    // converted to VMSHELL to refuel the pair and 6 SHELL fund the outbound
    // token-wallet hops (entry conversion + possible cold deploy for the buyer).
    function swapShellForToken(uint128 minAmountOut, address responseDestination) external {
        require(initialized, 103);
        uint128 received = uint128(msg.currencies[SHELL_CURRENCY_ID]); // SHELL ECC
        uint128 overhead = uint128(GAS_CONVERT_SHELL) + PAYOUT_HOP_SHELL;
        require(received > overhead, 104);

        tvm.accept();
        gosh.cnvrtshellq(GAS_CONVERT_SHELL);
        uint128 amountIn = received - overhead;

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
        // R7-A2: explicit value + SHELL fuel — flag 64 of a cross-dapp call
        // forwards nothing (the inbound value arrives zeroed).
        mapping(uint32 => varuint32) hopCc;
        hopCc[SHELL_CURRENCY_ID] = varuint32(PAYOUT_HOP_SHELL);
        IAFTWallet(tokenWallet).transfer{value: 0.1 ton, currencies: hopCc, flag: 1}(
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
        // R7-A2: refuel from the seller's forwarded SHELL (never pooled
        // reserves); the remainder funds the protocol-fee token hop below.
        uint128 inboundShell = uint128(msg.currencies[SHELL_CURRENCY_ID]);
        uint128 toConvert = inboundShell < uint128(GAS_CONVERT_SHELL) ? inboundShell : uint128(GAS_CONVERT_SHELL);
        if (toConvert > 0) {
            gosh.cnvrtshellq(uint64(toConvert));
        }
        uint128 feeBudget = inboundShell - toConvert;

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

        // Send Protocol Fee (Tokens) to feeRecipient — only when the seller
        // forwarded enough SHELL to fund the wallet hop; otherwise the fee
        // tokens accrue (untracked) in the pair's wallet for a later sweep.
        if (protocolFee > 0 && feeBudget >= FEE_HOP_SHELL) {
            optional(TvmCell) noPayload;
            TvmCell emptyPayload;
            mapping(uint32 => varuint32) feeHopCc;
            feeHopCc[SHELL_CURRENCY_ID] = varuint32(FEE_HOP_SHELL);
            IAFTWallet(tokenWallet).transfer{value: 0.1 ton, currencies: feeHopCc, flag: 1}(
                0,
                protocolFee,
                _feeRecipient, // destinationOwner
                _feeRecipient, // responseDestination
                noPayload,
                0,
                emptyPayload
            );
        }

        mapping(uint32 => varuint32) payoutCurrencies;
        payoutCurrencies[SHELL_CURRENCY_ID] = varuint32(amountOut);
        // R7-A2: explicit value — flag 64 of a zeroed cross-dapp message carries nothing.
        responseDestination.transfer({value: 0.05 ton, flag: 1, bounce: false, currencies: payoutCurrencies});
    }

    function _refundTokens(uint64 queryId, uint128 amount, address user, address responseDestination) private {
        optional(TvmCell) noPayload;
        TvmCell emptyPayload;
        // R7-A2: return the sender's forwarded SHELL as hop fuel for the refund.
        uint128 inboundShell = uint128(msg.currencies[SHELL_CURRENCY_ID]);
        mapping(uint32 => varuint32) refundCc;
        if (inboundShell > 0) {
            refundCc[SHELL_CURRENCY_ID] = varuint32(inboundShell);
        }
        IAFTWallet(msg.sender).transfer{value: 0.1 ton, currencies: refundCc, flag: 1}(
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
