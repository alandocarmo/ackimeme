// SPDX-License-Identifier: MIT
pragma tvm-solidity >= 0.76.1;

interface IAFTWallet {
    /// `destOwner` duplicates the receiver's `_owner` so a sender's
    /// `onBounce` can recover the destination from the bounced body.
    function internalTransfer(
        uint64 queryId,
        uint128 amount,
        address from,
        address destOwner,
        address responseAddress,
        uint128 forwardShellAmount,
        TvmCell forwardPayload
    ) external functionID(0x178d4519);

    function transfer(
        uint64 queryId,
        uint128 amount,
        address destinationOwner,
        address responseDestination,
        optional(TvmCell) customPayload,
        uint128 forwardShellAmount,
        TvmCell forwardPayload
    ) external functionID(0x0f8a7ea5);

    function burn(
        uint64 queryId,
        uint128 amount,
        address responseDestination,
        optional(TvmCell) customPayload
    ) external functionID(0x595f07bc);
}
