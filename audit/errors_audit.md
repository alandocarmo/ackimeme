# Audit – errors.sol

*Source: `C:\Users\alanp\ackimeme\contracts\modifiers\errors.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `// SPDX-License-Identifier: MIT` | — | https://docs.acki-nacki.org/solidity |
| 2 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `` | — | https://docs.acki-nacki.org/solidity |
| 4 | `abstract contract Errors {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 5 | `    string constant versionErrors = "1.0.0";` | — | https://docs.acki-nacki.org/solidity |
| 6 | `` | — | https://docs.acki-nacki.org/solidity |
| 7 | `    uint16 constant ERR_NOT_ADMIN = 101;` | — | https://docs.acki-nacki.org/solidity |
| 8 | `    uint16 constant ERR_NOT_PENDING_ADMIN = 102;` | — | https://docs.acki-nacki.org/solidity |
| 9 | `    uint16 constant ERR_INVALID_SENDER = 103;` | — | https://docs.acki-nacki.org/solidity |
| 10 | `    uint16 constant ERR_LOW_BALANCE = 104;` | — | https://docs.acki-nacki.org/solidity |
| 11 | `    uint16 constant ERR_MINT_DISABLED = 105;` | — | https://docs.acki-nacki.org/solidity |
| 12 | `    uint16 constant ERR_WRONG_WALLET = 106;` | — | https://docs.acki-nacki.org/solidity |
| 13 | `    uint16 constant ERR_TOO_BIG_DECIMALS = 107;` | — | https://docs.acki-nacki.org/solidity |
| 14 | `    uint16 constant ERR_ZERO_AMOUNT = 108;` | — | https://docs.acki-nacki.org/solidity |
| 15 | `    uint16 constant ERR_INSUFFICIENT_FUEL = 109;` | — | https://docs.acki-nacki.org/solidity |
| 16 | `    uint16 constant ERR_DUPLICATE_QUERY = 110;` | — | https://docs.acki-nacki.org/solidity |
| 17 | `` | — | https://docs.acki-nacki.org/solidity |
| 18 | `    uint16 constant ERR_EXPIRE_TOO_FAR = 222;      // expireAt beyond MAX_EXPIRE_HORIZON` | — | https://docs.acki-nacki.org/solidity |
| 19 | `    uint16 constant ERR_NO_FWD_PRICES = 223;       // config param 25/21 absent` | — | https://docs.acki-nacki.org/solidity |
| 20 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
