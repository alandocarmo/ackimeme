// SPDX-License-Identifier: MIT
pragma tvm-solidity >= 0.76.1;

/// All activity events (mint/transfer/burn) are emitted by the root —
/// receiving wallets call back via `recordTransfer`, so one address carries
/// the token's full history. Activity = extern:740, admin = extern:890.
abstract contract Events {
    string constant versionEvents = "1.0.0";

    // ─── Activity / history (emitted by AFTRoot) ──────────────────────────

    event AFTMinted(
        uint64  queryId,
        address owner,
        uint128 amount,
        uint128 totalSupplyAfter,
        uint256 forwardPayloadHash,
        uint64  mintedAt
    );

    event AFTTransferred(
        uint64  queryId,
        address fromOwner,
        address toOwner,
        uint128 amount,
        bool    notifiedReceiver,
        uint256 forwardPayloadHash,
        uint64  transferredAt
    );

    event AFTBurned(
        uint64  queryId,
        address owner,
        uint128 amount,
        uint128 totalSupplyAfter,
        uint64  burnedAt
    );

    /// Mint whose cold-deploy retry also bounced; supply rolled back.
    event AFTMintRolledBack(
        uint64  queryId,
        uint128 amount,
        uint128 totalSupplyAfter,
        uint64  rolledBackAt
    );

    // ─── Admin / discovery ────────────────────────────────────────────────

    event RootConfigured(
        string  name,
        string  symbol,
        uint128 decimals,
        address admin,
        bool    mintable,
        uint64  configuredAt
    );

    event WalletAddressProvided(
        uint64  queryId,
        address requester,
        address owner,
        address wallet,
        bool    includeOwnerAddress,
        uint64  providedAt
    );

    event MintClosed(address admin, uint64 closedAt);

    event PendingAdminSet(
        address admin,
        address pendingAdmin,
        uint64  setAt
    );

    event AdminAccepted(
        address oldAdmin,
        address newAdmin,
        uint64  acceptedAt
    );

    event ContentUpdated(
        address admin,
        uint256 contentHash,
        uint64  updatedAt
    );
}
