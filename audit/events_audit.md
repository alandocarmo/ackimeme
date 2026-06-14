# Audit – events.sol

*Source: `C:\Users\alanp\ackimeme\contracts\modifiers\events.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `// SPDX-License-Identifier: MIT` | — | https://docs.acki-nacki.org/solidity |
| 2 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `` | — | https://docs.acki-nacki.org/solidity |
| 4 | `/// All activity events (mint/transfer/burn) are emitted by the root —` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 5 | `/// receiving wallets call back via `recordTransfer`, so one address carries` | — | https://docs.acki-nacki.org/solidity |
| 6 | `/// the token's full history. Activity = extern:740, admin = extern:890.` | — | https://docs.acki-nacki.org/solidity |
| 7 | `abstract contract Events {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 8 | `    string constant versionEvents = "1.0.0";` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 9 | `` | — | https://docs.acki-nacki.org/solidity |
| 10 | `    // ─── Activity / history (emitted by AFTRoot) ──────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 11 | `` | — | https://docs.acki-nacki.org/solidity |
| 12 | `    event AFTMinted(` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 13 | `        uint64  queryId,` | — | https://docs.acki-nacki.org/solidity |
| 14 | `        address owner,` | — | https://docs.acki-nacki.org/solidity |
| 15 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 16 | `        uint128 totalSupplyAfter,` | — | https://docs.acki-nacki.org/solidity |
| 17 | `        uint256 forwardPayloadHash,` | — | https://docs.acki-nacki.org/solidity |
| 18 | `        uint64  mintedAt` | — | https://docs.acki-nacki.org/solidity |
| 19 | `    );` | — | https://docs.acki-nacki.org/solidity |
| 20 | `` | — | https://docs.acki-nacki.org/solidity |
| 21 | `    event AFTTransferred(` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 22 | `        uint64  queryId,` | — | https://docs.acki-nacki.org/solidity |
| 23 | `        address fromOwner,` | — | https://docs.acki-nacki.org/solidity |
| 24 | `        address toOwner,` | — | https://docs.acki-nacki.org/solidity |
| 25 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 26 | `        bool    notifiedReceiver,` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 27 | `        uint256 forwardPayloadHash,` | — | https://docs.acki-nacki.org/solidity |
| 28 | `        uint64  transferredAt` | — | https://docs.acki-nacki.org/solidity |
| 29 | `    );` | — | https://docs.acki-nacki.org/solidity |
| 30 | `` | — | https://docs.acki-nacki.org/solidity |
| 31 | `    event AFTBurned(` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 32 | `        uint64  queryId,` | — | https://docs.acki-nacki.org/solidity |
| 33 | `        address owner,` | — | https://docs.acki-nacki.org/solidity |
| 34 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 35 | `        uint128 totalSupplyAfter,` | — | https://docs.acki-nacki.org/solidity |
| 36 | `        uint64  burnedAt` | — | https://docs.acki-nacki.org/solidity |
| 37 | `    );` | — | https://docs.acki-nacki.org/solidity |
| 38 | `` | — | https://docs.acki-nacki.org/solidity |
| 39 | `    /// Mint whose cold-deploy retry also bounced; supply rolled back.` | — | https://docs.acki-nacki.org/solidity |
| 40 | `    event AFTMintRolledBack(` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 41 | `        uint64  queryId,` | — | https://docs.acki-nacki.org/solidity |
| 42 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 43 | `        uint128 totalSupplyAfter,` | — | https://docs.acki-nacki.org/solidity |
| 44 | `        uint64  rolledBackAt` | — | https://docs.acki-nacki.org/solidity |
| 45 | `    );` | — | https://docs.acki-nacki.org/solidity |
| 46 | `` | — | https://docs.acki-nacki.org/solidity |
| 47 | `    // ─── Admin / discovery ────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 48 | `` | — | https://docs.acki-nacki.org/solidity |
| 49 | `    event RootConfigured(` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 50 | `        string  name,` | — | https://docs.acki-nacki.org/solidity |
| 51 | `        string  symbol,` | — | https://docs.acki-nacki.org/solidity |
| 52 | `        uint128 decimals,` | — | https://docs.acki-nacki.org/solidity |
| 53 | `        address admin,` | — | https://docs.acki-nacki.org/solidity |
| 54 | `        bool    mintable,` | — | https://docs.acki-nacki.org/solidity |
| 55 | `        uint64  configuredAt` | — | https://docs.acki-nacki.org/solidity |
| 56 | `    );` | — | https://docs.acki-nacki.org/solidity |
| 57 | `` | — | https://docs.acki-nacki.org/solidity |
| 58 | `    event WalletAddressProvided(` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 59 | `        uint64  queryId,` | — | https://docs.acki-nacki.org/solidity |
| 60 | `        address requester,` | — | https://docs.acki-nacki.org/solidity |
| 61 | `        address owner,` | — | https://docs.acki-nacki.org/solidity |
| 62 | `        address wallet,` | — | https://docs.acki-nacki.org/solidity |
| 63 | `        bool    includeOwnerAddress,` | — | https://docs.acki-nacki.org/solidity |
| 64 | `        uint64  providedAt` | — | https://docs.acki-nacki.org/solidity |
| 65 | `    );` | — | https://docs.acki-nacki.org/solidity |
| 66 | `` | — | https://docs.acki-nacki.org/solidity |
| 67 | `    event MintClosed(address admin, uint64 closedAt);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 68 | `` | — | https://docs.acki-nacki.org/solidity |
| 69 | `    event PendingAdminSet(` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 70 | `        address admin,` | — | https://docs.acki-nacki.org/solidity |
| 71 | `        address pendingAdmin,` | — | https://docs.acki-nacki.org/solidity |
| 72 | `        uint64  setAt` | — | https://docs.acki-nacki.org/solidity |
| 73 | `    );` | — | https://docs.acki-nacki.org/solidity |
| 74 | `` | — | https://docs.acki-nacki.org/solidity |
| 75 | `    event AdminAccepted(` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 76 | `        address oldAdmin,` | — | https://docs.acki-nacki.org/solidity |
| 77 | `        address newAdmin,` | — | https://docs.acki-nacki.org/solidity |
| 78 | `        uint64  acceptedAt` | — | https://docs.acki-nacki.org/solidity |
| 79 | `    );` | — | https://docs.acki-nacki.org/solidity |
| 80 | `` | — | https://docs.acki-nacki.org/solidity |
| 81 | `    event ContentUpdated(` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 82 | `        address admin,` | — | https://docs.acki-nacki.org/solidity |
| 83 | `        uint256 contentHash,` | — | https://docs.acki-nacki.org/solidity |
| 84 | `        uint64  updatedAt` | — | https://docs.acki-nacki.org/solidity |
| 85 | `    );` | — | https://docs.acki-nacki.org/solidity |
| 86 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
