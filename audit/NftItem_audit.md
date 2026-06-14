# Audit – NftItem.sol

*Source: `C:\Users\alanp\ackimeme\contracts\nft\NftItem.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 2 | `pragma AbiHeader expire;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `pragma AbiHeader pubkey;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 4 | `` | — | https://docs.acki-nacki.org/solidity |
| 5 | `contract NftItem {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 6 | `    address static _collection;` | — | https://docs.acki-nacki.org/solidity |
| 7 | `    uint256 static _id;` | — | https://docs.acki-nacki.org/solidity |
| 8 | `` | — | https://docs.acki-nacki.org/solidity |
| 9 | `    address public owner;` | — | https://docs.acki-nacki.org/solidity |
| 10 | `    string public jsonMetadata;` | — | https://docs.acki-nacki.org/solidity |
| 11 | `` | — | https://docs.acki-nacki.org/solidity |
| 12 | `    constructor(address _owner, string _jsonMetadata) {` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 13 | `        require(msg.sender == _collection, 100, "Only collection can mint");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 14 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 15 | `        owner = _owner;` | — | https://docs.acki-nacki.org/solidity |
| 16 | `        jsonMetadata = _jsonMetadata;` | — | https://docs.acki-nacki.org/solidity |
| 17 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 18 | `` | — | https://docs.acki-nacki.org/solidity |
| 19 | `    function transfer(address to) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 20 | `        require(msg.sender == owner, 101, "Not the owner");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 21 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 22 | `        owner = to;` | — | https://docs.acki-nacki.org/solidity |
| 23 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 24 | `` | — | https://docs.acki-nacki.org/solidity |
| 25 | `    function getInfo() external view returns (address collection, uint256 id, address itemOwner, string metadata) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 26 | `        return (_collection, _id, owner, jsonMetadata);` | — | https://docs.acki-nacki.org/solidity |
| 27 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 28 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
