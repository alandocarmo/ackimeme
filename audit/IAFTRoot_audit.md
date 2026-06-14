# Audit – IAFTRoot.sol

*Source: `C:\Users\alanp\ackimeme\contracts\interfaces\IAFTRoot.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `// SPDX-License-Identifier: MIT` | — | https://docs.acki-nacki.org/solidity |
| 2 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `` | — | https://docs.acki-nacki.org/solidity |
| 4 | `interface IAFTRoot {` | — | [interfaces](https://docs.acki-nacki.org/solidity/interfaces.html) |
| 5 | `    function onAFTBurnNotification(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 6 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 7 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 8 | `        address sender,` | — | https://docs.acki-nacki.org/solidity |
| 9 | `        address responseDestination` | — | https://docs.acki-nacki.org/solidity |
| 10 | `    ) external functionID(0x7bdd97de);` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 11 | `` | — | https://docs.acki-nacki.org/solidity |
| 12 | `    /// Wallet → root callback after the credit is committed; root emits` | — | https://docs.acki-nacki.org/solidity |
| 13 | `    /// `AFTTransferred` on the activity channel.` | — | https://docs.acki-nacki.org/solidity |
| 14 | `    function recordTransfer(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 15 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 16 | `        address fromOwner,` | — | https://docs.acki-nacki.org/solidity |
| 17 | `        address toOwner,` | — | https://docs.acki-nacki.org/solidity |
| 18 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 19 | `        bool notifiedReceiver,` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 20 | `        uint256 forwardPayloadHash` | — | https://docs.acki-nacki.org/solidity |
| 21 | `    ) external functionID(0xae71da1a);` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 22 | `` | — | https://docs.acki-nacki.org/solidity |
| 23 | `    /// TEP-89 discovery; root replies via `takeWalletAddress`.` | — | https://docs.acki-nacki.org/solidity |
| 24 | `    function provideWalletAddress(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 25 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 26 | `        address ownerAddress,` | — | https://docs.acki-nacki.org/solidity |
| 27 | `        bool includeAddress` | — | https://docs.acki-nacki.org/solidity |
| 28 | `    ) external functionID(0x2c76b973);` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 29 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
