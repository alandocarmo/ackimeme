# Audit – LaunchFactory.sol

*Source: `C:\Users\alanp\ackimeme\contracts\LaunchFactory.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 2 | `pragma AbiHeader expire;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `pragma AbiHeader pubkey;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 4 | `` | — | https://docs.acki-nacki.org/solidity |
| 5 | `import "./AFTRoot.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 6 | `import "./BondingCurve.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 7 | `` | — | https://docs.acki-nacki.org/solidity |
| 8 | `contract LaunchFactory {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 9 | `    // ─── Events ───────────────────────────────────────────────────────────────` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 10 | `    event TokenLaunched(address tokenRoot, address bondingCurve, address creator, string name, string symbol);` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 11 | `` | — | https://docs.acki-nacki.org/solidity |
| 12 | `    // ─── State ────────────────────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 13 | `    address public owner;` | — | https://docs.acki-nacki.org/solidity |
| 14 | `    address public feeRecipient;` | — | https://docs.acki-nacki.org/solidity |
| 15 | `    uint32 public launchCount;` | — | https://docs.acki-nacki.org/solidity |
| 16 | `    address public ammFactory;` | — | https://docs.acki-nacki.org/solidity |
| 17 | `` | — | https://docs.acki-nacki.org/solidity |
| 18 | `    // TvmCells code of the contracts to be deployed` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 19 | `    TvmCell public tokenRootCode;` | — | https://docs.acki-nacki.org/solidity |
| 20 | `    TvmCell public bondingCurveCode;` | — | https://docs.acki-nacki.org/solidity |
| 21 | `    TvmCell public tokenWalletCode;` | — | https://docs.acki-nacki.org/solidity |
| 22 | `` | — | https://docs.acki-nacki.org/solidity |
| 23 | `    constructor(` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 24 | `        address _owner,` | — | https://docs.acki-nacki.org/solidity |
| 25 | `        address _feeRecipient,` | — | https://docs.acki-nacki.org/solidity |
| 26 | `        TvmCell _tokenRootCode,` | — | https://docs.acki-nacki.org/solidity |
| 27 | `        TvmCell _bondingCurveCode,` | — | https://docs.acki-nacki.org/solidity |
| 28 | `        TvmCell _tokenWalletCode` | — | https://docs.acki-nacki.org/solidity |
| 29 | `    ) {` | — | https://docs.acki-nacki.org/solidity |
| 30 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 31 | `        owner = _owner;` | — | https://docs.acki-nacki.org/solidity |
| 32 | `        feeRecipient = _feeRecipient;` | — | https://docs.acki-nacki.org/solidity |
| 33 | `        tokenRootCode = _tokenRootCode;` | — | https://docs.acki-nacki.org/solidity |
| 34 | `        bondingCurveCode = _bondingCurveCode;` | — | https://docs.acki-nacki.org/solidity |
| 35 | `        tokenWalletCode = _tokenWalletCode;` | — | https://docs.acki-nacki.org/solidity |
| 36 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 37 | `` | — | https://docs.acki-nacki.org/solidity |
| 38 | `    /// @notice Updates the code cells for future deployments` | — | https://docs.acki-nacki.org/solidity |
| 39 | `    function updateCodes(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 40 | `        TvmCell _tokenRootCode,` | — | https://docs.acki-nacki.org/solidity |
| 41 | `        TvmCell _bondingCurveCode,` | — | https://docs.acki-nacki.org/solidity |
| 42 | `        TvmCell _tokenWalletCode` | — | https://docs.acki-nacki.org/solidity |
| 43 | `    ) external {` | — | https://docs.acki-nacki.org/solidity |
| 44 | `        require(msg.sender == owner, 101, "Only owner");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 45 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 46 | `        tokenRootCode = _tokenRootCode;` | — | https://docs.acki-nacki.org/solidity |
| 47 | `        bondingCurveCode = _bondingCurveCode;` | — | https://docs.acki-nacki.org/solidity |
| 48 | `        tokenWalletCode = _tokenWalletCode;` | — | https://docs.acki-nacki.org/solidity |
| 49 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 50 | `` | — | https://docs.acki-nacki.org/solidity |
| 51 | `    function setFeeRecipient(address _feeRecipient) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 52 | `        require(msg.sender == owner, 101, "Only owner");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 53 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 54 | `        feeRecipient = _feeRecipient;` | — | https://docs.acki-nacki.org/solidity |
| 55 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 56 | `` | — | https://docs.acki-nacki.org/solidity |
| 57 | `    function setAmmFactory(address _ammFactory) external {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 58 | `        require(msg.sender == owner, 101, "Only owner can set AckiSwapFactory");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 59 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 60 | `        ammFactory = _ammFactory;` | — | https://docs.acki-nacki.org/solidity |
| 61 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 62 | `` | — | https://docs.acki-nacki.org/solidity |
| 63 | `    /// @notice Deploys the TokenRoot and BondingCurve via internal messages` | — | https://docs.acki-nacki.org/solidity |
| 64 | `    function deployTokenAndCurve(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 65 | `        string name,` | — | https://docs.acki-nacki.org/solidity |
| 66 | `        string symbol,` | — | https://docs.acki-nacki.org/solidity |
| 67 | `        uint8 decimals,` | — | https://docs.acki-nacki.org/solidity |
| 68 | `        uint256 supplyCap,` | — | https://docs.acki-nacki.org/solidity |
| 69 | `        address creator,` | — | https://docs.acki-nacki.org/solidity |
| 70 | `        bytes creationFeeTxHash,` | — | https://docs.acki-nacki.org/solidity |
| 71 | `        bool pumpForever,` | — | https://docs.acki-nacki.org/solidity |
| 72 | `        uint256 slopeDivisor` | — | https://docs.acki-nacki.org/solidity |
| 73 | `    ) external {` | — | https://docs.acki-nacki.org/solidity |
| 74 | `        require(msg.pubkey() == tvm.pubkey(), 100, "Only the factory platform can launch tokens");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 75 | `        // R7: without an AMM factory the curve deploys with ammFactory=0 and can` | — | https://docs.acki-nacki.org/solidity |
| 76 | `        // never migrate (and the approve below would burn value at address(0)).` | — | https://docs.acki-nacki.org/solidity |
| 77 | `        require(ammFactory != address(0), 103, "AMM factory not set (call setAmmFactory)");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 78 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 79 | `` | — | https://docs.acki-nacki.org/solidity |
| 80 | `        // Assume gas is provided via prefunding (address(this).balance). We need enough VMSHELL for two deployments + messages.` | — | https://docs.acki-nacki.org/solidity |
| 81 | `        require(address(this).balance >= 3 ton, 102, "Insufficient gas for launch (Factory must be prefunded)");` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 82 | `` | — | https://docs.acki-nacki.org/solidity |
| 83 | `        launchCount++;` | — | https://docs.acki-nacki.org/solidity |
| 84 | `` | — | https://docs.acki-nacki.org/solidity |
| 85 | `        // 1. Compute TokenRoot address deterministically based on static vars` | — | https://docs.acki-nacki.org/solidity |
| 86 | `` | — | https://docs.acki-nacki.org/solidity |
| 87 | `        TvmCell rootStateInit = tvm.buildStateInit({` | — | https://docs.acki-nacki.org/solidity |
| 88 | `            contr: AFTRoot,` | — | https://docs.acki-nacki.org/solidity |
| 89 | `            varInit: {` | — | https://docs.acki-nacki.org/solidity |
| 90 | `                _deployer: address(this),` | — | https://docs.acki-nacki.org/solidity |
| 91 | `                _name: name,` | — | https://docs.acki-nacki.org/solidity |
| 92 | `                _symbol: symbol,` | — | https://docs.acki-nacki.org/solidity |
| 93 | `                _decimals: decimals` | — | https://docs.acki-nacki.org/solidity |
| 94 | `            },` | — | https://docs.acki-nacki.org/solidity |
| 95 | `            code: tokenRootCode` | — | https://docs.acki-nacki.org/solidity |
| 96 | `        });` | — | https://docs.acki-nacki.org/solidity |
| 97 | `` | — | https://docs.acki-nacki.org/solidity |
| 98 | `        address tokenRootAddr = address(tvm.hash(rootStateInit));` | — | https://docs.acki-nacki.org/solidity |
| 99 | `` | — | https://docs.acki-nacki.org/solidity |
| 100 | `        // 2. Compute BondingCurve address` | — | https://docs.acki-nacki.org/solidity |
| 101 | `        TvmCell curveStateInit = tvm.buildStateInit({` | — | https://docs.acki-nacki.org/solidity |
| 102 | `            contr: BondingCurve,` | — | https://docs.acki-nacki.org/solidity |
| 103 | `            varInit: {` | — | https://docs.acki-nacki.org/solidity |
| 104 | `                _tokenRoot: tokenRootAddr,` | — | https://docs.acki-nacki.org/solidity |
| 105 | `                _supplyCap: supplyCap,` | — | https://docs.acki-nacki.org/solidity |
| 106 | `                _factory: address(this)` | — | https://docs.acki-nacki.org/solidity |
| 107 | `            },` | — | https://docs.acki-nacki.org/solidity |
| 108 | `            code: bondingCurveCode` | — | https://docs.acki-nacki.org/solidity |
| 109 | `        });` | — | https://docs.acki-nacki.org/solidity |
| 110 | `` | — | https://docs.acki-nacki.org/solidity |
| 111 | `        address bondingCurveAddr = address(tvm.hash(curveStateInit));` | — | https://docs.acki-nacki.org/solidity |
| 112 | `` | — | https://docs.acki-nacki.org/solidity |
| 113 | `        // 3. Deploy BondingCurve` | — | https://docs.acki-nacki.org/solidity |
| 114 | `        new BondingCurve{` | — | https://docs.acki-nacki.org/solidity |
| 115 | `            stateInit: curveStateInit,` | — | https://docs.acki-nacki.org/solidity |
| 116 | `            value: 1 ton,` | — | https://docs.acki-nacki.org/solidity |
| 117 | `            flag: 1` | — | https://docs.acki-nacki.org/solidity |
| 118 | `        }(` | — | https://docs.acki-nacki.org/solidity |
| 119 | `            creator,` | — | https://docs.acki-nacki.org/solidity |
| 120 | `            tokenRootAddr,` | — | https://docs.acki-nacki.org/solidity |
| 121 | `            name,` | — | https://docs.acki-nacki.org/solidity |
| 122 | `            symbol,` | — | https://docs.acki-nacki.org/solidity |
| 123 | `            creationFeeTxHash,` | — | https://docs.acki-nacki.org/solidity |
| 124 | `            feeRecipient,` | — | https://docs.acki-nacki.org/solidity |
| 125 | `            pumpForever,` | — | https://docs.acki-nacki.org/solidity |
| 126 | `            slopeDivisor,` | — | https://docs.acki-nacki.org/solidity |
| 127 | `            ammFactory` | — | https://docs.acki-nacki.org/solidity |
| 128 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 129 | `` | — | https://docs.acki-nacki.org/solidity |
| 130 | `        // 4. Deploy TokenRoot with BondingCurve as the permanent Admin` | — | https://docs.acki-nacki.org/solidity |
| 131 | `        TvmCell emptyContent;` | — | https://docs.acki-nacki.org/solidity |
| 132 | `        new AFTRoot{` | — | https://docs.acki-nacki.org/solidity |
| 133 | `            stateInit: rootStateInit,` | — | https://docs.acki-nacki.org/solidity |
| 134 | `            value: 1 ton,` | — | https://docs.acki-nacki.org/solidity |
| 135 | `            flag: 1` | — | https://docs.acki-nacki.org/solidity |
| 136 | `        }(` | — | https://docs.acki-nacki.org/solidity |
| 137 | `            bondingCurveAddr, // admin` | — | https://docs.acki-nacki.org/solidity |
| 138 | `            true, // mintable` | — | https://docs.acki-nacki.org/solidity |
| 139 | `            emptyContent, // content` | — | https://docs.acki-nacki.org/solidity |
| 140 | `            tokenWalletCode, // walletCode` | — | https://docs.acki-nacki.org/solidity |
| 141 | `            address(0), // initialOwner` | — | https://docs.acki-nacki.org/solidity |
| 142 | `            0 // initialSupply` | — | https://docs.acki-nacki.org/solidity |
| 143 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 144 | `` | — | https://docs.acki-nacki.org/solidity |
| 145 | `        emit TokenLaunched(tokenRootAddr, bondingCurveAddr, creator, name, symbol);` | — | https://docs.acki-nacki.org/solidity |
| 146 | `` | — | https://docs.acki-nacki.org/solidity |
| 147 | `        // 5. Post-Deploy Configuration` | — | https://docs.acki-nacki.org/solidity |
| 148 | `        // A1: Initialize the AFT wallet for the curve so it can sell/burn` | — | https://docs.acki-nacki.org/solidity |
| 149 | `        // 5. Initialize AFT Wallet for BondingCurve` | — | https://docs.acki-nacki.org/solidity |
| 150 | `        mapping(uint32 => varuint32) initCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 151 | `        initCc[2] = varuint32(2_000_000_000); // 2 SHELL (assuming SHELL_CURRENCY_ID=2)` | — | https://docs.acki-nacki.org/solidity |
| 152 | `        BondingCurve(bondingCurveAddr).initAftWallet{value: 0.2 ton, currencies: initCc, flag: 1}();` | — | https://docs.acki-nacki.org/solidity |
| 153 | `` | — | https://docs.acki-nacki.org/solidity |
| 154 | `        // 6. Approve the BondingCurve in the AckiSwapFactory` | — | https://docs.acki-nacki.org/solidity |
| 155 | `        IAckiSwapFactory(ammFactory).approveBondingCurve{value: 0.1 ton, flag: 1}(bondingCurveAddr);` | — | https://docs.acki-nacki.org/solidity |
| 156 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 157 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
