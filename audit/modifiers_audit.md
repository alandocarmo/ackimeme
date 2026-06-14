# Audit – modifiers.sol

*Source: `C:\Users\alanp\ackimeme\contracts\modifiers\modifiers.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `// SPDX-License-Identifier: MIT` | — | https://docs.acki-nacki.org/solidity |
| 2 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `` | — | https://docs.acki-nacki.org/solidity |
| 4 | `import "./errors.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 5 | `import "./events.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 6 | `` | — | https://docs.acki-nacki.org/solidity |
| 7 | `abstract contract Modifiers is Errors, Events {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 8 | `    string constant versionModifiers = "1.0.0";` | — | [modifiers](https://docs.acki-nacki.org/solidity/modifiers.html) |
| 9 | `` | — | https://docs.acki-nacki.org/solidity |
| 10 | `    uint constant bitCntAddress = 256;` | — | https://docs.acki-nacki.org/solidity |
| 11 | `` | — | https://docs.acki-nacki.org/solidity |
| 12 | `    /// Replay-window cap for signed externals.` | — | https://docs.acki-nacki.org/solidity |
| 13 | `    uint32 constant MAX_EXPIRE_HORIZON = 15 * 60;` | — | https://docs.acki-nacki.org/solidity |
| 14 | `` | — | https://docs.acki-nacki.org/solidity |
| 15 | `    uint constant FWD_FEE_MAX_VIEWED_CELLS = 256;     // cap on cell-tree walks` | — | https://docs.acki-nacki.org/solidity |
| 16 | `` | — | https://docs.acki-nacki.org/solidity |
| 17 | `    int32 constant CONFIG_PARAM_FWD_PRICES_WC = 25;   // workchain MsgForwardPrices` | — | https://docs.acki-nacki.org/solidity |
| 18 | `    int32 constant CONFIG_PARAM_GAS_PRICES_WC = 21;   // workchain GasPrices` | — | https://docs.acki-nacki.org/solidity |
| 19 | `` | — | https://docs.acki-nacki.org/solidity |
| 20 | `    struct FwdPrices {` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 21 | `        uint64 lumpPrice;` | — | https://docs.acki-nacki.org/solidity |
| 22 | `        uint64 bitPrice;` | — | https://docs.acki-nacki.org/solidity |
| 23 | `        uint64 cellPrice;` | — | https://docs.acki-nacki.org/solidity |
| 24 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 25 | `` | — | https://docs.acki-nacki.org/solidity |
| 26 | `    // ─── Event channels ───────────────────────────────────────────────────` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 27 | `    uint128 constant CHANNEL_ID_ACTIVITY = 740;` | — | https://docs.acki-nacki.org/solidity |
| 28 | `    uint128 constant CHANNEL_ID_ADMIN = 890;` | — | https://docs.acki-nacki.org/solidity |
| 29 | `` | — | https://docs.acki-nacki.org/solidity |
| 30 | `    uint32 constant CURRENCIES_ID_SHELL = 2;` | — | https://docs.acki-nacki.org/solidity |
| 31 | `` | — | https://docs.acki-nacki.org/solidity |
| 32 | `    uint16 constant DECIMALS_MAX = 18;` | — | https://docs.acki-nacki.org/solidity |
| 33 | `` | — | https://docs.acki-nacki.org/solidity |
| 34 | `    // ─── Code-shape constants ─────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 35 | `` | — | https://docs.acki-nacki.org/solidity |
| 36 | `    /// Gas estimate for an entry-hop function; priced live via param 21.` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 37 | `    uint64 constant EST_GAS_ENTRY = 50_000;` | — | https://docs.acki-nacki.org/solidity |
| 38 | `` | — | https://docs.acki-nacki.org/solidity |
| 39 | `    /// `value:` for one internal cascade hop (same dapp — native survives).` | — | https://docs.acki-nacki.org/solidity |
| 40 | `    uint64 constant SHELL_PER_HOP = 0.5 ton;` | — | https://docs.acki-nacki.org/solidity |
| 41 | `` | — | https://docs.acki-nacki.org/solidity |
| 42 | `    /// Native attached to a cold-form wallet deploy.` | — | https://docs.acki-nacki.org/solidity |
| 43 | `    uint64 constant SHELL_PER_DEPLOY = 5 ton;` | — | https://docs.acki-nacki.org/solidity |
| 44 | `` | — | https://docs.acki-nacki.org/solidity |
| 45 | `    // action_code=38 trips on too much SHELL per outbound — cap and split` | — | https://docs.acki-nacki.org/solidity |
| 46 | `    uint64 constant SHELL_PER_EXCESS_MAX = 15 ton;` | — | https://docs.acki-nacki.org/solidity |
| 47 | `    uint8  constant EXCESS_SPLIT_COUNT   = 3;` | — | https://docs.acki-nacki.org/solidity |
| 48 | `` | — | https://docs.acki-nacki.org/solidity |
| 49 | `    // ─── Canonical TON jetton opcodes ─────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 50 | `    uint32 constant OP_TRANSFER = 0x0f8a7ea5;` | — | https://docs.acki-nacki.org/solidity |
| 51 | `    uint32 constant OP_INTERNAL_TRANSFER = 0x178d4519;` | — | https://docs.acki-nacki.org/solidity |
| 52 | `    uint32 constant OP_TRANSFER_NOTIFICATION = 0x7362d09c;` | — | https://docs.acki-nacki.org/solidity |
| 53 | `    uint32 constant OP_EXCESSES = 0xd53276db;` | — | https://docs.acki-nacki.org/solidity |
| 54 | `    uint32 constant OP_BURN = 0x595f07bc;` | — | https://docs.acki-nacki.org/solidity |
| 55 | `    uint32 constant OP_BURN_NOTIFICATION = 0x7bdd97de;` | — | https://docs.acki-nacki.org/solidity |
| 56 | `    uint32 constant OP_PROVIDE_WALLET_ADDRESS = 0x2c76b973;` | — | https://docs.acki-nacki.org/solidity |
| 57 | `    uint32 constant OP_TAKE_WALLET_ADDRESS = 0xd1735400;` | — | https://docs.acki-nacki.org/solidity |
| 58 | `` | — | https://docs.acki-nacki.org/solidity |
| 59 | `    address constant ZERO_ADDRESS = address.makeAddrStd(0, 0);` | — | https://docs.acki-nacki.org/solidity |
| 60 | `` | — | https://docs.acki-nacki.org/solidity |
| 61 | `    modifier accept() {` | — | [modifiers](https://docs.acki-nacki.org/solidity/modifiers.html) |
| 62 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 63 | `        _;` | — | https://docs.acki-nacki.org/solidity |
| 64 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 65 | `` | — | https://docs.acki-nacki.org/solidity |
| 66 | `    modifier senderIs(address sender) {` | — | [modifiers](https://docs.acki-nacki.org/solidity/modifiers.html) |
| 67 | `        require(msg.sender == sender, ERR_INVALID_SENDER);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 68 | `        _;` | — | https://docs.acki-nacki.org/solidity |
| 69 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 70 | `` | — | https://docs.acki-nacki.org/solidity |
| 71 | `    modifier onlyAdmin(address admin) {` | — | [modifiers](https://docs.acki-nacki.org/solidity/modifiers.html) |
| 72 | `        require(msg.sender == admin, ERR_NOT_ADMIN);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 73 | `        _;` | — | https://docs.acki-nacki.org/solidity |
| 74 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 75 | `` | — | https://docs.acki-nacki.org/solidity |
| 76 | `    modifier onlyPendingAdmin(address pendingAdmin) {` | — | [modifiers](https://docs.acki-nacki.org/solidity/modifiers.html) |
| 77 | `        require(msg.sender == pendingAdmin, ERR_NOT_PENDING_ADMIN);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 78 | `        _;` | — | https://docs.acki-nacki.org/solidity |
| 79 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 80 | `` | — | https://docs.acki-nacki.org/solidity |
| 81 | `    function _activityChannel() internal pure returns (address) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 82 | `        return address.makeAddrExtern(CHANNEL_ID_ACTIVITY, bitCntAddress);` | — | https://docs.acki-nacki.org/solidity |
| 83 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 84 | `` | — | https://docs.acki-nacki.org/solidity |
| 85 | `    function _adminChannel() internal pure returns (address) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 86 | `        return address.makeAddrExtern(CHANNEL_ID_ADMIN, bitCntAddress);` | — | https://docs.acki-nacki.org/solidity |
| 87 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 88 | `` | — | https://docs.acki-nacki.org/solidity |
| 89 | `    /// Inbound SHELL attached to this message.` | — | https://docs.acki-nacki.org/solidity |
| 90 | `    function _inboundShell() internal pure returns (uint128) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 91 | `        return uint128(msg.currencies[CURRENCIES_ID_SHELL]);` | — | https://docs.acki-nacki.org/solidity |
| 92 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 93 | `` | — | https://docs.acki-nacki.org/solidity |
| 94 | `    /// Requires the caller attached at least `needed` SHELL fuel.` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 95 | `    function _requireFuel(uint128 needed) internal pure {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 96 | `        require(_inboundShell() >= needed, ERR_INSUFFICIENT_FUEL);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 97 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 98 | `` | — | https://docs.acki-nacki.org/solidity |
| 99 | `    /// Current SHELL balance (post-inbound credit).` | — | https://docs.acki-nacki.org/solidity |
| 100 | `    function _currentShell() internal pure returns (uint128) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 101 | `        return uint128(address(this).currencies[CURRENCIES_ID_SHELL]);` | — | https://docs.acki-nacki.org/solidity |
| 102 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 103 | `` | — | https://docs.acki-nacki.org/solidity |
| 104 | `    /// Current native balance.` | — | https://docs.acki-nacki.org/solidity |
| 105 | `    function _currentNative() internal pure returns (uint128) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 106 | `        return uint128(address(this).balance);` | — | https://docs.acki-nacki.org/solidity |
| 107 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 108 | `` | — | https://docs.acki-nacki.org/solidity |
| 109 | `    function _loadFwdPrices() internal pure returns (FwdPrices) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 110 | `        optional(TvmCell) cfgOpt = tvm.rawConfigParam(CONFIG_PARAM_FWD_PRICES_WC);` | — | https://docs.acki-nacki.org/solidity |
| 111 | `        require(cfgOpt.hasValue(), ERR_NO_FWD_PRICES);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 112 | `        TvmSlice s = cfgOpt.get().toSlice();` | — | https://docs.acki-nacki.org/solidity |
| 113 | `        s.load(uint8);                     // skip tag` | — | https://docs.acki-nacki.org/solidity |
| 114 | `        uint64 lump = s.load(uint64);` | — | https://docs.acki-nacki.org/solidity |
| 115 | `        uint64 bit  = s.load(uint64);` | — | https://docs.acki-nacki.org/solidity |
| 116 | `        uint64 cell = s.load(uint64);` | — | https://docs.acki-nacki.org/solidity |
| 117 | `        return FwdPrices(lump, bit, cell);` | — | https://docs.acki-nacki.org/solidity |
| 118 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 119 | `` | — | https://docs.acki-nacki.org/solidity |
| 120 | `    function _loadGasPrice() internal pure returns (uint64 gasPrice) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 121 | `        optional(TvmCell) cfgOpt = tvm.rawConfigParam(CONFIG_PARAM_GAS_PRICES_WC);` | — | https://docs.acki-nacki.org/solidity |
| 122 | `        require(cfgOpt.hasValue(), ERR_NO_FWD_PRICES);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 123 | `        TvmSlice s = cfgOpt.get().toSlice();` | — | https://docs.acki-nacki.org/solidity |
| 124 | `        // layout: tag, flat_gas_limit, flat_gas_price, reserved, gas_price` | — | https://docs.acki-nacki.org/solidity |
| 125 | `        (, , , , gasPrice) = s.load(uint8, uint64, uint64, uint8, uint64);` | — | https://docs.acki-nacki.org/solidity |
| 126 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 127 | `` | — | https://docs.acki-nacki.org/solidity |
| 128 | `    /// Gas units → native, rounded up.` | — | https://docs.acki-nacki.org/solidity |
| 129 | `    function _gasToNative(uint64 gasUnits) internal pure returns (uint128) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 130 | `        uint64 gp = _loadGasPrice();` | — | https://docs.acki-nacki.org/solidity |
| 131 | `        return math.muldivc(uint128(gasUnits), uint128(gp), 65536);` | — | https://docs.acki-nacki.org/solidity |
| 132 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 133 | `` | — | https://docs.acki-nacki.org/solidity |
| 134 | `    /// ~5% underestimate (body only, no envelope).` | — | https://docs.acki-nacki.org/solidity |
| 135 | `    function _estimateFwdFee(TvmCell body) internal pure returns (uint128) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 136 | `        FwdPrices p = _loadFwdPrices();` | — | https://docs.acki-nacki.org/solidity |
| 137 | `        (uint cells, uint bits, ) = body.dataSize(FWD_FEE_MAX_VIEWED_CELLS);` | — | https://docs.acki-nacki.org/solidity |
| 138 | `        // exclude the root cell — the executor measures envelope+body` | — | https://docs.acki-nacki.org/solidity |
| 139 | `        if (cells > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 140 | `            cells -= 1;` | — | https://docs.acki-nacki.org/solidity |
| 141 | `            uint rootBits = body.toSlice().bits();` | — | https://docs.acki-nacki.org/solidity |
| 142 | `            bits = bits > rootBits ? bits - rootBits : 0;` | — | https://docs.acki-nacki.org/solidity |
| 143 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 144 | `        uint128 fwdData = uint128(cells) * uint128(p.cellPrice)` | — | https://docs.acki-nacki.org/solidity |
| 145 | `                        + uint128(bits)  * uint128(p.bitPrice);` | — | https://docs.acki-nacki.org/solidity |
| 146 | `        return uint128(p.lumpPrice) + uint128((fwdData + 0xFFFF) >> 16);` | — | https://docs.acki-nacki.org/solidity |
| 147 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 148 | `` | — | https://docs.acki-nacki.org/solidity |
| 149 | `    /// Entry-hop fuel budget: own gas + outbound `value:` + outbound fwd_fee.` | — | https://docs.acki-nacki.org/solidity |
| 150 | `    function _entryConversion(uint128 outboundValue, TvmCell body)` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 151 | `        internal pure returns (uint64)` | — | https://docs.acki-nacki.org/solidity |
| 152 | `    {` | — | https://docs.acki-nacki.org/solidity |
| 153 | `        uint128 ownGas = _gasToNative(EST_GAS_ENTRY);` | — | https://docs.acki-nacki.org/solidity |
| 154 | `        uint128 fwd    = _estimateFwdFee(body);` | — | https://docs.acki-nacki.org/solidity |
| 155 | `        return uint64(ownGas + outboundValue + fwd);` | — | https://docs.acki-nacki.org/solidity |
| 156 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 157 | `` | — | https://docs.acki-nacki.org/solidity |
| 158 | `    /// Seqno-less replay protection: the timestamp is skipped, `expireAt`` | — | https://docs.acki-nacki.org/solidity |
| 159 | `    /// is enforced (exit 57) and capped at MAX_EXPIRE_HORIZON.` | — | https://docs.acki-nacki.org/solidity |
| 160 | `    function afterSignatureCheck(TvmSlice body, TvmCell /*message*/)` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 161 | `        private pure inline returns (TvmSlice)` | — | https://docs.acki-nacki.org/solidity |
| 162 | `    {` | — | https://docs.acki-nacki.org/solidity |
| 163 | `        body.load(uint64);                     // skip timestamp` | — | https://docs.acki-nacki.org/solidity |
| 164 | `        uint32 expireAt = body.load(uint32);` | — | https://docs.acki-nacki.org/solidity |
| 165 | `        require(expireAt > block.timestamp, 57);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 166 | `        require(expireAt <= block.timestamp + MAX_EXPIRE_HORIZON, ERR_EXPIRE_TOO_FAR);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 167 | `        return body;` | — | https://docs.acki-nacki.org/solidity |
| 168 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 169 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
