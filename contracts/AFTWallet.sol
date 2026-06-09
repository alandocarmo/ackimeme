// SPDX-License-Identifier: MIT
pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./modifiers/modifiers.sol";
import "./interfaces/IAFTExcesses.sol";
import "./interfaces/IAFTReceiver.sol";
import "./interfaces/IAFTRoot.sol";
import "./interfaces/IAFTWallet.sol";

/// AFT wallet — TON jetton-wallet port.
///
/// Fuel model: each hop converts just enough SHELL for its own compute +
/// outbounds and forwards the surplus downstream (notification + excess
/// refund). `transfer` goes warm-first; on bounce it retries with a
/// cold-form deploy. `onAFTTransfer` is fire-and-forget (bounce:false,
/// TEP-74 lazy receiver — a missing or reverting owner handler can't roll
/// back the credit); burn keeps bounce:true so a failed burn-record
/// restores `_balance`. SHELL sent via `forwardShellAmount` to a
/// never-deployed owner stays parked at its address.
contract AFTWallet is Modifiers {
    string constant version = "1.0.0";

    address static _root;
    address static _owner;
    uint128 _balance;

    /// Cold-init via `new AFTWallet{stateInit}` when the destination wallet
    /// does not exist yet. Self-funds from inbound SHELL.
    constructor(
        uint64 queryId,
        uint128 amount,
        address from,
        address destOwner,
        address responseAddress,
        uint128 forwardShellAmount,
        TvmCell forwardPayload
    ) {
        // destOwner == _owner is guaranteed by the stateInit hash
        destOwner;
        bool isMint = msg.sender == _root && from == _root;
        bool isWalletTransfer = msg.sender == _getWalletAddress(from);
        require(isMint || isWalletTransfer, ERR_WRONG_WALLET);

        tvm.accept();
        _balance = amount;
        _runNotificationAndExcess(
            queryId, amount, from, responseAddress,
            forwardShellAmount, forwardPayload, isMint
        );
    }

    // ─── Owner-initiated outbound (TEP-74 0x0f8a7ea5) ─────────────────────
    // Entry hop: native arrives wiped cross-dapp, self-converts fuel.

    function transfer(
        uint64 queryId,
        uint128 amount,
        address destinationOwner,
        address responseDestination,
        optional(TvmCell) customPayload,
        uint128 forwardShellAmount,
        TvmCell forwardPayload
    ) public internalMsg functionID(0x0f8a7ea5) {
        require(msg.sender == _owner, ERR_INVALID_SENDER);
        require(amount > 0, ERR_ZERO_AMOUNT);
        require(_balance >= amount, ERR_LOW_BALANCE);
        // else a warm bounce would cold-deploy a wallet with _owner = 0
        require(destinationOwner != ZERO_ADDRESS, ERR_INVALID_SENDER);

        tvm.accept();
        customPayload;

        _balance -= amount;

        // body built upfront to estimate its fwd_fee
        TvmCell body = abi.encodeBody(
            IAFTWallet.internalTransfer,
            queryId, amount, _owner, destinationOwner, responseDestination,
            forwardShellAmount, forwardPayload
        );
        // own gas + outbound value + outbound fwd_fee
        uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)
                                 + uint128(SHELL_PER_HOP)
                                 + _estimateFwdFee(body));
        require(_inboundShell() >= conversion, ERR_INSUFFICIENT_FUEL);
        // gosh.cnvrtshellq(conversion);

        // forward inbound SHELL net of our conversion
        uint128 forward = _inboundShell() - uint128(conversion);
        mapping(uint32 => varuint32) outCc;
        if (forward > 0) outCc[CURRENCIES_ID_SHELL] = varuint32(forward);

        // warm-first; if the peer is uninit the msg bounces → cold retry
        address dest = _getWalletAddress(destinationOwner);
        IAFTWallet(dest).internalTransfer{
            value: varuint16(SHELL_PER_HOP),
            currencies: outCc,
            flag: 1,
            bounce: true
        }(queryId, amount, _owner, destinationOwner, responseDestination, forwardShellAmount, forwardPayload);
    }

    // ─── Owner-initiated burn (TEP-74 0x595f07bc) ─────────────────────────

    function burn(
        uint64 queryId,
        uint128 amount,
        address responseDestination,
        optional(TvmCell) customPayload
    ) public internalMsg functionID(0x595f07bc) {
        require(msg.sender == _owner, ERR_INVALID_SENDER);
        require(amount > 0, ERR_ZERO_AMOUNT);
        require(_balance >= amount, ERR_LOW_BALANCE);

        tvm.accept();
        customPayload;

        _balance -= amount;

        TvmCell body = abi.encodeBody(
            IAFTRoot.onAFTBurnNotification,
            queryId, amount, _owner, responseDestination
        );
        uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)
                                 + uint128(SHELL_PER_HOP)
                                 + _estimateFwdFee(body));
        require(_inboundShell() >= conversion, ERR_INSUFFICIENT_FUEL);
        // gosh.cnvrtshellq(conversion);

        uint128 forward = _inboundShell() - uint128(conversion);
        mapping(uint32 => varuint32) outCc;
        if (forward > 0) outCc[CURRENCIES_ID_SHELL] = varuint32(forward);

        IAFTRoot(_root).onAFTBurnNotification{
            value: varuint16(SHELL_PER_HOP),
            currencies: outCc,
            flag: 1,
            bounce: true
        }(queryId, amount, _owner, responseDestination);
    }

    // ─── Warm path: peer wallet already exists ────────────────────────────
    // Internal hop: same dapp, msg.value preserved.

    function internalTransfer(
        uint64 queryId,
        uint128 amount,
        address from,
        address destOwner,
        address responseAddress,
        uint128 forwardShellAmount,
        TvmCell forwardPayload
    ) public internalMsg functionID(0x178d4519) {
        // destOwner is bounce-recovery payload — unused on the happy path
        destOwner;
        bool isMint = msg.sender == _root && from == _root;
        bool isWalletTransfer = msg.sender == _getWalletAddress(from);
        require(isMint || isWalletTransfer, ERR_WRONG_WALLET);

        tvm.accept();
        _balance += amount;

        _runNotificationAndExcess(
            queryId, amount, from, responseAddress,
            forwardShellAmount, forwardPayload, isMint
        );
    }

    /// Notification (if forwardShellAmount > 0) + recordTransfer (if not a
    /// mint) + excess refund (if responseAddress set), all flag:1.
    /// Self-sizes its fuel conversion across the conditional outbounds.
    function _runNotificationAndExcess(
        uint64 queryId,
        uint128 amount,
        address from,
        address responseAddress,
        uint128 forwardShellAmount,
        TvmCell forwardPayload,
        bool isMint
    ) internal {
        bool hasNotification = forwardShellAmount > 0;
        bool hasRecord       = !isMint;
        bool hasResponse     = responseAddress != ZERO_ADDRESS;

        // bodies built upfront for fwd_fee estimation
        TvmCell notifBody = hasNotification
            ? abi.encodeBody(IAFTReceiver.onAFTTransfer, queryId, amount, from, forwardPayload)
            : TvmCell();
        TvmCell recordBody = hasRecord
            ? abi.encodeBody(IAFTRoot.recordTransfer, queryId, from, _owner, amount, hasNotification, tvm.hash(forwardPayload))
            : TvmCell();
        TvmCell excessBody = hasResponse
            ? abi.encodeBody(IAFTExcesses.onAFTExcesses, queryId)
            : TvmCell();

        // own gas + Σ(value_i + fwd_fee_i) for outbounds we'll actually send
        uint128 needed = _gasToNative(EST_GAS_ENTRY);
        if (hasNotification) {
            needed += uint128(SHELL_PER_HOP) + _estimateFwdFee(notifBody);
        }
        if (hasRecord) {
            needed += uint128(SHELL_PER_HOP) + _estimateFwdFee(recordBody);
        }
        if (hasResponse) {
            // excess outbounds carry value=0 — fwd_fee × split count only
            needed += uint128(EXCESS_SPLIT_COUNT) * _estimateFwdFee(excessBody);
        }
        uint64 conversion = uint64(needed);
        // gosh.cnvrtshellq(conversion);

        // action phase applies cnvrtshellq before processing outbounds
        uint128 budget = _currentShell();
        budget = budget > uint128(conversion) ? budget - uint128(conversion) : 0;
        bool notified = false;

        mapping(uint32 => varuint32) cc;

        if (hasNotification && budget >= forwardShellAmount) {
            cc[CURRENCIES_ID_SHELL] = varuint32(forwardShellAmount);
            // bounce:false — lazy receiver; _balance is already credited
            IAFTReceiver(_owner).onAFTTransfer{
                value: varuint16(SHELL_PER_HOP),
                currencies: cc,
                flag: 1,
                bounce: false
            }(queryId, amount, from, forwardPayload);
            notified = true;
            budget -= forwardShellAmount;
        }

        if (hasRecord) {
            // best-effort event aggregation; root self-funds via msg.value
            mapping(uint32 => varuint32) emptyCc;
            IAFTRoot(_root).recordTransfer{
                value: varuint16(SHELL_PER_HOP),
                currencies: emptyCc,
                flag: 1,
                bounce: false
            }(queryId, from, _owner, amount, notified, tvm.hash(forwardPayload));
        }

        // split refunds — action_code=38 trips on too much SHELL per outbound
        if (hasResponse) {
            for (uint8 i = 0; i < EXCESS_SPLIT_COUNT; i++) {
                if (budget == 0) break;
                uint128 amt = budget > SHELL_PER_EXCESS_MAX ? SHELL_PER_EXCESS_MAX : budget;
                cc[CURRENCIES_ID_SHELL] = varuint32(amt);
                IAFTExcesses(responseAddress).onAFTExcesses{
                    value: varuint16(0),
                    currencies: cc,
                    flag: 1,
                    bounce: false
                }(queryId);
                budget -= amt;
            }
        }
    }

    // ─── Bounce handling — stateless via body-ref decode ──────────────────

    onBounce(TvmSlice body) external {
        tvm.accept();

        uint32 op = body.load(uint32);
        uint64 queryId = body.load(uint64);
        uint128 amount = body.load(uint128);

        if (op == OP_INTERNAL_TRANSFER) {
            // warm bounce — peer didn't exist; retry cold-form
            TvmCell fullCell = body.loadRef();
            (
                uint32 fid,
                uint64 qId,
                uint128 amt,
                address from_,
                address destOwner,
                address responseAddress,
                uint128 forwardShellAmount,
                TvmCell forwardPayload
            ) = abi.decode(fullCell, (
                uint32, uint64, uint128, address, address, address, uint128, TvmCell
            ));
            fid; qId; amt; from_;

            TvmCell init = abi.encodeStateInit({
                contr: AFTWallet,
                varInit: {_root: _root, _owner: destOwner},
                code: tvm.code()
            });
            TvmCell coldBody = abi.encodeBody(
                AFTWallet,
                queryId, amount, _owner, destOwner, responseAddress,
                forwardShellAmount, forwardPayload
            );
            // own gas + cold-deploy value + body/stateInit fwd_fee
            uint128 deployBodySize = _estimateFwdFee(coldBody) + _estimateFwdFee(init);
            uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)
                                     + uint128(SHELL_PER_DEPLOY)
                                     + deployBodySize);
            // short on fuel — restore _balance instead of a partial commit
            if (_currentShell() < uint128(conversion)) {
                _balance += amount;
                return;
            }
            // gosh.cnvrtshellq(conversion);

            // forward all remaining SHELL — the new peer self-funds from it
            uint128 forward = _currentShell();
            forward = forward > uint128(conversion) ? forward - uint128(conversion) : 0;
            mapping(uint32 => varuint32) outCc;
            if (forward > 0) outCc[CURRENCIES_ID_SHELL] = varuint32(forward);

            new AFTWallet{
                stateInit: init,
                value: varuint16(SHELL_PER_DEPLOY),
                currencies: outCc,
                flag: 0,
                bounce: true
            }(queryId, amount, _owner, destOwner, responseAddress, forwardShellAmount, forwardPayload);
        } else if (op == 0x00000001) {
            // cold-form deploy also failed — restore balance
            _balance += amount;
        } else if (op == OP_BURN_NOTIFICATION) {
            _balance += amount;
        }
        // other ops: silent drop is safe — _balance is credited before any
        // outbound. Any new bounce:true outbound MUST extend the set above.
    }

    // ─── Views ────────────────────────────────────────────────────────────

    function getDetails() external view returns (
        address root,
        address owner,
        uint128 balance
    ) {
        return (_root, _owner, _balance);
    }

    /// Forward-fee estimate for `body` (~5% underestimate; `dest` unused).
    function estimateFwdFee(address dest, TvmCell body) external pure returns (uint128) {
        dest;
        return _estimateFwdFee(body);
    }

    function getFwdPrices() external pure returns (uint64 lumpPrice, uint64 bitPrice, uint64 cellPrice) {
        FwdPrices p = _loadFwdPrices();
        return (p.lumpPrice, p.bitPrice, p.cellPrice);
    }

    function getGasPrice() external pure returns (uint64 gasPrice) {
        return _loadGasPrice();
    }

    // ─── Internal helpers ─────────────────────────────────────────────────

    function _getWalletAddress(address walletOwner) internal view returns (address walletAddress) {
        TvmCell init = abi.encodeStateInit({
            contr: AFTWallet,
            varInit: {_root: _root, _owner: walletOwner},
            code: tvm.code()
        });
        walletAddress = address.makeAddrStd(0, tvm.hash(init));
    }
}
