# Audit – DappConfig.sol

*Source: `C:\Users\alanp\ackimeme\contracts\DappConfig.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 2 | `pragma AbiHeader expire;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `pragma AbiHeader pubkey;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 4 | `` | — | https://docs.acki-nacki.org/solidity |
| 5 | `/// @title DappConfig` | — | https://docs.acki-nacki.org/solidity |
| 6 | `/// @notice Manages centralized gas replenishment for the Dapp ID ecosystem.` | — | https://docs.acki-nacki.org/solidity |
| 7 | `contract DappConfig {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 8 | `    uint128 public constant REPLENISH_THRESHOLD = 5 ton;` | — | https://docs.acki-nacki.org/solidity |
| 9 | `    uint128 public constant REPLENISH_AMOUNT = 10 ton;` | — | https://docs.acki-nacki.org/solidity |
| 10 | `` | — | https://docs.acki-nacki.org/solidity |
| 11 | `    constructor() {` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 12 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 13 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 14 | `` | — | https://docs.acki-nacki.org/solidity |
| 15 | `    function getTokens(address target) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 16 | `        require(msg.pubkey() == tvm.pubkey(), 100);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 17 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 18 | `        // Replenishes the target's execution gas (VMSHELL) up to the amount.` | — | https://docs.acki-nacki.org/solidity |
| 19 | `        // This is funded silently by the DappConfig's own VMSHELL balance.` | — | https://docs.acki-nacki.org/solidity |
| 20 | `        gosh.mintshell(uint64(REPLENISH_AMOUNT));` | — | https://docs.acki-nacki.org/solidity |
| 21 | `        target.transfer({ value: varuint16(REPLENISH_AMOUNT), flag: 0, bounce: false });` | — | https://docs.acki-nacki.org/solidity |
| 22 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 23 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
