# Audit – NftCollection.sol

*Source: `C:\Users\alanp\ackimeme\contracts\nft\NftCollection.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 2 | `pragma AbiHeader expire;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `pragma AbiHeader pubkey;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 4 | `` | — | https://docs.acki-nacki.org/solidity |
| 5 | `import "./NftItem.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 6 | `` | — | https://docs.acki-nacki.org/solidity |
| 7 | `contract NftCollection {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 8 | `    address static _owner;` | — | https://docs.acki-nacki.org/solidity |
| 9 | `    TvmCell static _nftItemCode;` | — | https://docs.acki-nacki.org/solidity |
| 10 | `` | — | https://docs.acki-nacki.org/solidity |
| 11 | `    uint256 public totalSupply;` | — | https://docs.acki-nacki.org/solidity |
| 12 | `` | — | https://docs.acki-nacki.org/solidity |
| 13 | `    event NftMinted(uint256 id, address owner, string metadata);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 14 | `` | — | https://docs.acki-nacki.org/solidity |
| 15 | `    constructor() {` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 16 | `        require(msg.pubkey() == tvm.pubkey(), 100);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 17 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 18 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 19 | `` | — | https://docs.acki-nacki.org/solidity |
| 20 | `    function mintCreatorBadge(address creator, string tokenTicker, string tokenImage) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 21 | `        require(msg.sender == _owner, 101);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 22 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 23 | `` | — | https://docs.acki-nacki.org/solidity |
| 24 | `        uint256 id = totalSupply;` | — | https://docs.acki-nacki.org/solidity |
| 25 | `        totalSupply++;` | — | https://docs.acki-nacki.org/solidity |
| 26 | `` | — | https://docs.acki-nacki.org/solidity |
| 27 | `        string metadata = '{"name":"Ackimeme Creator: ';` | — | https://docs.acki-nacki.org/solidity |
| 28 | `        metadata.append(tokenTicker);` | — | https://docs.acki-nacki.org/solidity |
| 29 | `        metadata.append('","description":"Official Creator Badge","image":"');` | — | https://docs.acki-nacki.org/solidity |
| 30 | `        metadata.append(tokenImage);` | — | https://docs.acki-nacki.org/solidity |
| 31 | `        metadata.append('"}');` | — | https://docs.acki-nacki.org/solidity |
| 32 | `` | — | https://docs.acki-nacki.org/solidity |
| 33 | `        TvmCell stateInit = abi.encodeStateInit({` | — | https://docs.acki-nacki.org/solidity |
| 34 | `            contr: NftItem,` | — | https://docs.acki-nacki.org/solidity |
| 35 | `            varInit: {` | — | https://docs.acki-nacki.org/solidity |
| 36 | `                _collection: address(this),` | — | https://docs.acki-nacki.org/solidity |
| 37 | `                _id: id` | — | https://docs.acki-nacki.org/solidity |
| 38 | `            },` | — | https://docs.acki-nacki.org/solidity |
| 39 | `            code: _nftItemCode` | — | https://docs.acki-nacki.org/solidity |
| 40 | `        });` | — | https://docs.acki-nacki.org/solidity |
| 41 | `` | — | https://docs.acki-nacki.org/solidity |
| 42 | `        address nft = new NftItem{` | — | https://docs.acki-nacki.org/solidity |
| 43 | `            stateInit: stateInit,` | — | https://docs.acki-nacki.org/solidity |
| 44 | `            value: 0.5 ever,` | — | https://docs.acki-nacki.org/solidity |
| 45 | `            flag: 0,` | — | https://docs.acki-nacki.org/solidity |
| 46 | `            bounce: false` | — | https://docs.acki-nacki.org/solidity |
| 47 | `        }(creator, metadata);` | — | https://docs.acki-nacki.org/solidity |
| 48 | `` | — | https://docs.acki-nacki.org/solidity |
| 49 | `        emit NftMinted(id, creator, metadata);` | — | https://docs.acki-nacki.org/solidity |
| 50 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 51 | `` | — | https://docs.acki-nacki.org/solidity |
| 52 | `    function resolveNft(uint256 id) external view returns (address) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 53 | `        TvmCell stateInit = abi.encodeStateInit({` | — | https://docs.acki-nacki.org/solidity |
| 54 | `            contr: NftItem,` | — | https://docs.acki-nacki.org/solidity |
| 55 | `            varInit: {` | — | https://docs.acki-nacki.org/solidity |
| 56 | `                _collection: address(this),` | — | https://docs.acki-nacki.org/solidity |
| 57 | `                _id: id` | — | https://docs.acki-nacki.org/solidity |
| 58 | `            },` | — | https://docs.acki-nacki.org/solidity |
| 59 | `            code: _nftItemCode` | — | https://docs.acki-nacki.org/solidity |
| 60 | `        });` | — | https://docs.acki-nacki.org/solidity |
| 61 | `        return address.makeAddrStd(0, tvm.hash(stateInit));` | — | https://docs.acki-nacki.org/solidity |
| 62 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 63 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
