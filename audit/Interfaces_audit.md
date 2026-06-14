# Audit – Interfaces.sol

*Source: `C:\Users\alanp\ackimeme\contracts\Interfaces.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 2 | `` | — | https://docs.acki-nacki.org/solidity |
| 3 | `// ─── Shared Interfaces ──────────────────────────────────────────────────────` | — | [interfaces](https://docs.acki-nacki.org/solidity/interfaces.html) |
| 4 | `// All cross-contract interfaces in one file to avoid duplicate declarations` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 5 | `// when contracts import each other.` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 6 | `` | — | https://docs.acki-nacki.org/solidity |
| 7 | `interface IAFTRootAdmin {` | — | [interfaces](https://docs.acki-nacki.org/solidity/interfaces.html) |
| 8 | `    function mint(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 9 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 10 | `        address toOwner,` | — | https://docs.acki-nacki.org/solidity |
| 11 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 12 | `        address responseDestination,` | — | https://docs.acki-nacki.org/solidity |
| 13 | `        uint128 forwardShellAmount,` | — | https://docs.acki-nacki.org/solidity |
| 14 | `        TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 15 | `    ) external;` | — | https://docs.acki-nacki.org/solidity |
| 16 | `}` | — | https://docs.acki-nacki.org/solidity |
| 17 | `` | — | https://docs.acki-nacki.org/solidity |
| 18 | `interface IBondingCurve {` | — | [interfaces](https://docs.acki-nacki.org/solidity/interfaces.html) |
| 19 | `    function onTokenBurned(uint32 burnNonce, uint256 amount, address refundAddress, uint128 minShellOut) external;` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 20 | `    function onMintSuccess(uint32 mintNonce) external;` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 21 | `    function onMintFailed(uint32 mintNonce) external;` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 22 | `}` | — | https://docs.acki-nacki.org/solidity |
| 23 | `` | — | https://docs.acki-nacki.org/solidity |
| 24 | `// ─── I-06: Shared gas constants ──────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 25 | `// Extracted from BondingCurve, TokenRoot, and TokenWallet to avoid duplication.` | — | https://docs.acki-nacki.org/solidity |
| 26 | `// Contracts can reference these via GasConstants.GAS_TOP_UP etc.` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 27 | `// NOTE: TVM-Solidity libraries with constants are inlined at compile time,` | — | https://docs.acki-nacki.org/solidity |
| 28 | `// so there is no extra deployment cost or cross-contract call overhead.` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 29 | `library GasConstants {` | — | [libraries](https://docs.acki-nacki.org/solidity/libraries.html) |
| 30 | `    uint64 constant GAS_TOP_UP = 2_000_000_000;        // 2 VMSHELL in nano` | — | https://docs.acki-nacki.org/solidity |
| 31 | `    uint128 constant MIN_EXECUTION_GAS = 1 ton;         // 1 VMSHELL threshold` | — | https://docs.acki-nacki.org/solidity |
| 32 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
