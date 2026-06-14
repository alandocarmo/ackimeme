# Audit – AckiSwapPair.sol

*Source: `C:\Users\alanp\ackimeme\contracts\amm\AckiSwapPair.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 2 | `pragma AbiHeader expire;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `pragma AbiHeader pubkey;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 4 | `` | — | https://docs.acki-nacki.org/solidity |
| 5 | `import "../interfaces/IAFTWallet.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 6 | `import "../interfaces/IAFTRoot.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 7 | `import "../interfaces/IAFTWalletAddressReceiver.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 8 | `` | — | https://docs.acki-nacki.org/solidity |
| 9 | `interface IBondingCurve {` | — | [interfaces](https://docs.acki-nacki.org/solidity/interfaces.html) |
| 10 | `    function onPairReady() external;` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 11 | `}` | — | https://docs.acki-nacki.org/solidity |
| 12 | `` | — | https://docs.acki-nacki.org/solidity |
| 13 | `contract AckiSwapPair is IAFTWalletAddressReceiver {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 14 | `    uint32 constant SHELL_CURRENCY_ID = 2;` | — | https://docs.acki-nacki.org/solidity |
| 15 | `` | — | https://docs.acki-nacki.org/solidity |
| 16 | `    // R7-A2: fuel model — entries reachable cross-Dapp-ID arrive with msg.value` | — | https://docs.acki-nacki.org/solidity |
| 17 | `    // zeroed, so the pair accepts and refuels itself by converting inbound` | — | https://docs.acki-nacki.org/solidity |
| 18 | `    // SHELL (never pooled reserves) into VMSHELL via gosh.cnvrtshellq.` | — | https://docs.acki-nacki.org/solidity |
| 19 | `    uint64 constant GAS_CONVERT_SHELL = 1_000_000_000;   // 1 SHELL → VMSHELL per swap entry` | — | https://docs.acki-nacki.org/solidity |
| 20 | `    uint128 constant PAYOUT_HOP_SHELL = 6_000_000_000;   // funds outbound token-wallet hops (covers cold wallet deploy)` | — | https://docs.acki-nacki.org/solidity |
| 21 | `    uint128 constant FEE_HOP_SHELL = 2_000_000_000;      // funds protocol-fee token transfers (warm hop)` | — | https://docs.acki-nacki.org/solidity |
| 22 | `` | — | https://docs.acki-nacki.org/solidity |
| 23 | `    address static _factory;` | — | https://docs.acki-nacki.org/solidity |
| 24 | `    address static _tokenRoot;` | — | https://docs.acki-nacki.org/solidity |
| 25 | `    address static _feeRecipient;` | — | https://docs.acki-nacki.org/solidity |
| 26 | `` | — | https://docs.acki-nacki.org/solidity |
| 27 | `    uint128 public reserveShell;` | — | https://docs.acki-nacki.org/solidity |
| 28 | `    uint128 public reserveToken;` | — | https://docs.acki-nacki.org/solidity |
| 29 | `    address public tokenWallet;` | — | https://docs.acki-nacki.org/solidity |
| 30 | `    address public bondingCurve;` | — | https://docs.acki-nacki.org/solidity |
| 31 | `` | — | https://docs.acki-nacki.org/solidity |
| 32 | `    bool public initialized = false;` | — | https://docs.acki-nacki.org/solidity |
| 33 | `` | — | https://docs.acki-nacki.org/solidity |
| 34 | `    event LiquidityAdded(uint128 amountShell, uint128 amountToken, uint128 liquidity);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 35 | `    event Swap(address user, uint128 amountInShell, uint128 amountInToken, uint128 amountOutShell, uint128 amountOutToken);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 36 | `` | — | https://docs.acki-nacki.org/solidity |
| 37 | `    constructor(address _bondingCurve) {` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 38 | `        require(msg.sender == _factory, 101);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 39 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 40 | `        bondingCurve = _bondingCurve;` | — | https://docs.acki-nacki.org/solidity |
| 41 | `        // The Pair relies on TEP-74 onAFTTransfer for AFT tokens` | — | https://docs.acki-nacki.org/solidity |
| 42 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 43 | `` | — | https://docs.acki-nacki.org/solidity |
| 44 | `    // Function to add initial liquidity (from BondingCurve)` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 45 | `    // The BondingCurve first transfers AFT tokens via onAFTTransfer with payload = "add_liquidity".` | — | https://docs.acki-nacki.org/solidity |
| 46 | `    // Then it sends SHELL via a direct call to `provideInitialShell`.` | — | https://docs.acki-nacki.org/solidity |
| 47 | `    function provideInitialShell() external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 48 | `        require(msg.sender == bondingCurve, 105, "Only bonding curve");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 49 | `        // R7-C1: the BondingCurve lives in another Dapp ID — msg.value arrives` | — | https://docs.acki-nacki.org/solidity |
| 50 | `        // zeroed; self-fund execution from the pair's own balance.` | — | https://docs.acki-nacki.org/solidity |
| 51 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 52 | `        uint256 shellReceived = uint256(msg.currencies[SHELL_CURRENCY_ID]);` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 53 | `        reserveShell += uint128(shellReceived);` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 54 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 55 | `` | — | https://docs.acki-nacki.org/solidity |
| 56 | `    function initAftWallet() external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 57 | `        require(msg.sender == bondingCurve, 105, "Only bonding curve");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 58 | `        require(tokenWallet == address(0), 102);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 59 | `        // R7-C1: cross-Dapp-ID entry — self-fund execution.` | — | https://docs.acki-nacki.org/solidity |
| 60 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 61 | `        // We use the SHELL received from msg.currencies` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 62 | `        uint256 shellReceived = uint256(msg.currencies[SHELL_CURRENCY_ID]);` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 63 | `        require(shellReceived >= 2 * 1e9, 203);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 64 | `` | — | https://docs.acki-nacki.org/solidity |
| 65 | `        mapping(uint32 => varuint32) cc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 66 | `        cc[SHELL_CURRENCY_ID] = varuint32(shellReceived);` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 67 | `` | — | https://docs.acki-nacki.org/solidity |
| 68 | `        IAFTRoot(_tokenRoot).provideWalletAddress{ value: 0.1 ton, currencies: cc, flag: 1 }(` | — | https://docs.acki-nacki.org/solidity |
| 69 | `            0,` | — | https://docs.acki-nacki.org/solidity |
| 70 | `            address(this),` | — | https://docs.acki-nacki.org/solidity |
| 71 | `            false` | — | https://docs.acki-nacki.org/solidity |
| 72 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 73 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 74 | `` | — | https://docs.acki-nacki.org/solidity |
| 75 | `    function takeWalletAddress(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 76 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 77 | `        address walletAddress,` | — | https://docs.acki-nacki.org/solidity |
| 78 | `        optional(address) ownerAddress` | — | https://docs.acki-nacki.org/solidity |
| 79 | `    ) external override functionID(0xd1735400) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 80 | `        require(msg.sender == _tokenRoot, 103);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 81 | `        // R7-C1: the TokenRoot lives in another Dapp ID — self-fund execution` | — | https://docs.acki-nacki.org/solidity |
| 82 | `        // and refuel from the discovery-leftover SHELL forwarded by the root.` | — | https://docs.acki-nacki.org/solidity |
| 83 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 84 | `        uint128 inboundShell = uint128(msg.currencies[SHELL_CURRENCY_ID]);` | — | https://docs.acki-nacki.org/solidity |
| 85 | `        if (inboundShell > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 86 | `            gosh.cnvrtshellq(uint64(inboundShell));` | — | https://docs.acki-nacki.org/solidity |
| 87 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 88 | `        bool firstDiscovery = tokenWallet == address(0);` | — | https://docs.acki-nacki.org/solidity |
| 89 | `        tokenWallet = walletAddress;` | — | https://docs.acki-nacki.org/solidity |
| 90 | `        if (firstDiscovery) {` | — | https://docs.acki-nacki.org/solidity |
| 91 | `            IBondingCurve(bondingCurve).onPairReady{value: 0.1 ton, flag: 1}();` | — | https://docs.acki-nacki.org/solidity |
| 92 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 93 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 94 | `` | — | https://docs.acki-nacki.org/solidity |
| 95 | `    /// R7-C1: permissionless retry — if the curve's liquidity push aborted` | — | https://docs.acki-nacki.org/solidity |
| 96 | `    /// (e.g. transient SHELL insolvency), anyone can poke the curve to re-send` | — | https://docs.acki-nacki.org/solidity |
| 97 | `    /// it. Attached SHELL is converted to refuel the pair. Reverts once the` | — | [revert](https://docs.acki-nacki.org/solidity/revert.html) |
| 98 | `    /// pool is initialized, closing the gas-drain window.` | — | https://docs.acki-nacki.org/solidity |
| 99 | `    function pokeBondingCurve() external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 100 | `        require(tokenWallet != address(0), 102);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 101 | `        require(!initialized, 103);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 102 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 103 | `        uint128 inboundShell = uint128(msg.currencies[SHELL_CURRENCY_ID]);` | — | https://docs.acki-nacki.org/solidity |
| 104 | `        if (inboundShell > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 105 | `            gosh.cnvrtshellq(uint64(inboundShell));` | — | https://docs.acki-nacki.org/solidity |
| 106 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 107 | `        IBondingCurve(bondingCurve).onPairReady{value: 0.1 ton, flag: 1}();` | — | https://docs.acki-nacki.org/solidity |
| 108 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 109 | `` | — | https://docs.acki-nacki.org/solidity |
| 110 | `    function onAFTTransfer(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 111 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 112 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 113 | `        address sender,` | — | https://docs.acki-nacki.org/solidity |
| 114 | `        TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 115 | `    ) external functionID(0x7362d09c) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 116 | `        require(tokenWallet != address(0), 102);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 117 | `        require(msg.sender == tokenWallet, 102);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 118 | `` | — | https://docs.acki-nacki.org/solidity |
| 119 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 120 | `` | — | https://docs.acki-nacki.org/solidity |
| 121 | `        TvmSlice slice = forwardPayload.toSlice();` | — | https://docs.acki-nacki.org/solidity |
| 122 | `        uint32 op = 0;` | — | https://docs.acki-nacki.org/solidity |
| 123 | `        if (slice.bits() >= 32) {` | — | https://docs.acki-nacki.org/solidity |
| 124 | `            op = slice.load(uint32);` | — | https://docs.acki-nacki.org/solidity |
| 125 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 126 | `` | — | https://docs.acki-nacki.org/solidity |
| 127 | `        if (!initialized && op == 1) {` | — | https://docs.acki-nacki.org/solidity |
| 128 | `            // Op 1: Initial Liquidity` | — | https://docs.acki-nacki.org/solidity |
| 129 | `            // reserveShell is already populated by provideInitialShell` | — | https://docs.acki-nacki.org/solidity |
| 130 | `            reserveToken = amount;` | — | https://docs.acki-nacki.org/solidity |
| 131 | `            initialized = true;` | — | https://docs.acki-nacki.org/solidity |
| 132 | `` | — | https://docs.acki-nacki.org/solidity |
| 133 | `            // R7-A2: the forwarded SHELL is pure fuel (never reserves) — refuel.` | — | https://docs.acki-nacki.org/solidity |
| 134 | `            uint128 inboundShell = uint128(msg.currencies[SHELL_CURRENCY_ID]);` | — | https://docs.acki-nacki.org/solidity |
| 135 | `            if (inboundShell > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 136 | `                gosh.cnvrtshellq(uint64(inboundShell));` | — | https://docs.acki-nacki.org/solidity |
| 137 | `            }` | — | https://docs.acki-nacki.org/solidity |
| 138 | `` | — | https://docs.acki-nacki.org/solidity |
| 139 | `            emit LiquidityAdded(reserveShell, reserveToken, 0);` | — | https://docs.acki-nacki.org/solidity |
| 140 | `` | — | https://docs.acki-nacki.org/solidity |
| 141 | `            if (sender != address(0)) {` | — | https://docs.acki-nacki.org/solidity |
| 142 | `                // R7-A2: flag 64 of a zeroed cross-dapp message carries nothing —` | — | https://docs.acki-nacki.org/solidity |
| 143 | `                // send an explicit non-zero value from the pair's balance.` | — | https://docs.acki-nacki.org/solidity |
| 144 | `                sender.transfer({value: 0.05 ton, flag: 1, bounce: false});` | — | https://docs.acki-nacki.org/solidity |
| 145 | `            }` | — | https://docs.acki-nacki.org/solidity |
| 146 | `        } else if (initialized && op == 2) {` | — | https://docs.acki-nacki.org/solidity |
| 147 | `            // Op 2: Swap Token for SHELL` | — | https://docs.acki-nacki.org/solidity |
| 148 | `            uint128 minAmountOut = slice.bits() >= 128 ? slice.load(uint128) : 0;` | — | https://docs.acki-nacki.org/solidity |
| 149 | `            _swapTokenForShell(amount, sender, minAmountOut, sender);` | — | https://docs.acki-nacki.org/solidity |
| 150 | `        } else {` | — | https://docs.acki-nacki.org/solidity |
| 151 | `            // Unrecognized or invalid operation, return tokens` | — | https://docs.acki-nacki.org/solidity |
| 152 | `            _refundTokens(queryId, amount, sender, sender);` | — | https://docs.acki-nacki.org/solidity |
| 153 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 154 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 155 | `` | — | https://docs.acki-nacki.org/solidity |
| 156 | `    // Swap SHELL for Token` | — | https://docs.acki-nacki.org/solidity |
| 157 | `    // R7-A2: a fixed SHELL overhead is deducted from the input — 1 SHELL is` | — | https://docs.acki-nacki.org/solidity |
| 158 | `    // converted to VMSHELL to refuel the pair and 6 SHELL fund the outbound` | — | https://docs.acki-nacki.org/solidity |
| 159 | `    // token-wallet hops (entry conversion + possible cold deploy for the buyer).` | — | https://docs.acki-nacki.org/solidity |
| 160 | `    function swapShellForToken(uint128 minAmountOut, address responseDestination) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 161 | `        require(initialized, 103);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 162 | `        uint128 received = uint128(msg.currencies[SHELL_CURRENCY_ID]); // SHELL ECC` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 163 | `        uint128 overhead = uint128(GAS_CONVERT_SHELL) + PAYOUT_HOP_SHELL;` | — | https://docs.acki-nacki.org/solidity |
| 164 | `        require(received > overhead, 104);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 165 | `` | — | https://docs.acki-nacki.org/solidity |
| 166 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 167 | `        gosh.cnvrtshellq(GAS_CONVERT_SHELL);` | — | https://docs.acki-nacki.org/solidity |
| 168 | `        uint128 amountIn = received - overhead;` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 169 | `` | — | https://docs.acki-nacki.org/solidity |
| 170 | `        // Protocol Fee: 0.05%` | — | https://docs.acki-nacki.org/solidity |
| 171 | `        uint128 protocolFee = (amountIn * 5) / 10000;` | — | https://docs.acki-nacki.org/solidity |
| 172 | `        uint128 amountInAfterProtocolFee = amountIn - protocolFee;` | — | https://docs.acki-nacki.org/solidity |
| 173 | `` | — | https://docs.acki-nacki.org/solidity |
| 174 | `        // Pool Fee: 0.25%` | — | https://docs.acki-nacki.org/solidity |
| 175 | `        uint256 amountInWithPoolFee = uint256(amountInAfterProtocolFee) * 9975;` | — | https://docs.acki-nacki.org/solidity |
| 176 | `        uint256 numerator = amountInWithPoolFee * uint256(reserveToken);` | — | https://docs.acki-nacki.org/solidity |
| 177 | `        uint256 denominator = (uint256(reserveShell) * 10000) + amountInWithPoolFee;` | — | https://docs.acki-nacki.org/solidity |
| 178 | `        uint128 amountOut = uint128(numerator / denominator);` | — | https://docs.acki-nacki.org/solidity |
| 179 | `` | — | https://docs.acki-nacki.org/solidity |
| 180 | `        require(amountOut >= minAmountOut, 105);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 181 | `        require(amountOut < reserveToken, 106);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 182 | `` | — | https://docs.acki-nacki.org/solidity |
| 183 | `        reserveShell += amountInAfterProtocolFee;` | — | https://docs.acki-nacki.org/solidity |
| 184 | `        reserveToken -= amountOut;` | — | https://docs.acki-nacki.org/solidity |
| 185 | `` | — | https://docs.acki-nacki.org/solidity |
| 186 | `        emit Swap(msg.sender, amountIn, 0, 0, amountOut);` | — | https://docs.acki-nacki.org/solidity |
| 187 | `` | — | https://docs.acki-nacki.org/solidity |
| 188 | `        // Send Protocol Fee to feeRecipient` | — | https://docs.acki-nacki.org/solidity |
| 189 | `        mapping(uint32 => varuint32) feeCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 190 | `        feeCc[SHELL_CURRENCY_ID] = varuint32(protocolFee);` | — | https://docs.acki-nacki.org/solidity |
| 191 | `        _feeRecipient.transfer({value: 50000000, flag: 0, bounce: false, currencies: feeCc});` | — | https://docs.acki-nacki.org/solidity |
| 192 | `` | — | https://docs.acki-nacki.org/solidity |
| 193 | `        optional(TvmCell) noPayload;` | — | https://docs.acki-nacki.org/solidity |
| 194 | `        TvmCell emptyPayload;` | — | https://docs.acki-nacki.org/solidity |
| 195 | `        // R7-A2: explicit value + SHELL fuel — flag 64 of a cross-dapp call` | — | https://docs.acki-nacki.org/solidity |
| 196 | `        // forwards nothing (the inbound value arrives zeroed).` | — | https://docs.acki-nacki.org/solidity |
| 197 | `        mapping(uint32 => varuint32) hopCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 198 | `        hopCc[SHELL_CURRENCY_ID] = varuint32(PAYOUT_HOP_SHELL);` | — | https://docs.acki-nacki.org/solidity |
| 199 | `        IAFTWallet(tokenWallet).transfer{value: 0.1 ton, currencies: hopCc, flag: 1}(` | — | https://docs.acki-nacki.org/solidity |
| 200 | `            0,` | — | https://docs.acki-nacki.org/solidity |
| 201 | `            amountOut,` | — | https://docs.acki-nacki.org/solidity |
| 202 | `            msg.sender, // destinationOwner` | — | https://docs.acki-nacki.org/solidity |
| 203 | `            responseDestination, // responseDestination` | — | https://docs.acki-nacki.org/solidity |
| 204 | `            noPayload, // customPayload` | — | https://docs.acki-nacki.org/solidity |
| 205 | `            0, // forwardShellAmount` | — | https://docs.acki-nacki.org/solidity |
| 206 | `            emptyPayload // forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 207 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 208 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 209 | `` | — | https://docs.acki-nacki.org/solidity |
| 210 | `    function _swapTokenForShell(uint128 amountIn, address user, uint128 minAmountOut, address responseDestination) private {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 211 | `        // R7-A2: refuel from the seller's forwarded SHELL (never pooled` | — | https://docs.acki-nacki.org/solidity |
| 212 | `        // reserves); the remainder funds the protocol-fee token hop below.` | — | https://docs.acki-nacki.org/solidity |
| 213 | `        uint128 inboundShell = uint128(msg.currencies[SHELL_CURRENCY_ID]);` | — | https://docs.acki-nacki.org/solidity |
| 214 | `        uint128 toConvert = inboundShell < uint128(GAS_CONVERT_SHELL) ? inboundShell : uint128(GAS_CONVERT_SHELL);` | — | https://docs.acki-nacki.org/solidity |
| 215 | `        if (toConvert > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 216 | `            gosh.cnvrtshellq(uint64(toConvert));` | — | https://docs.acki-nacki.org/solidity |
| 217 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 218 | `        uint128 feeBudget = inboundShell - toConvert;` | — | https://docs.acki-nacki.org/solidity |
| 219 | `` | — | https://docs.acki-nacki.org/solidity |
| 220 | `        // Protocol Fee: 0.05%` | — | https://docs.acki-nacki.org/solidity |
| 221 | `        uint128 protocolFee = (amountIn * 5) / 10000;` | — | https://docs.acki-nacki.org/solidity |
| 222 | `        uint128 amountInAfterProtocolFee = amountIn - protocolFee;` | — | https://docs.acki-nacki.org/solidity |
| 223 | `` | — | https://docs.acki-nacki.org/solidity |
| 224 | `        // Pool Fee: 0.25%` | — | https://docs.acki-nacki.org/solidity |
| 225 | `        uint256 amountInWithPoolFee = uint256(amountInAfterProtocolFee) * 9975;` | — | https://docs.acki-nacki.org/solidity |
| 226 | `        uint256 numerator = amountInWithPoolFee * uint256(reserveShell);` | — | https://docs.acki-nacki.org/solidity |
| 227 | `        uint256 denominator = (uint256(reserveToken) * 10000) + amountInWithPoolFee;` | — | https://docs.acki-nacki.org/solidity |
| 228 | `        uint128 amountOut = uint128(numerator / denominator);` | — | https://docs.acki-nacki.org/solidity |
| 229 | `` | — | https://docs.acki-nacki.org/solidity |
| 230 | `        require(amountOut >= minAmountOut, 105);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 231 | `        require(amountOut < reserveShell, 106);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 232 | `` | — | https://docs.acki-nacki.org/solidity |
| 233 | `        reserveToken += amountInAfterProtocolFee;` | — | https://docs.acki-nacki.org/solidity |
| 234 | `        reserveShell -= amountOut;` | — | https://docs.acki-nacki.org/solidity |
| 235 | `` | — | https://docs.acki-nacki.org/solidity |
| 236 | `        emit Swap(user, 0, amountIn, amountOut, 0);` | — | https://docs.acki-nacki.org/solidity |
| 237 | `` | — | https://docs.acki-nacki.org/solidity |
| 238 | `        // Send Protocol Fee (Tokens) to feeRecipient — only when the seller` | — | https://docs.acki-nacki.org/solidity |
| 239 | `        // forwarded enough SHELL to fund the wallet hop; otherwise the fee` | — | https://docs.acki-nacki.org/solidity |
| 240 | `        // tokens accrue (untracked) in the pair's wallet for a later sweep.` | — | https://docs.acki-nacki.org/solidity |
| 241 | `        if (protocolFee > 0 && feeBudget >= FEE_HOP_SHELL) {` | — | https://docs.acki-nacki.org/solidity |
| 242 | `            optional(TvmCell) noPayload;` | — | https://docs.acki-nacki.org/solidity |
| 243 | `            TvmCell emptyPayload;` | — | https://docs.acki-nacki.org/solidity |
| 244 | `            mapping(uint32 => varuint32) feeHopCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 245 | `            feeHopCc[SHELL_CURRENCY_ID] = varuint32(FEE_HOP_SHELL);` | — | https://docs.acki-nacki.org/solidity |
| 246 | `            IAFTWallet(tokenWallet).transfer{value: 0.1 ton, currencies: feeHopCc, flag: 1}(` | — | https://docs.acki-nacki.org/solidity |
| 247 | `                0,` | — | https://docs.acki-nacki.org/solidity |
| 248 | `                protocolFee,` | — | https://docs.acki-nacki.org/solidity |
| 249 | `                _feeRecipient, // destinationOwner` | — | https://docs.acki-nacki.org/solidity |
| 250 | `                _feeRecipient, // responseDestination` | — | https://docs.acki-nacki.org/solidity |
| 251 | `                noPayload,` | — | https://docs.acki-nacki.org/solidity |
| 252 | `                0,` | — | https://docs.acki-nacki.org/solidity |
| 253 | `                emptyPayload` | — | https://docs.acki-nacki.org/solidity |
| 254 | `            );` | — | https://docs.acki-nacki.org/solidity |
| 255 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 256 | `` | — | https://docs.acki-nacki.org/solidity |
| 257 | `        mapping(uint32 => varuint32) payoutCurrencies;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 258 | `        payoutCurrencies[SHELL_CURRENCY_ID] = varuint32(amountOut);` | — | https://docs.acki-nacki.org/solidity |
| 259 | `        // R7-A2: explicit value — flag 64 of a zeroed cross-dapp message carries nothing.` | — | https://docs.acki-nacki.org/solidity |
| 260 | `        responseDestination.transfer({value: 0.05 ton, flag: 1, bounce: false, currencies: payoutCurrencies});` | — | https://docs.acki-nacki.org/solidity |
| 261 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 262 | `` | — | https://docs.acki-nacki.org/solidity |
| 263 | `    function _refundTokens(uint64 queryId, uint128 amount, address user, address responseDestination) private {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 264 | `        optional(TvmCell) noPayload;` | — | https://docs.acki-nacki.org/solidity |
| 265 | `        TvmCell emptyPayload;` | — | https://docs.acki-nacki.org/solidity |
| 266 | `        // R7-A2: return the sender's forwarded SHELL as hop fuel for the refund.` | — | https://docs.acki-nacki.org/solidity |
| 267 | `        uint128 inboundShell = uint128(msg.currencies[SHELL_CURRENCY_ID]);` | — | https://docs.acki-nacki.org/solidity |
| 268 | `        mapping(uint32 => varuint32) refundCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 269 | `        if (inboundShell > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 270 | `            refundCc[SHELL_CURRENCY_ID] = varuint32(inboundShell);` | — | https://docs.acki-nacki.org/solidity |
| 271 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 272 | `        IAFTWallet(msg.sender).transfer{value: 0.1 ton, currencies: refundCc, flag: 1}(` | — | https://docs.acki-nacki.org/solidity |
| 273 | `            queryId,` | — | https://docs.acki-nacki.org/solidity |
| 274 | `            amount,` | — | https://docs.acki-nacki.org/solidity |
| 275 | `            user,` | — | https://docs.acki-nacki.org/solidity |
| 276 | `            responseDestination,` | — | https://docs.acki-nacki.org/solidity |
| 277 | `            noPayload,` | — | https://docs.acki-nacki.org/solidity |
| 278 | `            0,` | — | https://docs.acki-nacki.org/solidity |
| 279 | `            emptyPayload` | — | https://docs.acki-nacki.org/solidity |
| 280 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 281 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 282 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
