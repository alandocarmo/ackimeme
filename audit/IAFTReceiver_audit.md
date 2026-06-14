# Audit – IAFTReceiver.sol

*Source: `C:\Users\alanp\ackimeme\contracts\interfaces\IAFTReceiver.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `// SPDX-License-Identifier: MIT` | — | https://docs.acki-nacki.org/solidity |
| 2 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `` | — | https://docs.acki-nacki.org/solidity |
| 4 | `interface IAFTReceiver {` | — | [interfaces](https://docs.acki-nacki.org/solidity/interfaces.html) |
| 5 | `    function onAFTTransfer(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 6 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 7 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 8 | `        address sender,` | — | https://docs.acki-nacki.org/solidity |
| 9 | `        TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 10 | `    ) external functionID(0x7362d09c);` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 11 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
