// SPDX-License-Identifier: MIT
pragma tvm-solidity >= 0.76.1;

import "./errors.sol";
import "./events.sol";

abstract contract Modifiers is Errors, Events {
    string constant versionModifiers = "1.0.0";

    uint constant bitCntAddress = 256;

    /// Replay-window cap for signed externals.
    uint32 constant MAX_EXPIRE_HORIZON = 15 * 60;

    uint constant FWD_FEE_MAX_VIEWED_CELLS = 256;     // cap on cell-tree walks

    int32 constant CONFIG_PARAM_FWD_PRICES_WC = 25;   // workchain MsgForwardPrices
    int32 constant CONFIG_PARAM_GAS_PRICES_WC = 21;   // workchain GasPrices

    struct FwdPrices {
        uint64 lumpPrice;
        uint64 bitPrice;
        uint64 cellPrice;
    }

    // ─── Event channels ───────────────────────────────────────────────────
    uint128 constant CHANNEL_ID_ACTIVITY = 740;
    uint128 constant CHANNEL_ID_ADMIN = 890;

    uint32 constant CURRENCIES_ID_SHELL = 2;

    uint16 constant DECIMALS_MAX = 18;

    // ─── Code-shape constants ─────────────────────────────────────────────

    /// Gas estimate for an entry-hop function; priced live via param 21.
    uint64 constant EST_GAS_ENTRY = 50_000;

    /// `value:` for one internal cascade hop (same dapp — native survives).
    uint64 constant SHELL_PER_HOP = 0.5 ton;

    /// Native attached to a cold-form wallet deploy.
    uint64 constant SHELL_PER_DEPLOY = 5 ton;

    // action_code=38 trips on too much SHELL per outbound — cap and split
    uint64 constant SHELL_PER_EXCESS_MAX = 15 ton;
    uint8  constant EXCESS_SPLIT_COUNT   = 3;

    // ─── Canonical TON jetton opcodes ─────────────────────────────────────
    uint32 constant OP_TRANSFER = 0x0f8a7ea5;
    uint32 constant OP_INTERNAL_TRANSFER = 0x178d4519;
    uint32 constant OP_TRANSFER_NOTIFICATION = 0x7362d09c;
    uint32 constant OP_EXCESSES = 0xd53276db;
    uint32 constant OP_BURN = 0x595f07bc;
    uint32 constant OP_BURN_NOTIFICATION = 0x7bdd97de;
    uint32 constant OP_PROVIDE_WALLET_ADDRESS = 0x2c76b973;
    uint32 constant OP_TAKE_WALLET_ADDRESS = 0xd1735400;

    address constant ZERO_ADDRESS = address.makeAddrStd(0, 0);

    modifier accept() {
        tvm.accept();
        _;
    }

    modifier senderIs(address sender) {
        require(msg.sender == sender, ERR_INVALID_SENDER);
        _;
    }

    modifier onlyAdmin(address admin) {
        require(msg.sender == admin, ERR_NOT_ADMIN);
        _;
    }

    modifier onlyPendingAdmin(address pendingAdmin) {
        require(msg.sender == pendingAdmin, ERR_NOT_PENDING_ADMIN);
        _;
    }

    function _activityChannel() internal pure returns (address) {
        return address.makeAddrExtern(CHANNEL_ID_ACTIVITY, bitCntAddress);
    }

    function _adminChannel() internal pure returns (address) {
        return address.makeAddrExtern(CHANNEL_ID_ADMIN, bitCntAddress);
    }

    /// Inbound SHELL attached to this message.
    function _inboundShell() internal pure returns (uint128) {
        return uint128(msg.currencies[CURRENCIES_ID_SHELL]);
    }

    /// Requires the caller attached at least `needed` SHELL fuel.
    function _requireFuel(uint128 needed) internal pure {
        require(_inboundShell() >= needed, ERR_INSUFFICIENT_FUEL);
    }

    /// Current SHELL balance (post-inbound credit).
    function _currentShell() internal pure returns (uint128) {
        return uint128(address(this).currencies[CURRENCIES_ID_SHELL]);
    }

    /// Current native balance.
    function _currentNative() internal pure returns (uint128) {
        return uint128(address(this).balance);
    }

    function _loadFwdPrices() internal pure returns (FwdPrices) {
        optional(TvmCell) cfgOpt = tvm.rawConfigParam(CONFIG_PARAM_FWD_PRICES_WC);
        require(cfgOpt.hasValue(), ERR_NO_FWD_PRICES);
        TvmSlice s = cfgOpt.get().toSlice();
        s.load(uint8);                     // skip tag
        uint64 lump = s.load(uint64);
        uint64 bit  = s.load(uint64);
        uint64 cell = s.load(uint64);
        return FwdPrices(lump, bit, cell);
    }

    function _loadGasPrice() internal pure returns (uint64 gasPrice) {
        optional(TvmCell) cfgOpt = tvm.rawConfigParam(CONFIG_PARAM_GAS_PRICES_WC);
        require(cfgOpt.hasValue(), ERR_NO_FWD_PRICES);
        TvmSlice s = cfgOpt.get().toSlice();
        // layout: tag, flat_gas_limit, flat_gas_price, reserved, gas_price
        (, , , , gasPrice) = s.load(uint8, uint64, uint64, uint8, uint64);
    }

    /// Gas units → native, rounded up.
    function _gasToNative(uint64 gasUnits) internal pure returns (uint128) {
        uint64 gp = _loadGasPrice();
        return math.muldivc(uint128(gasUnits), uint128(gp), 65536);
    }

    /// ~5% underestimate (body only, no envelope).
    function _estimateFwdFee(TvmCell body) internal pure returns (uint128) {
        FwdPrices p = _loadFwdPrices();
        (uint cells, uint bits, ) = body.dataSize(FWD_FEE_MAX_VIEWED_CELLS);
        // exclude the root cell — the executor measures envelope+body
        if (cells > 0) {
            cells -= 1;
            uint rootBits = body.toSlice().bits();
            bits = bits > rootBits ? bits - rootBits : 0;
        }
        uint128 fwdData = uint128(cells) * uint128(p.cellPrice)
                        + uint128(bits)  * uint128(p.bitPrice);
        return uint128(p.lumpPrice) + uint128((fwdData + 0xFFFF) >> 16);
    }

    /// Entry-hop fuel budget: own gas + outbound `value:` + outbound fwd_fee.
    function _entryConversion(uint128 outboundValue, TvmCell body)
        internal pure returns (uint64)
    {
        uint128 ownGas = _gasToNative(EST_GAS_ENTRY);
        uint128 fwd    = _estimateFwdFee(body);
        return uint64(ownGas + outboundValue + fwd);
    }

    /// Seqno-less replay protection: the timestamp is skipped, `expireAt`
    /// is enforced (exit 57) and capped at MAX_EXPIRE_HORIZON.
    function afterSignatureCheck(TvmSlice body, TvmCell /*message*/)
        private pure inline returns (TvmSlice)
    {
        body.load(uint64);                     // skip timestamp
        uint32 expireAt = body.load(uint32);
        require(expireAt > block.timestamp, 57);
        require(expireAt <= block.timestamp + MAX_EXPIRE_HORIZON, ERR_EXPIRE_TOO_FAR);
        return body;
    }
}
