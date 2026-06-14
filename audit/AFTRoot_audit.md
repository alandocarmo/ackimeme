# Audit – AFTRoot.sol

*Source: `C:\Users\alanp\ackimeme\contracts\AFTRoot.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `// SPDX-License-Identifier: MIT` | — | https://docs.acki-nacki.org/solidity |
| 2 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `pragma AbiHeader expire;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 4 | `pragma AbiHeader pubkey;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 5 | `` | — | https://docs.acki-nacki.org/solidity |
| 6 | `import "./modifiers/modifiers.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 7 | `import "./interfaces/IAFTExcesses.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 8 | `import "./interfaces/IAFTWallet.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 9 | `import "./interfaces/IAFTWalletAddressReceiver.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 10 | `import "./AFTWallet.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 11 | `` | — | https://docs.acki-nacki.org/solidity |
| 12 | `/// AFT root — TON jetton-master (discoverable) port.` | — | https://docs.acki-nacki.org/solidity |
| 13 | `///` | — | https://docs.acki-nacki.org/solidity |
| 14 | `/// Mint follows the same warm-first / onBounce-cold-retry pattern as` | — | https://docs.acki-nacki.org/solidity |
| 15 | `/// wallet→wallet transfer.` | — | https://docs.acki-nacki.org/solidity |
| 16 | `contract AFTRoot is Modifiers {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 17 | `    string constant version = "1.0.0";` | — | https://docs.acki-nacki.org/solidity |
| 18 | `` | — | https://docs.acki-nacki.org/solidity |
| 19 | `    address static _deployer;` | — | https://docs.acki-nacki.org/solidity |
| 20 | `    string static _name;` | — | https://docs.acki-nacki.org/solidity |
| 21 | `    string static _symbol;` | — | https://docs.acki-nacki.org/solidity |
| 22 | `    uint128 static _decimals;` | — | https://docs.acki-nacki.org/solidity |
| 23 | `` | — | https://docs.acki-nacki.org/solidity |
| 24 | `    address _admin;` | — | https://docs.acki-nacki.org/solidity |
| 25 | `    address _pendingAdmin;` | — | https://docs.acki-nacki.org/solidity |
| 26 | `    bool _mintable;` | — | https://docs.acki-nacki.org/solidity |
| 27 | `    uint128 _totalSupply;` | — | https://docs.acki-nacki.org/solidity |
| 28 | `` | — | https://docs.acki-nacki.org/solidity |
| 29 | `    TvmCell _content;` | — | https://docs.acki-nacki.org/solidity |
| 30 | `    TvmCell _walletCode;` | — | https://docs.acki-nacki.org/solidity |
| 31 | `` | — | https://docs.acki-nacki.org/solidity |
| 32 | `    /// Dual deploy auth: `_deployer` contract path OR `tvm.pubkey()` keypair` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 33 | `    /// path — set exactly one in the stateInit.` | — | https://docs.acki-nacki.org/solidity |
| 34 | `    constructor(` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 35 | `        address admin,` | — | https://docs.acki-nacki.org/solidity |
| 36 | `        bool mintable,` | — | https://docs.acki-nacki.org/solidity |
| 37 | `        TvmCell content,` | — | https://docs.acki-nacki.org/solidity |
| 38 | `        TvmCell walletCode,` | — | https://docs.acki-nacki.org/solidity |
| 39 | `        address initialOwner,` | — | https://docs.acki-nacki.org/solidity |
| 40 | `        uint128 initialSupply` | — | https://docs.acki-nacki.org/solidity |
| 41 | `    ) {` | — | https://docs.acki-nacki.org/solidity |
| 42 | `        bool byContract = _deployer != ZERO_ADDRESS && msg.sender == _deployer;` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 43 | `        bool byKeys = tvm.pubkey() != 0 && msg.pubkey() == tvm.pubkey();` | — | https://docs.acki-nacki.org/solidity |
| 44 | `        require(byContract \|\| byKeys, ERR_INVALID_SENDER);` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 45 | `        require(_decimals <= DECIMALS_MAX, ERR_TOO_BIG_DECIMALS);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 46 | `        // admin == 0 would collide with external msg.sender in onlyAdmin` | — | https://docs.acki-nacki.org/solidity |
| 47 | `        require(admin != ZERO_ADDRESS, ERR_INVALID_SENDER);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 48 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 49 | `` | — | https://docs.acki-nacki.org/solidity |
| 50 | `        _admin = admin;` | — | https://docs.acki-nacki.org/solidity |
| 51 | `        _content = content;` | — | https://docs.acki-nacki.org/solidity |
| 52 | `        _walletCode = walletCode;` | — | https://docs.acki-nacki.org/solidity |
| 53 | `` | — | https://docs.acki-nacki.org/solidity |
| 54 | `        emit RootConfigured{dest: _adminChannel()}(` | — | https://docs.acki-nacki.org/solidity |
| 55 | `            _name,` | — | https://docs.acki-nacki.org/solidity |
| 56 | `            _symbol,` | — | https://docs.acki-nacki.org/solidity |
| 57 | `            _decimals,` | — | https://docs.acki-nacki.org/solidity |
| 58 | `            admin,` | — | https://docs.acki-nacki.org/solidity |
| 59 | `            mintable,` | — | https://docs.acki-nacki.org/solidity |
| 60 | `            uint64(block.timestamp)` | — | https://docs.acki-nacki.org/solidity |
| 61 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 62 | `` | — | https://docs.acki-nacki.org/solidity |
| 63 | `        // force mint on to seed initialSupply, then lock to caller intent` | — | https://docs.acki-nacki.org/solidity |
| 64 | `        _mintable = true;` | — | https://docs.acki-nacki.org/solidity |
| 65 | `        if (initialSupply > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 66 | `            _mint(initialOwner, initialSupply, 0, ZERO_ADDRESS, 0, TvmCell());` | — | https://docs.acki-nacki.org/solidity |
| 67 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 68 | `        _mintable = mintable;` | — | https://docs.acki-nacki.org/solidity |
| 69 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 70 | `` | — | https://docs.acki-nacki.org/solidity |
| 71 | `    // ─── Admin ────────────────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 72 | `` | — | https://docs.acki-nacki.org/solidity |
| 73 | `    function mint(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 74 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 75 | `        address toOwner,` | — | https://docs.acki-nacki.org/solidity |
| 76 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 77 | `        address responseDestination,` | — | https://docs.acki-nacki.org/solidity |
| 78 | `        uint128 forwardShellAmount,` | — | https://docs.acki-nacki.org/solidity |
| 79 | `        TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 80 | `    ) public internalMsg onlyAdmin(_admin) functionID(0x2786d61d) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 81 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 82 | `        _mint(toOwner, amount, queryId, responseDestination, forwardShellAmount, forwardPayload);` | — | https://docs.acki-nacki.org/solidity |
| 83 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 84 | `` | — | https://docs.acki-nacki.org/solidity |
| 85 | `    function closeMint() public internalMsg onlyAdmin(_admin) accept functionID(0x58f5d4f2) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 86 | `        _mintable = false;` | — | https://docs.acki-nacki.org/solidity |
| 87 | `        emit MintClosed{dest: _adminChannel()}(_admin, uint64(block.timestamp));` | — | https://docs.acki-nacki.org/solidity |
| 88 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 89 | `` | — | https://docs.acki-nacki.org/solidity |
| 90 | `    function setPendingAdmin(address newAdmin) public internalMsg onlyAdmin(_admin) accept functionID(0x1b1064d7) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 91 | `        _pendingAdmin = newAdmin;` | — | https://docs.acki-nacki.org/solidity |
| 92 | `        emit PendingAdminSet{dest: _adminChannel()}(_admin, newAdmin, uint64(block.timestamp));` | — | https://docs.acki-nacki.org/solidity |
| 93 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 94 | `` | — | https://docs.acki-nacki.org/solidity |
| 95 | `    function acceptAdmin() public internalMsg onlyPendingAdmin(_pendingAdmin) accept functionID(0x726cafdd) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 96 | `        address oldAdmin = _admin;` | — | https://docs.acki-nacki.org/solidity |
| 97 | `        _admin = _pendingAdmin;` | — | https://docs.acki-nacki.org/solidity |
| 98 | `        _pendingAdmin = ZERO_ADDRESS;` | — | https://docs.acki-nacki.org/solidity |
| 99 | `        emit AdminAccepted{dest: _adminChannel()}(oldAdmin, _admin, uint64(block.timestamp));` | — | https://docs.acki-nacki.org/solidity |
| 100 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 101 | `` | — | https://docs.acki-nacki.org/solidity |
| 102 | `    function setContent(TvmCell content) public internalMsg onlyAdmin(_admin) accept functionID(0x0d7dc08a) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 103 | `        _content = content;` | — | https://docs.acki-nacki.org/solidity |
| 104 | `        emit ContentUpdated{dest: _adminChannel()}(_admin, tvm.hash(content), uint64(block.timestamp));` | — | https://docs.acki-nacki.org/solidity |
| 105 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 106 | `` | — | https://docs.acki-nacki.org/solidity |
| 107 | `    // ─── Discovery (TEP-89 0x2c76b973) ────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 108 | `` | — | https://docs.acki-nacki.org/solidity |
| 109 | `    function provideWalletAddress(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 110 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 111 | `        address ownerAddress,` | — | https://docs.acki-nacki.org/solidity |
| 112 | `        bool includeAddress` | — | https://docs.acki-nacki.org/solidity |
| 113 | `    ) public internalMsg functionID(0x2c76b973) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 114 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 115 | `` | — | https://docs.acki-nacki.org/solidity |
| 116 | `        address walletAddress = _getWalletAddress(ownerAddress);` | — | https://docs.acki-nacki.org/solidity |
| 117 | `        optional(address) owner;` | — | https://docs.acki-nacki.org/solidity |
| 118 | `        if (includeAddress) {` | — | https://docs.acki-nacki.org/solidity |
| 119 | `            owner.set(ownerAddress);` | — | https://docs.acki-nacki.org/solidity |
| 120 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 121 | `` | — | https://docs.acki-nacki.org/solidity |
| 122 | `        emit WalletAddressProvided{dest: _adminChannel()}(` | — | https://docs.acki-nacki.org/solidity |
| 123 | `            queryId,` | — | https://docs.acki-nacki.org/solidity |
| 124 | `            msg.sender,` | — | https://docs.acki-nacki.org/solidity |
| 125 | `            ownerAddress,` | — | https://docs.acki-nacki.org/solidity |
| 126 | `            walletAddress,` | — | https://docs.acki-nacki.org/solidity |
| 127 | `            includeAddress,` | — | https://docs.acki-nacki.org/solidity |
| 128 | `            uint64(block.timestamp)` | — | https://docs.acki-nacki.org/solidity |
| 129 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 130 | `` | — | https://docs.acki-nacki.org/solidity |
| 131 | `        TvmCell body = abi.encodeBody(` | — | https://docs.acki-nacki.org/solidity |
| 132 | `            IAFTWalletAddressReceiver.takeWalletAddress,` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 133 | `            queryId, walletAddress, owner` | — | https://docs.acki-nacki.org/solidity |
| 134 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 135 | `        uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)` | — | https://docs.acki-nacki.org/solidity |
| 136 | `                                 + uint128(SHELL_PER_HOP)` | — | https://docs.acki-nacki.org/solidity |
| 137 | `                                 + _estimateFwdFee(body));` | — | https://docs.acki-nacki.org/solidity |
| 138 | `        require(_inboundShell() >= conversion, ERR_INSUFFICIENT_FUEL);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 139 | `        gosh.cnvrtshellq(conversion);` | — | https://docs.acki-nacki.org/solidity |
| 140 | `` | — | https://docs.acki-nacki.org/solidity |
| 141 | `        // forward inbound SHELL net of conversion` | — | https://docs.acki-nacki.org/solidity |
| 142 | `        uint128 forward = _inboundShell() - uint128(conversion);` | — | https://docs.acki-nacki.org/solidity |
| 143 | `        mapping(uint32 => varuint32) outCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 144 | `        if (forward > 0) outCc[CURRENCIES_ID_SHELL] = varuint32(forward);` | — | https://docs.acki-nacki.org/solidity |
| 145 | `` | — | https://docs.acki-nacki.org/solidity |
| 146 | `        // value must be non-zero — AN denies gas_credit on msg.value = 0` | — | https://docs.acki-nacki.org/solidity |
| 147 | `        IAFTWalletAddressReceiver(msg.sender).takeWalletAddress{` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 148 | `            value: varuint16(SHELL_PER_HOP),` | — | https://docs.acki-nacki.org/solidity |
| 149 | `            currencies: outCc,` | — | https://docs.acki-nacki.org/solidity |
| 150 | `            flag: 1,` | — | https://docs.acki-nacki.org/solidity |
| 151 | `            bounce: false` | — | https://docs.acki-nacki.org/solidity |
| 152 | `        }(queryId, walletAddress, owner);` | — | https://docs.acki-nacki.org/solidity |
| 153 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 154 | `` | — | https://docs.acki-nacki.org/solidity |
| 155 | `    // ─── Burn intake (TEP-74 0x7bdd97de) ──────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 156 | `` | — | https://docs.acki-nacki.org/solidity |
| 157 | `    function onAFTBurnNotification(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 158 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 159 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 160 | `        address sender,` | — | https://docs.acki-nacki.org/solidity |
| 161 | `        address responseDestination` | — | https://docs.acki-nacki.org/solidity |
| 162 | `    ) public internalMsg functionID(0x7bdd97de) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 163 | `        require(msg.sender == _getWalletAddress(sender), ERR_WRONG_WALLET);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 164 | `` | — | https://docs.acki-nacki.org/solidity |
| 165 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 166 | `        _totalSupply -= amount;` | — | https://docs.acki-nacki.org/solidity |
| 167 | `` | — | https://docs.acki-nacki.org/solidity |
| 168 | `        emit AFTBurned{dest: _activityChannel()}(` | — | https://docs.acki-nacki.org/solidity |
| 169 | `            queryId,` | — | https://docs.acki-nacki.org/solidity |
| 170 | `            sender,` | — | https://docs.acki-nacki.org/solidity |
| 171 | `            amount,` | — | https://docs.acki-nacki.org/solidity |
| 172 | `            _totalSupply,` | — | https://docs.acki-nacki.org/solidity |
| 173 | `            uint64(block.timestamp)` | — | https://docs.acki-nacki.org/solidity |
| 174 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 175 | `` | — | https://docs.acki-nacki.org/solidity |
| 176 | `        if (responseDestination != ZERO_ADDRESS) {` | — | https://docs.acki-nacki.org/solidity |
| 177 | `            // own gas + 1 excess outbound (value=0, body fwd_fee)` | — | https://docs.acki-nacki.org/solidity |
| 178 | `            TvmCell body = abi.encodeBody(IAFTExcesses.onAFTExcesses, queryId);` | — | https://docs.acki-nacki.org/solidity |
| 179 | `            uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)` | — | https://docs.acki-nacki.org/solidity |
| 180 | `                                     + _estimateFwdFee(body));` | — | https://docs.acki-nacki.org/solidity |
| 181 | `            gosh.cnvrtshellq(conversion);` | — | https://docs.acki-nacki.org/solidity |
| 182 | `` | — | https://docs.acki-nacki.org/solidity |
| 183 | `            // forward inbound SHELL net of conversion, capped per outbound` | — | https://docs.acki-nacki.org/solidity |
| 184 | `            uint128 currentSh = _currentShell();` | — | https://docs.acki-nacki.org/solidity |
| 185 | `            uint128 forward = currentSh > uint128(conversion) ? currentSh - uint128(conversion) : 0;` | — | https://docs.acki-nacki.org/solidity |
| 186 | `            if (forward > SHELL_PER_EXCESS_MAX) forward = SHELL_PER_EXCESS_MAX;` | — | https://docs.acki-nacki.org/solidity |
| 187 | `            mapping(uint32 => varuint32) excCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 188 | `            if (forward > 0) {` | — | https://docs.acki-nacki.org/solidity |
| 189 | `                excCc[CURRENCIES_ID_SHELL] = varuint32(forward);` | — | https://docs.acki-nacki.org/solidity |
| 190 | `            }` | — | https://docs.acki-nacki.org/solidity |
| 191 | `            IAFTExcesses(responseDestination).onAFTExcesses{` | — | https://docs.acki-nacki.org/solidity |
| 192 | `                value: varuint16(0),` | — | https://docs.acki-nacki.org/solidity |
| 193 | `                currencies: excCc,` | — | https://docs.acki-nacki.org/solidity |
| 194 | `                flag: 1,` | — | https://docs.acki-nacki.org/solidity |
| 195 | `                bounce: false` | — | https://docs.acki-nacki.org/solidity |
| 196 | `            }(queryId);` | — | https://docs.acki-nacki.org/solidity |
| 197 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 198 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 199 | `` | — | https://docs.acki-nacki.org/solidity |
| 200 | `    // ─── Transfer recording (wallet→root callback after credit commit) ────` | — | https://docs.acki-nacki.org/solidity |
| 201 | `` | — | https://docs.acki-nacki.org/solidity |
| 202 | `    function recordTransfer(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 203 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 204 | `        address fromOwner,` | — | https://docs.acki-nacki.org/solidity |
| 205 | `        address toOwner,` | — | https://docs.acki-nacki.org/solidity |
| 206 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 207 | `        bool notifiedReceiver,` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 208 | `        uint256 forwardPayloadHash` | — | https://docs.acki-nacki.org/solidity |
| 209 | `    ) public internalMsg functionID(0xae71da1a) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 210 | `        // auth runs in gas_credit — bogus callers never get past credit phase` | — | https://docs.acki-nacki.org/solidity |
| 211 | `        require(msg.sender == _getWalletAddress(toOwner), ERR_WRONG_WALLET);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 212 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 213 | `` | — | https://docs.acki-nacki.org/solidity |
| 214 | `        emit AFTTransferred{dest: _activityChannel()}(` | — | https://docs.acki-nacki.org/solidity |
| 215 | `            queryId,` | — | https://docs.acki-nacki.org/solidity |
| 216 | `            fromOwner,` | — | https://docs.acki-nacki.org/solidity |
| 217 | `            toOwner,` | — | https://docs.acki-nacki.org/solidity |
| 218 | `            amount,` | — | https://docs.acki-nacki.org/solidity |
| 219 | `            notifiedReceiver,` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 220 | `            forwardPayloadHash,` | — | https://docs.acki-nacki.org/solidity |
| 221 | `            uint64(block.timestamp)` | — | https://docs.acki-nacki.org/solidity |
| 222 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 223 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 224 | `` | — | https://docs.acki-nacki.org/solidity |
| 225 | `    // ─── Bounce handling — stateless via body-ref decode ──────────────────` | — | https://docs.acki-nacki.org/solidity |
| 226 | `` | — | https://docs.acki-nacki.org/solidity |
| 227 | `    onBounce(TvmSlice body) external {` | — | https://docs.acki-nacki.org/solidity |
| 228 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 229 | `` | — | https://docs.acki-nacki.org/solidity |
| 230 | `        uint32 op = body.load(uint32);` | — | https://docs.acki-nacki.org/solidity |
| 231 | `        uint64 queryId = body.load(uint64);` | — | https://docs.acki-nacki.org/solidity |
| 232 | `        uint128 amount = body.load(uint128);` | — | https://docs.acki-nacki.org/solidity |
| 233 | `` | — | https://docs.acki-nacki.org/solidity |
| 234 | `        if (op == OP_INTERNAL_TRANSFER) {` | — | https://docs.acki-nacki.org/solidity |
| 235 | `            // warm bounce — peer didn't exist; retry cold-form` | — | https://docs.acki-nacki.org/solidity |
| 236 | `            TvmCell fullCell = body.loadRef();` | — | https://docs.acki-nacki.org/solidity |
| 237 | `            (` | — | https://docs.acki-nacki.org/solidity |
| 238 | `                uint32 fid,` | — | https://docs.acki-nacki.org/solidity |
| 239 | `                uint64 qId,` | — | https://docs.acki-nacki.org/solidity |
| 240 | `                uint128 amt,` | — | https://docs.acki-nacki.org/solidity |
| 241 | `                address from_,` | — | https://docs.acki-nacki.org/solidity |
| 242 | `                address destOwner,` | — | https://docs.acki-nacki.org/solidity |
| 243 | `                address responseAddress,` | — | https://docs.acki-nacki.org/solidity |
| 244 | `                uint128 forwardShellAmount,` | — | https://docs.acki-nacki.org/solidity |
| 245 | `                TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 246 | `            ) = abi.decode(fullCell, (` | — | https://docs.acki-nacki.org/solidity |
| 247 | `                uint32, uint64, uint128, address, address, address, uint128, TvmCell` | — | https://docs.acki-nacki.org/solidity |
| 248 | `            ));` | — | https://docs.acki-nacki.org/solidity |
| 249 | `            fid; qId; amt; from_;` | — | https://docs.acki-nacki.org/solidity |
| 250 | `` | — | https://docs.acki-nacki.org/solidity |
| 251 | `            TvmCell init = _buildWalletInitData(destOwner);` | — | https://docs.acki-nacki.org/solidity |
| 252 | `            TvmCell coldBody = abi.encodeBody(` | — | https://docs.acki-nacki.org/solidity |
| 253 | `                AFTWallet,` | — | https://docs.acki-nacki.org/solidity |
| 254 | `                queryId, amount, address(this), destOwner, responseAddress,` | — | https://docs.acki-nacki.org/solidity |
| 255 | `                forwardShellAmount, forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 256 | `            );` | — | https://docs.acki-nacki.org/solidity |
| 257 | `            uint128 deployFwd = _estimateFwdFee(coldBody) + _estimateFwdFee(init);` | — | https://docs.acki-nacki.org/solidity |
| 258 | `            uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)` | — | https://docs.acki-nacki.org/solidity |
| 259 | `                                     + uint128(SHELL_PER_DEPLOY)` | — | https://docs.acki-nacki.org/solidity |
| 260 | `                                     + deployFwd);` | — | https://docs.acki-nacki.org/solidity |
| 261 | `            gosh.cnvrtshellq(conversion);` | — | https://docs.acki-nacki.org/solidity |
| 262 | `` | — | https://docs.acki-nacki.org/solidity |
| 263 | `            // forward all remaining SHELL — receiver re-caps its own refunds` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 264 | `            uint128 forward = _currentShell();` | — | https://docs.acki-nacki.org/solidity |
| 265 | `            forward = forward > uint128(conversion) ? forward - uint128(conversion) : 0;` | — | https://docs.acki-nacki.org/solidity |
| 266 | `            mapping(uint32 => varuint32) outCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 267 | `            if (forward > 0) outCc[CURRENCIES_ID_SHELL] = varuint32(forward);` | — | https://docs.acki-nacki.org/solidity |
| 268 | `` | — | https://docs.acki-nacki.org/solidity |
| 269 | `            new AFTWallet{` | — | https://docs.acki-nacki.org/solidity |
| 270 | `                stateInit: init,` | — | https://docs.acki-nacki.org/solidity |
| 271 | `                value: varuint16(SHELL_PER_DEPLOY),` | — | https://docs.acki-nacki.org/solidity |
| 272 | `                currencies: outCc,` | — | https://docs.acki-nacki.org/solidity |
| 273 | `                flag: 0,` | — | https://docs.acki-nacki.org/solidity |
| 274 | `                bounce: true` | — | https://docs.acki-nacki.org/solidity |
| 275 | `            }(queryId, amount, address(this), destOwner, responseAddress, forwardShellAmount, forwardPayload);` | — | https://docs.acki-nacki.org/solidity |
| 276 | `        } else if (op == 0x00000001) {` | — | https://docs.acki-nacki.org/solidity |
| 277 | `            // cold-form deploy also failed — roll back supply` | — | https://docs.acki-nacki.org/solidity |
| 278 | `            _totalSupply -= amount;` | — | https://docs.acki-nacki.org/solidity |
| 279 | `            emit AFTMintRolledBack{dest: _activityChannel()}(` | — | https://docs.acki-nacki.org/solidity |
| 280 | `                queryId,` | — | https://docs.acki-nacki.org/solidity |
| 281 | `                amount,` | — | https://docs.acki-nacki.org/solidity |
| 282 | `                _totalSupply,` | — | https://docs.acki-nacki.org/solidity |
| 283 | `                uint64(block.timestamp)` | — | https://docs.acki-nacki.org/solidity |
| 284 | `            );` | — | https://docs.acki-nacki.org/solidity |
| 285 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 286 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 287 | `` | — | https://docs.acki-nacki.org/solidity |
| 288 | `    // ─── Views ────────────────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 289 | `` | — | https://docs.acki-nacki.org/solidity |
| 290 | `    function getAftData() external view returns (` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 291 | `        uint128 totalSupply,` | — | https://docs.acki-nacki.org/solidity |
| 292 | `        bool mintable,` | — | https://docs.acki-nacki.org/solidity |
| 293 | `        address adminAddress,` | — | https://docs.acki-nacki.org/solidity |
| 294 | `        TvmCell content,` | — | https://docs.acki-nacki.org/solidity |
| 295 | `        TvmCell walletCode` | — | https://docs.acki-nacki.org/solidity |
| 296 | `    ) {` | — | https://docs.acki-nacki.org/solidity |
| 297 | `        return (_totalSupply, _mintable, _admin, _content, _walletCode);` | — | https://docs.acki-nacki.org/solidity |
| 298 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 299 | `` | — | https://docs.acki-nacki.org/solidity |
| 300 | `    /// TON-tooling alias for getAftData.` | — | https://docs.acki-nacki.org/solidity |
| 301 | `    function getJettonData() external view returns (` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 302 | `        uint128 totalSupply,` | — | https://docs.acki-nacki.org/solidity |
| 303 | `        bool mintable,` | — | https://docs.acki-nacki.org/solidity |
| 304 | `        address adminAddress,` | — | https://docs.acki-nacki.org/solidity |
| 305 | `        TvmCell content,` | — | https://docs.acki-nacki.org/solidity |
| 306 | `        TvmCell walletCode` | — | https://docs.acki-nacki.org/solidity |
| 307 | `    ) {` | — | https://docs.acki-nacki.org/solidity |
| 308 | `        return (_totalSupply, _mintable, _admin, _content, _walletCode);` | — | https://docs.acki-nacki.org/solidity |
| 309 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 310 | `` | — | https://docs.acki-nacki.org/solidity |
| 311 | `    function getWalletAddress(address ownerAddress) external view returns (address walletAddress) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 312 | `        return _getWalletAddress(ownerAddress);` | — | https://docs.acki-nacki.org/solidity |
| 313 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 314 | `` | — | https://docs.acki-nacki.org/solidity |
| 315 | `    function getDetails() external view returns (` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 316 | `        string name,` | — | https://docs.acki-nacki.org/solidity |
| 317 | `        string symbol,` | — | https://docs.acki-nacki.org/solidity |
| 318 | `        uint128 decimals,` | — | https://docs.acki-nacki.org/solidity |
| 319 | `        address deployer,` | — | https://docs.acki-nacki.org/solidity |
| 320 | `        address admin,` | — | https://docs.acki-nacki.org/solidity |
| 321 | `        address pendingAdmin,` | — | https://docs.acki-nacki.org/solidity |
| 322 | `        bool mintable,` | — | https://docs.acki-nacki.org/solidity |
| 323 | `        uint128 totalSupply` | — | https://docs.acki-nacki.org/solidity |
| 324 | `    ) {` | — | https://docs.acki-nacki.org/solidity |
| 325 | `        return (_name, _symbol, _decimals, _deployer, _admin, _pendingAdmin, _mintable, _totalSupply);` | — | https://docs.acki-nacki.org/solidity |
| 326 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 327 | `` | — | https://docs.acki-nacki.org/solidity |
| 328 | `    /// Forward-fee estimate for `body` (~5% underestimate; `dest` unused).` | — | https://docs.acki-nacki.org/solidity |
| 329 | `    function estimateFwdFee(address dest, TvmCell body) external pure returns (uint128) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 330 | `        dest;` | — | https://docs.acki-nacki.org/solidity |
| 331 | `        return _estimateFwdFee(body);` | — | https://docs.acki-nacki.org/solidity |
| 332 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 333 | `` | — | https://docs.acki-nacki.org/solidity |
| 334 | `    function getFwdPrices() external pure returns (uint64 lumpPrice, uint64 bitPrice, uint64 cellPrice) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 335 | `        FwdPrices p = _loadFwdPrices();` | — | https://docs.acki-nacki.org/solidity |
| 336 | `        return (p.lumpPrice, p.bitPrice, p.cellPrice);` | — | https://docs.acki-nacki.org/solidity |
| 337 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 338 | `` | — | https://docs.acki-nacki.org/solidity |
| 339 | `    function getGasPrice() external pure returns (uint64 gasPrice) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 340 | `        return _loadGasPrice();` | — | https://docs.acki-nacki.org/solidity |
| 341 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 342 | `` | — | https://docs.acki-nacki.org/solidity |
| 343 | `    // ─── Internal helpers ─────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 344 | `` | — | https://docs.acki-nacki.org/solidity |
| 345 | `    /// Entry-hop self-conversion + warm-first internalTransfer.` | — | https://docs.acki-nacki.org/solidity |
| 346 | `    function _mint(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 347 | `        address toOwner,` | — | https://docs.acki-nacki.org/solidity |
| 348 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 349 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 350 | `        address responseDestination,` | — | https://docs.acki-nacki.org/solidity |
| 351 | `        uint128 forwardShellAmount,` | — | https://docs.acki-nacki.org/solidity |
| 352 | `        TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 353 | `    ) internal {` | — | https://docs.acki-nacki.org/solidity |
| 354 | `        require(amount > 0, ERR_ZERO_AMOUNT);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 355 | `        require(_mintable, ERR_MINT_DISABLED);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 356 | `        require(toOwner != ZERO_ADDRESS, ERR_INVALID_SENDER);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 357 | `` | — | https://docs.acki-nacki.org/solidity |
| 358 | `        _totalSupply += amount;` | — | https://docs.acki-nacki.org/solidity |
| 359 | `` | — | https://docs.acki-nacki.org/solidity |
| 360 | `        TvmCell body = abi.encodeBody(` | — | https://docs.acki-nacki.org/solidity |
| 361 | `            IAFTWallet.internalTransfer,` | — | https://docs.acki-nacki.org/solidity |
| 362 | `            queryId, amount, address(this), toOwner, responseDestination,` | — | https://docs.acki-nacki.org/solidity |
| 363 | `            forwardShellAmount, forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 364 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 365 | `        uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)` | — | https://docs.acki-nacki.org/solidity |
| 366 | `                                 + uint128(SHELL_PER_HOP)` | — | https://docs.acki-nacki.org/solidity |
| 367 | `                                 + _estimateFwdFee(body));` | — | https://docs.acki-nacki.org/solidity |
| 368 | `        gosh.cnvrtshellq(conversion);` | — | https://docs.acki-nacki.org/solidity |
| 369 | `` | — | https://docs.acki-nacki.org/solidity |
| 370 | `        uint128 currentSh = _currentShell();` | — | https://docs.acki-nacki.org/solidity |
| 371 | `        uint128 forward = currentSh > uint128(conversion) ? currentSh - uint128(conversion) : 0;` | — | https://docs.acki-nacki.org/solidity |
| 372 | `        mapping(uint32 => varuint32) outCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 373 | `        if (forward > 0) outCc[CURRENCIES_ID_SHELL] = varuint32(forward);` | — | https://docs.acki-nacki.org/solidity |
| 374 | `` | — | https://docs.acki-nacki.org/solidity |
| 375 | `        // warm-first; if the wallet is uninit the msg bounces → cold retry` | — | https://docs.acki-nacki.org/solidity |
| 376 | `        address wallet = _getWalletAddress(toOwner);` | — | https://docs.acki-nacki.org/solidity |
| 377 | `        IAFTWallet(wallet).internalTransfer{` | — | https://docs.acki-nacki.org/solidity |
| 378 | `            value: varuint16(SHELL_PER_HOP),` | — | https://docs.acki-nacki.org/solidity |
| 379 | `            currencies: outCc,` | — | https://docs.acki-nacki.org/solidity |
| 380 | `            flag: 1,` | — | https://docs.acki-nacki.org/solidity |
| 381 | `            bounce: true` | — | https://docs.acki-nacki.org/solidity |
| 382 | `        }(queryId, amount, address(this), toOwner, responseDestination, forwardShellAmount, forwardPayload);` | — | https://docs.acki-nacki.org/solidity |
| 383 | `` | — | https://docs.acki-nacki.org/solidity |
| 384 | `        emit AFTMinted{dest: _activityChannel()}(` | — | https://docs.acki-nacki.org/solidity |
| 385 | `            queryId,` | — | https://docs.acki-nacki.org/solidity |
| 386 | `            toOwner,` | — | https://docs.acki-nacki.org/solidity |
| 387 | `            amount,` | — | https://docs.acki-nacki.org/solidity |
| 388 | `            _totalSupply,` | — | https://docs.acki-nacki.org/solidity |
| 389 | `            tvm.hash(forwardPayload),` | — | https://docs.acki-nacki.org/solidity |
| 390 | `            uint64(block.timestamp)` | — | https://docs.acki-nacki.org/solidity |
| 391 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 392 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 393 | `` | — | https://docs.acki-nacki.org/solidity |
| 394 | `    function _buildWalletInitData(address walletOwner) internal view returns (TvmCell) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 395 | `        return abi.encodeStateInit({` | — | https://docs.acki-nacki.org/solidity |
| 396 | `            contr: AFTWallet,` | — | https://docs.acki-nacki.org/solidity |
| 397 | `            varInit: {` | — | https://docs.acki-nacki.org/solidity |
| 398 | `                _root: address(this),` | — | https://docs.acki-nacki.org/solidity |
| 399 | `                _owner: walletOwner` | — | https://docs.acki-nacki.org/solidity |
| 400 | `            },` | — | https://docs.acki-nacki.org/solidity |
| 401 | `            code: _walletCode` | — | https://docs.acki-nacki.org/solidity |
| 402 | `        });` | — | https://docs.acki-nacki.org/solidity |
| 403 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 404 | `` | — | https://docs.acki-nacki.org/solidity |
| 405 | `    function _getWalletAddress(address walletOwner) internal view returns (address walletAddress) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 406 | `        walletAddress = address.makeAddrStd(0, tvm.hash(_buildWalletInitData(walletOwner)));` | — | https://docs.acki-nacki.org/solidity |
| 407 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 408 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
