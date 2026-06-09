// SPDX-License-Identifier: MIT
pragma tvm-solidity >= 0.76.1;

interface IAFTRoot {
    function onAFTBurnNotification(
        uint64 queryId,
        uint128 amount,
        address sender,
        address responseDestination
    ) external functionID(0x7bdd97de);

    /// Wallet → root callback after the credit is committed; root emits
    /// `AFTTransferred` on the activity channel.
    function recordTransfer(
        uint64 queryId,
        address fromOwner,
        address toOwner,
        uint128 amount,
        bool notifiedReceiver,
        uint256 forwardPayloadHash
    ) external functionID(0xae71da1a);

    /// TEP-89 discovery; root replies via `takeWalletAddress`.
    function provideWalletAddress(
        uint64 queryId,
        address ownerAddress,
        bool includeAddress
    ) external functionID(0x2c76b973);
}
