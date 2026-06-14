# Audit – AckiDNSRegistry.sol

*Source: `C:\Users\alanp\ackimeme\contracts\AckiDNSRegistry.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 2 | `pragma AbiHeader expire;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `pragma AbiHeader pubkey;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 4 | `` | — | https://docs.acki-nacki.org/solidity |
| 5 | `contract AckiDNSRegistry {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 6 | `    // Basic DNS Registry mapping `nameHash` to `TokenRoot`` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 7 | `` | — | https://docs.acki-nacki.org/solidity |
| 8 | `    address static _owner;` | — | https://docs.acki-nacki.org/solidity |
| 9 | `` | — | https://docs.acki-nacki.org/solidity |
| 10 | `    uint128 public constant REGISTRATION_FEE = 1000 * 1e9; // 1,000 SHELL ($10)` | — | https://docs.acki-nacki.org/solidity |
| 11 | `` | — | https://docs.acki-nacki.org/solidity |
| 12 | `    mapping(uint256 => address) public domains;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 13 | `` | — | https://docs.acki-nacki.org/solidity |
| 14 | `    event DomainRegistered(string name, address tokenRoot, address owner);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 15 | `` | — | https://docs.acki-nacki.org/solidity |
| 16 | `    constructor() {` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 17 | `        require(msg.pubkey() == tvm.pubkey(), 100);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 18 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 19 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 20 | `` | — | https://docs.acki-nacki.org/solidity |
| 21 | `    function registerDomain(string name, address tokenRoot) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 22 | `        // Require the fee to be attached` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 23 | `        require(msg.value >= REGISTRATION_FEE, 101, "Insufficient registration fee");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 24 | `` | — | https://docs.acki-nacki.org/solidity |
| 25 | `        tvm.rawReserve(0, 4); // Keep all balance before this message` | — | https://docs.acki-nacki.org/solidity |
| 26 | `` | — | https://docs.acki-nacki.org/solidity |
| 27 | `        uint256 nameHash = tvm.hash(name);` | — | https://docs.acki-nacki.org/solidity |
| 28 | `        require(!domains.exists(nameHash), 102, "Domain already registered");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 29 | `        require(tokenRoot != address(0), 103, "Invalid token root");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 30 | `` | — | https://docs.acki-nacki.org/solidity |
| 31 | `        domains[nameHash] = tokenRoot;` | — | https://docs.acki-nacki.org/solidity |
| 32 | `` | — | https://docs.acki-nacki.org/solidity |
| 33 | `        emit DomainRegistered(name, tokenRoot, msg.sender);` | — | https://docs.acki-nacki.org/solidity |
| 34 | `` | — | https://docs.acki-nacki.org/solidity |
| 35 | `        // Send excess gas back` | — | https://docs.acki-nacki.org/solidity |
| 36 | `        msg.sender.transfer({value: 0, flag: 128, bounce: false});` | — | https://docs.acki-nacki.org/solidity |
| 37 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 38 | `` | — | https://docs.acki-nacki.org/solidity |
| 39 | `    function resolveDomain(string name) external view returns (address) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 40 | `        uint256 nameHash = tvm.hash(name);` | — | https://docs.acki-nacki.org/solidity |
| 41 | `        if (domains.exists(nameHash)) {` | — | https://docs.acki-nacki.org/solidity |
| 42 | `            return domains[nameHash];` | — | https://docs.acki-nacki.org/solidity |
| 43 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 44 | `        return address(0);` | — | https://docs.acki-nacki.org/solidity |
| 45 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 46 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
