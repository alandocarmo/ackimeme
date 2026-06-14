# Audit – IAFTWallet.sol

*Source: `C:\Users\alanp\ackimeme\contracts\interfaces\IAFTWallet.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `// SPDX-License-Identifier: MIT` | — | https://docs.acki-nacki.org/solidity |
| 2 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `` | — | https://docs.acki-nacki.org/solidity |
| 4 | `interface IAFTWallet {` | — | [interfaces](https://docs.acki-nacki.org/solidity/interfaces.html) |
| 5 | `    /// `destOwner` duplicates the receiver's `_owner` so a sender's` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 6 | `    /// `onBounce` can recover the destination from the bounced body.` | — | https://docs.acki-nacki.org/solidity |
| 7 | `    function internalTransfer(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 8 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 9 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 10 | `        address from,` | — | https://docs.acki-nacki.org/solidity |
| 11 | `        address destOwner,` | — | https://docs.acki-nacki.org/solidity |
| 12 | `        address responseAddress,` | — | https://docs.acki-nacki.org/solidity |
| 13 | `        uint128 forwardShellAmount,` | — | https://docs.acki-nacki.org/solidity |
| 14 | `        TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 15 | `    ) external functionID(0x178d4519);` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 16 | `` | — | https://docs.acki-nacki.org/solidity |
| 17 | `    function transfer(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 18 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 19 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 20 | `        address destinationOwner,` | — | https://docs.acki-nacki.org/solidity |
| 21 | `        address responseDestination,` | — | https://docs.acki-nacki.org/solidity |
| 22 | `        optional(TvmCell) customPayload,` | — | https://docs.acki-nacki.org/solidity |
| 23 | `        uint128 forwardShellAmount,` | — | https://docs.acki-nacki.org/solidity |
| 24 | `        TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 25 | `    ) external functionID(0x0f8a7ea5);` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 26 | `` | — | https://docs.acki-nacki.org/solidity |
| 27 | `    function burn(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 28 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 29 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 30 | `        address responseDestination,` | — | https://docs.acki-nacki.org/solidity |
| 31 | `        optional(TvmCell) customPayload` | — | https://docs.acki-nacki.org/solidity |
| 32 | `    ) external functionID(0x595f07bc);` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 33 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
