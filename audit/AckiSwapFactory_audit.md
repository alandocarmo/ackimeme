# Audit – AckiSwapFactory.sol

*Source: `C:\Users\alanp\ackimeme\contracts\amm\AckiSwapFactory.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 2 | `pragma AbiHeader expire;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `pragma AbiHeader pubkey;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 4 | `` | — | https://docs.acki-nacki.org/solidity |
| 5 | `import "./AckiSwapPair.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 6 | `` | — | https://docs.acki-nacki.org/solidity |
| 7 | `interface IFactoryCallback {` | — | [interfaces](https://docs.acki-nacki.org/solidity/interfaces.html) |
| 8 | `    function onPairDeployed(address pair) external;` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 9 | `}` | — | https://docs.acki-nacki.org/solidity |
| 10 | `` | — | https://docs.acki-nacki.org/solidity |
| 11 | `contract AckiSwapFactory {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 12 | `    address static _owner;` | — | https://docs.acki-nacki.org/solidity |
| 13 | `    TvmCell static _pairCode;` | — | https://docs.acki-nacki.org/solidity |
| 14 | `` | — | https://docs.acki-nacki.org/solidity |
| 15 | `    address public feeRecipient;` | — | https://docs.acki-nacki.org/solidity |
| 16 | `    address public launchFactory;` | — | https://docs.acki-nacki.org/solidity |
| 17 | `` | — | https://docs.acki-nacki.org/solidity |
| 18 | `    mapping(address => bool) public approvedBondingCurves;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 19 | `` | — | https://docs.acki-nacki.org/solidity |
| 20 | `    event PairCreated(address tokenRoot, address pairAddress, uint64 timestamp);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 21 | `` | — | https://docs.acki-nacki.org/solidity |
| 22 | `    constructor(address _feeRecipient) {` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 23 | `        require(msg.pubkey() == tvm.pubkey(), 100);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 24 | `        require(_feeRecipient != address(0), 101, "Fee recipient cannot be zero");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 25 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 26 | `        feeRecipient = _feeRecipient;` | — | https://docs.acki-nacki.org/solidity |
| 27 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 28 | `` | — | https://docs.acki-nacki.org/solidity |
| 29 | `    function setFeeRecipient(address _feeRecipient) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 30 | `        require(msg.pubkey() == tvm.pubkey(), 100);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 31 | `        require(_feeRecipient != address(0), 101, "Fee recipient cannot be zero");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 32 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 33 | `        feeRecipient = _feeRecipient;` | — | https://docs.acki-nacki.org/solidity |
| 34 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 35 | `` | — | https://docs.acki-nacki.org/solidity |
| 36 | `    function setLaunchFactory(address _launchFactory) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 37 | `        require(msg.pubkey() == tvm.pubkey(), 100);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 38 | `        require(_launchFactory != address(0), 101, "LaunchFactory cannot be zero");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 39 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 40 | `        launchFactory = _launchFactory;` | — | https://docs.acki-nacki.org/solidity |
| 41 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 42 | `` | — | https://docs.acki-nacki.org/solidity |
| 43 | `    function approveBondingCurve(address bc) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 44 | `        require(msg.pubkey() == tvm.pubkey() \|\| msg.sender == launchFactory, 100);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 45 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 46 | `        approvedBondingCurves[bc] = true;` | — | https://docs.acki-nacki.org/solidity |
| 47 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 48 | `` | — | https://docs.acki-nacki.org/solidity |
| 49 | `    function deployPair(address tokenRoot, address callbackTarget) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 50 | `        require(approvedBondingCurves[msg.sender], 102, "Only approved BondingCurves can deploy pairs");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 51 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 52 | `        TvmCell stateInit = abi.encodeStateInit({` | — | https://docs.acki-nacki.org/solidity |
| 53 | `            contr: AckiSwapPair,` | — | https://docs.acki-nacki.org/solidity |
| 54 | `            varInit: {` | — | https://docs.acki-nacki.org/solidity |
| 55 | `                _factory: address(this),` | — | https://docs.acki-nacki.org/solidity |
| 56 | `                _tokenRoot: tokenRoot,` | — | https://docs.acki-nacki.org/solidity |
| 57 | `                _feeRecipient: feeRecipient` | — | https://docs.acki-nacki.org/solidity |
| 58 | `            },` | — | https://docs.acki-nacki.org/solidity |
| 59 | `            code: _pairCode` | — | https://docs.acki-nacki.org/solidity |
| 60 | `        });` | — | https://docs.acki-nacki.org/solidity |
| 61 | `` | — | https://docs.acki-nacki.org/solidity |
| 62 | `        address pair = new AckiSwapPair{` | — | https://docs.acki-nacki.org/solidity |
| 63 | `            stateInit: stateInit,` | — | https://docs.acki-nacki.org/solidity |
| 64 | `            value: 2000000000, // 2 SHELL` | — | https://docs.acki-nacki.org/solidity |
| 65 | `            flag: 0,` | — | https://docs.acki-nacki.org/solidity |
| 66 | `            bounce: false` | — | https://docs.acki-nacki.org/solidity |
| 67 | `        }(callbackTarget);` | — | https://docs.acki-nacki.org/solidity |
| 68 | `` | — | https://docs.acki-nacki.org/solidity |
| 69 | `        emit PairCreated(tokenRoot, pair, uint64(block.timestamp));` | — | https://docs.acki-nacki.org/solidity |
| 70 | `` | — | https://docs.acki-nacki.org/solidity |
| 71 | `        if (callbackTarget != address(0)) {` | — | https://docs.acki-nacki.org/solidity |
| 72 | `            // R7-C1: flag 64 would forward the inbound value, which arrives` | — | https://docs.acki-nacki.org/solidity |
| 73 | `            // zeroed cross-Dapp-ID — send an explicit non-zero value instead.` | — | https://docs.acki-nacki.org/solidity |
| 74 | `            IFactoryCallback(callbackTarget).onPairDeployed{value: 0.1 ton, flag: 1}(pair);` | — | https://docs.acki-nacki.org/solidity |
| 75 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 76 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 77 | `` | — | https://docs.acki-nacki.org/solidity |
| 78 | `    function getPairAddress(address tokenRoot) external view returns (address) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 79 | `        TvmCell stateInit = abi.encodeStateInit({` | — | https://docs.acki-nacki.org/solidity |
| 80 | `            contr: AckiSwapPair,` | — | https://docs.acki-nacki.org/solidity |
| 81 | `            varInit: {` | — | https://docs.acki-nacki.org/solidity |
| 82 | `                _factory: address(this),` | — | https://docs.acki-nacki.org/solidity |
| 83 | `                _tokenRoot: tokenRoot,` | — | https://docs.acki-nacki.org/solidity |
| 84 | `                _feeRecipient: feeRecipient` | — | https://docs.acki-nacki.org/solidity |
| 85 | `            },` | — | https://docs.acki-nacki.org/solidity |
| 86 | `            code: _pairCode` | — | https://docs.acki-nacki.org/solidity |
| 87 | `        });` | — | https://docs.acki-nacki.org/solidity |
| 88 | `        return address.makeAddrStd(0, tvm.hash(stateInit));` | — | https://docs.acki-nacki.org/solidity |
| 89 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 90 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
