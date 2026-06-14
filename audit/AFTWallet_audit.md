# Audit – AFTWallet.sol

*Source: `C:\Users\alanp\ackimeme\contracts\AFTWallet.sol`*

| Line | Code | Analysis | Reference |
|------|------|----------|-----------|
| 1 | `// SPDX-License-Identifier: MIT` | — | https://docs.acki-nacki.org/solidity |
| 2 | `pragma tvm-solidity >= 0.76.1;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 3 | `pragma AbiHeader expire;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 4 | `pragma AbiHeader pubkey;` | — | [pragma](https://docs.acki-nacki.org/solidity/pragma.html) |
| 5 | `` | — | https://docs.acki-nacki.org/solidity |
| 6 | `import "./modifiers/modifiers.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 7 | `import "./interfaces/IAFTExcesses.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 8 | `import "./interfaces/IAFTReceiver.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 9 | `import "./interfaces/IAFTRoot.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 10 | `import "./interfaces/IAFTWallet.sol";` | — | [import](https://docs.acki-nacki.org/solidity/import.html) |
| 11 | `` | — | https://docs.acki-nacki.org/solidity |
| 12 | `/// AFT wallet — TON jetton-wallet port.` | — | https://docs.acki-nacki.org/solidity |
| 13 | `///` | — | https://docs.acki-nacki.org/solidity |
| 14 | `/// Fuel model: each hop converts just enough SHELL for its own compute +` | — | https://docs.acki-nacki.org/solidity |
| 15 | `/// outbounds and forwards the surplus downstream (notification + excess` | — | https://docs.acki-nacki.org/solidity |
| 16 | `/// refund). `transfer` goes warm-first; on bounce it retries with a` | — | https://docs.acki-nacki.org/solidity |
| 17 | `/// cold-form deploy. `onAFTTransfer` is fire-and-forget (bounce:false,` | — | https://docs.acki-nacki.org/solidity |
| 18 | `/// TEP-74 lazy receiver — a missing or reverting owner handler can't roll` | — | [revert](https://docs.acki-nacki.org/solidity/revert.html) |
| 19 | `/// back the credit); burn keeps bounce:true so a failed burn-record` | — | https://docs.acki-nacki.org/solidity |
| 20 | `/// restores `_balance`. SHELL sent via `forwardShellAmount` to a` | — | https://docs.acki-nacki.org/solidity |
| 21 | `/// never-deployed owner stays parked at its address.` | — | https://docs.acki-nacki.org/solidity |
| 22 | `contract AFTWallet is Modifiers {` | — | [contracts](https://docs.acki-nacki.org/solidity/contracts.html) |
| 23 | `    string constant version = "1.0.0";` | — | https://docs.acki-nacki.org/solidity |
| 24 | `` | — | https://docs.acki-nacki.org/solidity |
| 25 | `    address static _root;` | — | https://docs.acki-nacki.org/solidity |
| 26 | `    address static _owner;` | — | https://docs.acki-nacki.org/solidity |
| 27 | `    uint128 _balance;` | — | https://docs.acki-nacki.org/solidity |
| 28 | `` | — | https://docs.acki-nacki.org/solidity |
| 29 | `    /// Cold-init via `new AFTWallet{stateInit}` when the destination wallet` | — | https://docs.acki-nacki.org/solidity |
| 30 | `    /// does not exist yet. Self-funds from inbound SHELL.` | — | https://docs.acki-nacki.org/solidity |
| 31 | `    constructor(` | — | [structs](https://docs.acki-nacki.org/solidity/structs.html) |
| 32 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 33 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 34 | `        address from,` | — | https://docs.acki-nacki.org/solidity |
| 35 | `        address destOwner,` | — | https://docs.acki-nacki.org/solidity |
| 36 | `        address responseAddress,` | — | https://docs.acki-nacki.org/solidity |
| 37 | `        uint128 forwardShellAmount,` | — | https://docs.acki-nacki.org/solidity |
| 38 | `        TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 39 | `    ) {` | — | https://docs.acki-nacki.org/solidity |
| 40 | `        // destOwner == _owner is guaranteed by the stateInit hash` | — | https://docs.acki-nacki.org/solidity |
| 41 | `        destOwner;` | — | https://docs.acki-nacki.org/solidity |
| 42 | `        bool isMint = msg.sender == _root && from == _root;` | — | https://docs.acki-nacki.org/solidity |
| 43 | `        bool isWalletTransfer = msg.sender == _getWalletAddress(from);` | — | https://docs.acki-nacki.org/solidity |
| 44 | `        require(isMint \|\| isWalletTransfer, ERR_WRONG_WALLET);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 45 | `` | — | https://docs.acki-nacki.org/solidity |
| 46 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 47 | `        _balance = amount;` | — | https://docs.acki-nacki.org/solidity |
| 48 | `        _runNotificationAndExcess(` | — | https://docs.acki-nacki.org/solidity |
| 49 | `            queryId, amount, from, responseAddress,` | — | https://docs.acki-nacki.org/solidity |
| 50 | `            forwardShellAmount, forwardPayload, isMint` | — | https://docs.acki-nacki.org/solidity |
| 51 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 52 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 53 | `` | — | https://docs.acki-nacki.org/solidity |
| 54 | `    // ─── Owner-initiated outbound (TEP-74 0x0f8a7ea5) ─────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 55 | `    // Entry hop: native arrives wiped cross-dapp, self-converts fuel.` | — | https://docs.acki-nacki.org/solidity |
| 56 | `` | — | https://docs.acki-nacki.org/solidity |
| 57 | `    function transfer(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 58 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 59 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 60 | `        address destinationOwner,` | — | https://docs.acki-nacki.org/solidity |
| 61 | `        address responseDestination,` | — | https://docs.acki-nacki.org/solidity |
| 62 | `        optional(TvmCell) customPayload,` | — | https://docs.acki-nacki.org/solidity |
| 63 | `        uint128 forwardShellAmount,` | — | https://docs.acki-nacki.org/solidity |
| 64 | `        TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 65 | `    ) public internalMsg functionID(0x0f8a7ea5) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 66 | `        require(msg.sender == _owner, ERR_INVALID_SENDER);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 67 | `        require(amount > 0, ERR_ZERO_AMOUNT);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 68 | `        require(_balance >= amount, ERR_LOW_BALANCE);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 69 | `        // else a warm bounce would cold-deploy a wallet with _owner = 0` | — | https://docs.acki-nacki.org/solidity |
| 70 | `        require(destinationOwner != ZERO_ADDRESS, ERR_INVALID_SENDER);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 71 | `` | — | https://docs.acki-nacki.org/solidity |
| 72 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 73 | `        customPayload;` | — | https://docs.acki-nacki.org/solidity |
| 74 | `` | — | https://docs.acki-nacki.org/solidity |
| 75 | `        _balance -= amount;` | — | https://docs.acki-nacki.org/solidity |
| 76 | `` | — | https://docs.acki-nacki.org/solidity |
| 77 | `        // body built upfront to estimate its fwd_fee` | — | https://docs.acki-nacki.org/solidity |
| 78 | `        TvmCell body = abi.encodeBody(` | — | https://docs.acki-nacki.org/solidity |
| 79 | `            IAFTWallet.internalTransfer,` | — | https://docs.acki-nacki.org/solidity |
| 80 | `            queryId, amount, _owner, destinationOwner, responseDestination,` | — | https://docs.acki-nacki.org/solidity |
| 81 | `            forwardShellAmount, forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 82 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 83 | `        // own gas + outbound value + outbound fwd_fee` | — | https://docs.acki-nacki.org/solidity |
| 84 | `        uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)` | — | https://docs.acki-nacki.org/solidity |
| 85 | `                                 + uint128(SHELL_PER_HOP)` | — | https://docs.acki-nacki.org/solidity |
| 86 | `                                 + _estimateFwdFee(body));` | — | https://docs.acki-nacki.org/solidity |
| 87 | `        require(_inboundShell() >= conversion, ERR_INSUFFICIENT_FUEL);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 88 | `        gosh.cnvrtshellq(conversion);` | — | https://docs.acki-nacki.org/solidity |
| 89 | `` | — | https://docs.acki-nacki.org/solidity |
| 90 | `        // forward inbound SHELL net of our conversion` | — | https://docs.acki-nacki.org/solidity |
| 91 | `        uint128 forward = _inboundShell() - uint128(conversion);` | — | https://docs.acki-nacki.org/solidity |
| 92 | `        mapping(uint32 => varuint32) outCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 93 | `        if (forward > 0) outCc[CURRENCIES_ID_SHELL] = varuint32(forward);` | — | https://docs.acki-nacki.org/solidity |
| 94 | `` | — | https://docs.acki-nacki.org/solidity |
| 95 | `        // warm-first; if the peer is uninit the msg bounces → cold retry` | — | https://docs.acki-nacki.org/solidity |
| 96 | `        address dest = _getWalletAddress(destinationOwner);` | — | https://docs.acki-nacki.org/solidity |
| 97 | `        IAFTWallet(dest).internalTransfer{` | — | https://docs.acki-nacki.org/solidity |
| 98 | `            value: varuint16(SHELL_PER_HOP),` | — | https://docs.acki-nacki.org/solidity |
| 99 | `            currencies: outCc,` | — | https://docs.acki-nacki.org/solidity |
| 100 | `            flag: 1,` | — | https://docs.acki-nacki.org/solidity |
| 101 | `            bounce: true` | — | https://docs.acki-nacki.org/solidity |
| 102 | `        }(queryId, amount, _owner, destinationOwner, responseDestination, forwardShellAmount, forwardPayload);` | — | https://docs.acki-nacki.org/solidity |
| 103 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 104 | `` | — | https://docs.acki-nacki.org/solidity |
| 105 | `    // ─── Owner-initiated burn (TEP-74 0x595f07bc) ─────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 106 | `` | — | https://docs.acki-nacki.org/solidity |
| 107 | `    function burn(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 108 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 109 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 110 | `        address responseDestination,` | — | https://docs.acki-nacki.org/solidity |
| 111 | `        optional(TvmCell) customPayload` | — | https://docs.acki-nacki.org/solidity |
| 112 | `    ) public internalMsg functionID(0x595f07bc) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 113 | `        require(msg.sender == _owner, ERR_INVALID_SENDER);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 114 | `        require(amount > 0, ERR_ZERO_AMOUNT);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 115 | `        require(_balance >= amount, ERR_LOW_BALANCE);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 116 | `` | — | https://docs.acki-nacki.org/solidity |
| 117 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 118 | `        customPayload;` | — | https://docs.acki-nacki.org/solidity |
| 119 | `` | — | https://docs.acki-nacki.org/solidity |
| 120 | `        _balance -= amount;` | — | https://docs.acki-nacki.org/solidity |
| 121 | `` | — | https://docs.acki-nacki.org/solidity |
| 122 | `        TvmCell body = abi.encodeBody(` | — | https://docs.acki-nacki.org/solidity |
| 123 | `            IAFTRoot.onAFTBurnNotification,` | — | https://docs.acki-nacki.org/solidity |
| 124 | `            queryId, amount, _owner, responseDestination` | — | https://docs.acki-nacki.org/solidity |
| 125 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 126 | `        uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)` | — | https://docs.acki-nacki.org/solidity |
| 127 | `                                 + uint128(SHELL_PER_HOP)` | — | https://docs.acki-nacki.org/solidity |
| 128 | `                                 + _estimateFwdFee(body));` | — | https://docs.acki-nacki.org/solidity |
| 129 | `        require(_inboundShell() >= conversion, ERR_INSUFFICIENT_FUEL);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 130 | `        gosh.cnvrtshellq(conversion);` | — | https://docs.acki-nacki.org/solidity |
| 131 | `` | — | https://docs.acki-nacki.org/solidity |
| 132 | `        uint128 forward = _inboundShell() - uint128(conversion);` | — | https://docs.acki-nacki.org/solidity |
| 133 | `        mapping(uint32 => varuint32) outCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 134 | `        if (forward > 0) outCc[CURRENCIES_ID_SHELL] = varuint32(forward);` | — | https://docs.acki-nacki.org/solidity |
| 135 | `` | — | https://docs.acki-nacki.org/solidity |
| 136 | `        IAFTRoot(_root).onAFTBurnNotification{` | — | https://docs.acki-nacki.org/solidity |
| 137 | `            value: varuint16(SHELL_PER_HOP),` | — | https://docs.acki-nacki.org/solidity |
| 138 | `            currencies: outCc,` | — | https://docs.acki-nacki.org/solidity |
| 139 | `            flag: 1,` | — | https://docs.acki-nacki.org/solidity |
| 140 | `            bounce: true` | — | https://docs.acki-nacki.org/solidity |
| 141 | `        }(queryId, amount, _owner, responseDestination);` | — | https://docs.acki-nacki.org/solidity |
| 142 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 143 | `` | — | https://docs.acki-nacki.org/solidity |
| 144 | `    // ─── Warm path: peer wallet already exists ────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 145 | `    // Internal hop: same dapp, msg.value preserved.` | — | https://docs.acki-nacki.org/solidity |
| 146 | `` | — | https://docs.acki-nacki.org/solidity |
| 147 | `    function internalTransfer(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 148 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 149 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 150 | `        address from,` | — | https://docs.acki-nacki.org/solidity |
| 151 | `        address destOwner,` | — | https://docs.acki-nacki.org/solidity |
| 152 | `        address responseAddress,` | — | https://docs.acki-nacki.org/solidity |
| 153 | `        uint128 forwardShellAmount,` | — | https://docs.acki-nacki.org/solidity |
| 154 | `        TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 155 | `    ) public internalMsg functionID(0x178d4519) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 156 | `        // destOwner is bounce-recovery payload — unused on the happy path` | — | https://docs.acki-nacki.org/solidity |
| 157 | `        destOwner;` | — | https://docs.acki-nacki.org/solidity |
| 158 | `        bool isMint = msg.sender == _root && from == _root;` | — | https://docs.acki-nacki.org/solidity |
| 159 | `        bool isWalletTransfer = msg.sender == _getWalletAddress(from);` | — | https://docs.acki-nacki.org/solidity |
| 160 | `        require(isMint \|\| isWalletTransfer, ERR_WRONG_WALLET);` | — | [require](https://docs.acki-nacki.org/solidity/require.html) |
| 161 | `` | — | https://docs.acki-nacki.org/solidity |
| 162 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 163 | `        _balance += amount;` | — | https://docs.acki-nacki.org/solidity |
| 164 | `` | — | https://docs.acki-nacki.org/solidity |
| 165 | `        _runNotificationAndExcess(` | — | https://docs.acki-nacki.org/solidity |
| 166 | `            queryId, amount, from, responseAddress,` | — | https://docs.acki-nacki.org/solidity |
| 167 | `            forwardShellAmount, forwardPayload, isMint` | — | https://docs.acki-nacki.org/solidity |
| 168 | `        );` | — | https://docs.acki-nacki.org/solidity |
| 169 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 170 | `` | — | https://docs.acki-nacki.org/solidity |
| 171 | `    /// Notification (if forwardShellAmount > 0) + recordTransfer (if not a` | — | https://docs.acki-nacki.org/solidity |
| 172 | `    /// mint) + excess refund (if responseAddress set), all flag:1.` | — | https://docs.acki-nacki.org/solidity |
| 173 | `    /// Self-sizes its fuel conversion across the conditional outbounds.` | — | https://docs.acki-nacki.org/solidity |
| 174 | `    function _runNotificationAndExcess(` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 175 | `        uint64 queryId,` | — | https://docs.acki-nacki.org/solidity |
| 176 | `        uint128 amount,` | — | https://docs.acki-nacki.org/solidity |
| 177 | `        address from,` | — | https://docs.acki-nacki.org/solidity |
| 178 | `        address responseAddress,` | — | https://docs.acki-nacki.org/solidity |
| 179 | `        uint128 forwardShellAmount,` | — | https://docs.acki-nacki.org/solidity |
| 180 | `        TvmCell forwardPayload,` | — | https://docs.acki-nacki.org/solidity |
| 181 | `        bool isMint` | — | https://docs.acki-nacki.org/solidity |
| 182 | `    ) internal {` | — | https://docs.acki-nacki.org/solidity |
| 183 | `        bool hasNotification = forwardShellAmount > 0;` | — | https://docs.acki-nacki.org/solidity |
| 184 | `        bool hasRecord       = !isMint;` | — | https://docs.acki-nacki.org/solidity |
| 185 | `        bool hasResponse     = responseAddress != ZERO_ADDRESS;` | — | https://docs.acki-nacki.org/solidity |
| 186 | `` | — | https://docs.acki-nacki.org/solidity |
| 187 | `        // bodies built upfront for fwd_fee estimation` | — | https://docs.acki-nacki.org/solidity |
| 188 | `        TvmCell notifBody = hasNotification` | — | https://docs.acki-nacki.org/solidity |
| 189 | `            ? abi.encodeBody(IAFTReceiver.onAFTTransfer, queryId, amount, from, forwardPayload)` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 190 | `            : TvmCell();` | — | https://docs.acki-nacki.org/solidity |
| 191 | `        TvmCell recordBody = hasRecord` | — | https://docs.acki-nacki.org/solidity |
| 192 | `            ? abi.encodeBody(IAFTRoot.recordTransfer, queryId, from, _owner, amount, hasNotification, tvm.hash(forwardPayload))` | — | https://docs.acki-nacki.org/solidity |
| 193 | `            : TvmCell();` | — | https://docs.acki-nacki.org/solidity |
| 194 | `        TvmCell excessBody = hasResponse` | — | https://docs.acki-nacki.org/solidity |
| 195 | `            ? abi.encodeBody(IAFTExcesses.onAFTExcesses, queryId)` | — | https://docs.acki-nacki.org/solidity |
| 196 | `            : TvmCell();` | — | https://docs.acki-nacki.org/solidity |
| 197 | `` | — | https://docs.acki-nacki.org/solidity |
| 198 | `        // own gas + Σ(value_i + fwd_fee_i) for outbounds we'll actually send` | — | https://docs.acki-nacki.org/solidity |
| 199 | `        uint128 needed = _gasToNative(EST_GAS_ENTRY);` | — | https://docs.acki-nacki.org/solidity |
| 200 | `        if (hasNotification) {` | — | https://docs.acki-nacki.org/solidity |
| 201 | `            needed += uint128(SHELL_PER_HOP) + _estimateFwdFee(notifBody);` | — | https://docs.acki-nacki.org/solidity |
| 202 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 203 | `        if (hasRecord) {` | — | https://docs.acki-nacki.org/solidity |
| 204 | `            needed += uint128(SHELL_PER_HOP) + _estimateFwdFee(recordBody);` | — | https://docs.acki-nacki.org/solidity |
| 205 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 206 | `        if (hasResponse) {` | — | https://docs.acki-nacki.org/solidity |
| 207 | `            // excess outbounds carry value=0 — fwd_fee × split count only` | — | https://docs.acki-nacki.org/solidity |
| 208 | `            needed += uint128(EXCESS_SPLIT_COUNT) * _estimateFwdFee(excessBody);` | — | https://docs.acki-nacki.org/solidity |
| 209 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 210 | `        uint64 conversion = uint64(needed);` | — | https://docs.acki-nacki.org/solidity |
| 211 | `        gosh.cnvrtshellq(conversion);` | — | https://docs.acki-nacki.org/solidity |
| 212 | `` | — | https://docs.acki-nacki.org/solidity |
| 213 | `        // action phase applies cnvrtshellq before processing outbounds` | — | https://docs.acki-nacki.org/solidity |
| 214 | `        uint128 budget = _currentShell();` | — | https://docs.acki-nacki.org/solidity |
| 215 | `        budget = budget > uint128(conversion) ? budget - uint128(conversion) : 0;` | — | https://docs.acki-nacki.org/solidity |
| 216 | `        bool notified = false;` | — | https://docs.acki-nacki.org/solidity |
| 217 | `` | — | https://docs.acki-nacki.org/solidity |
| 218 | `        mapping(uint32 => varuint32) cc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 219 | `` | — | https://docs.acki-nacki.org/solidity |
| 220 | `        if (hasNotification && budget >= forwardShellAmount) {` | — | https://docs.acki-nacki.org/solidity |
| 221 | `            cc[CURRENCIES_ID_SHELL] = varuint32(forwardShellAmount);` | — | https://docs.acki-nacki.org/solidity |
| 222 | `            // bounce:false — lazy receiver; _balance is already credited` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 223 | `            IAFTReceiver(_owner).onAFTTransfer{` | — | [receive](https://docs.acki-nacki.org/solidity/receive.html) |
| 224 | `                value: varuint16(SHELL_PER_HOP),` | — | https://docs.acki-nacki.org/solidity |
| 225 | `                currencies: cc,` | — | https://docs.acki-nacki.org/solidity |
| 226 | `                flag: 1,` | — | https://docs.acki-nacki.org/solidity |
| 227 | `                bounce: false` | — | https://docs.acki-nacki.org/solidity |
| 228 | `            }(queryId, amount, from, forwardPayload);` | — | https://docs.acki-nacki.org/solidity |
| 229 | `            notified = true;` | — | https://docs.acki-nacki.org/solidity |
| 230 | `            budget -= forwardShellAmount;` | — | https://docs.acki-nacki.org/solidity |
| 231 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 232 | `` | — | https://docs.acki-nacki.org/solidity |
| 233 | `        if (hasRecord) {` | — | https://docs.acki-nacki.org/solidity |
| 234 | `            // best-effort event aggregation; root self-funds via msg.value` | — | [events](https://docs.acki-nacki.org/solidity/events.html) |
| 235 | `            mapping(uint32 => varuint32) emptyCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 236 | `            IAFTRoot(_root).recordTransfer{` | — | https://docs.acki-nacki.org/solidity |
| 237 | `                value: varuint16(SHELL_PER_HOP),` | — | https://docs.acki-nacki.org/solidity |
| 238 | `                currencies: emptyCc,` | — | https://docs.acki-nacki.org/solidity |
| 239 | `                flag: 1,` | — | https://docs.acki-nacki.org/solidity |
| 240 | `                bounce: false` | — | https://docs.acki-nacki.org/solidity |
| 241 | `            }(queryId, from, _owner, amount, notified, tvm.hash(forwardPayload));` | — | https://docs.acki-nacki.org/solidity |
| 242 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 243 | `` | — | https://docs.acki-nacki.org/solidity |
| 244 | `        // split refunds — action_code=38 trips on too much SHELL per outbound` | — | https://docs.acki-nacki.org/solidity |
| 245 | `        if (hasResponse) {` | — | https://docs.acki-nacki.org/solidity |
| 246 | `            for (uint8 i = 0; i < EXCESS_SPLIT_COUNT; i++) {` | — | https://docs.acki-nacki.org/solidity |
| 247 | `                if (budget == 0) break;` | — | https://docs.acki-nacki.org/solidity |
| 248 | `                uint128 amt = budget > SHELL_PER_EXCESS_MAX ? SHELL_PER_EXCESS_MAX : budget;` | — | https://docs.acki-nacki.org/solidity |
| 249 | `                cc[CURRENCIES_ID_SHELL] = varuint32(amt);` | — | https://docs.acki-nacki.org/solidity |
| 250 | `                IAFTExcesses(responseAddress).onAFTExcesses{` | — | https://docs.acki-nacki.org/solidity |
| 251 | `                    value: varuint16(0),` | — | https://docs.acki-nacki.org/solidity |
| 252 | `                    currencies: cc,` | — | https://docs.acki-nacki.org/solidity |
| 253 | `                    flag: 1,` | — | https://docs.acki-nacki.org/solidity |
| 254 | `                    bounce: false` | — | https://docs.acki-nacki.org/solidity |
| 255 | `                }(queryId);` | — | https://docs.acki-nacki.org/solidity |
| 256 | `                budget -= amt;` | — | https://docs.acki-nacki.org/solidity |
| 257 | `            }` | — | https://docs.acki-nacki.org/solidity |
| 258 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 259 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 260 | `` | — | https://docs.acki-nacki.org/solidity |
| 261 | `    // ─── Bounce handling — stateless via body-ref decode ──────────────────` | — | https://docs.acki-nacki.org/solidity |
| 262 | `` | — | https://docs.acki-nacki.org/solidity |
| 263 | `    onBounce(TvmSlice body) external {` | — | https://docs.acki-nacki.org/solidity |
| 264 | `        tvm.accept();` | — | https://docs.acki-nacki.org/solidity |
| 265 | `` | — | https://docs.acki-nacki.org/solidity |
| 266 | `        uint32 op = body.load(uint32);` | — | https://docs.acki-nacki.org/solidity |
| 267 | `        uint64 queryId = body.load(uint64);` | — | https://docs.acki-nacki.org/solidity |
| 268 | `        uint128 amount = body.load(uint128);` | — | https://docs.acki-nacki.org/solidity |
| 269 | `` | — | https://docs.acki-nacki.org/solidity |
| 270 | `        if (op == OP_INTERNAL_TRANSFER) {` | — | https://docs.acki-nacki.org/solidity |
| 271 | `            // warm bounce — peer didn't exist; retry cold-form` | — | https://docs.acki-nacki.org/solidity |
| 272 | `            TvmCell fullCell = body.loadRef();` | — | https://docs.acki-nacki.org/solidity |
| 273 | `            (` | — | https://docs.acki-nacki.org/solidity |
| 274 | `                uint32 fid,` | — | https://docs.acki-nacki.org/solidity |
| 275 | `                uint64 qId,` | — | https://docs.acki-nacki.org/solidity |
| 276 | `                uint128 amt,` | — | https://docs.acki-nacki.org/solidity |
| 277 | `                address from_,` | — | https://docs.acki-nacki.org/solidity |
| 278 | `                address destOwner,` | — | https://docs.acki-nacki.org/solidity |
| 279 | `                address responseAddress,` | — | https://docs.acki-nacki.org/solidity |
| 280 | `                uint128 forwardShellAmount,` | — | https://docs.acki-nacki.org/solidity |
| 281 | `                TvmCell forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 282 | `            ) = abi.decode(fullCell, (` | — | https://docs.acki-nacki.org/solidity |
| 283 | `                uint32, uint64, uint128, address, address, address, uint128, TvmCell` | — | https://docs.acki-nacki.org/solidity |
| 284 | `            ));` | — | https://docs.acki-nacki.org/solidity |
| 285 | `            fid; qId; amt; from_;` | — | https://docs.acki-nacki.org/solidity |
| 286 | `` | — | https://docs.acki-nacki.org/solidity |
| 287 | `            TvmCell init = abi.encodeStateInit({` | — | https://docs.acki-nacki.org/solidity |
| 288 | `                contr: AFTWallet,` | — | https://docs.acki-nacki.org/solidity |
| 289 | `                varInit: {_root: _root, _owner: destOwner},` | — | https://docs.acki-nacki.org/solidity |
| 290 | `                code: tvm.code()` | — | https://docs.acki-nacki.org/solidity |
| 291 | `            });` | — | https://docs.acki-nacki.org/solidity |
| 292 | `            TvmCell coldBody = abi.encodeBody(` | — | https://docs.acki-nacki.org/solidity |
| 293 | `                AFTWallet,` | — | https://docs.acki-nacki.org/solidity |
| 294 | `                queryId, amount, _owner, destOwner, responseAddress,` | — | https://docs.acki-nacki.org/solidity |
| 295 | `                forwardShellAmount, forwardPayload` | — | https://docs.acki-nacki.org/solidity |
| 296 | `            );` | — | https://docs.acki-nacki.org/solidity |
| 297 | `            // own gas + cold-deploy value + body/stateInit fwd_fee` | — | https://docs.acki-nacki.org/solidity |
| 298 | `            uint128 deployBodySize = _estimateFwdFee(coldBody) + _estimateFwdFee(init);` | — | https://docs.acki-nacki.org/solidity |
| 299 | `            uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)` | — | https://docs.acki-nacki.org/solidity |
| 300 | `                                     + uint128(SHELL_PER_DEPLOY)` | — | https://docs.acki-nacki.org/solidity |
| 301 | `                                     + deployBodySize);` | — | https://docs.acki-nacki.org/solidity |
| 302 | `            // short on fuel — restore _balance instead of a partial commit` | — | https://docs.acki-nacki.org/solidity |
| 303 | `            if (_currentShell() < uint128(conversion)) {` | — | https://docs.acki-nacki.org/solidity |
| 304 | `                _balance += amount;` | — | https://docs.acki-nacki.org/solidity |
| 305 | `                return;` | — | https://docs.acki-nacki.org/solidity |
| 306 | `            }` | — | https://docs.acki-nacki.org/solidity |
| 307 | `            gosh.cnvrtshellq(conversion);` | — | https://docs.acki-nacki.org/solidity |
| 308 | `` | — | https://docs.acki-nacki.org/solidity |
| 309 | `            // forward all remaining SHELL — the new peer self-funds from it` | — | https://docs.acki-nacki.org/solidity |
| 310 | `            uint128 forward = _currentShell();` | — | https://docs.acki-nacki.org/solidity |
| 311 | `            forward = forward > uint128(conversion) ? forward - uint128(conversion) : 0;` | — | https://docs.acki-nacki.org/solidity |
| 312 | `            mapping(uint32 => varuint32) outCc;` | — | [mapping](https://docs.acki-nacki.org/solidity/mapping.html) |
| 313 | `            if (forward > 0) outCc[CURRENCIES_ID_SHELL] = varuint32(forward);` | — | https://docs.acki-nacki.org/solidity |
| 314 | `` | — | https://docs.acki-nacki.org/solidity |
| 315 | `            new AFTWallet{` | — | https://docs.acki-nacki.org/solidity |
| 316 | `                stateInit: init,` | — | https://docs.acki-nacki.org/solidity |
| 317 | `                value: varuint16(SHELL_PER_DEPLOY),` | — | https://docs.acki-nacki.org/solidity |
| 318 | `                currencies: outCc,` | — | https://docs.acki-nacki.org/solidity |
| 319 | `                flag: 0,` | — | https://docs.acki-nacki.org/solidity |
| 320 | `                bounce: true` | — | https://docs.acki-nacki.org/solidity |
| 321 | `            }(queryId, amount, _owner, destOwner, responseAddress, forwardShellAmount, forwardPayload);` | — | https://docs.acki-nacki.org/solidity |
| 322 | `        } else if (op == 0x00000001) {` | — | https://docs.acki-nacki.org/solidity |
| 323 | `            // cold-form deploy also failed — restore balance` | — | https://docs.acki-nacki.org/solidity |
| 324 | `            _balance += amount;` | — | https://docs.acki-nacki.org/solidity |
| 325 | `        } else if (op == OP_BURN_NOTIFICATION) {` | — | https://docs.acki-nacki.org/solidity |
| 326 | `            _balance += amount;` | — | https://docs.acki-nacki.org/solidity |
| 327 | `        }` | — | https://docs.acki-nacki.org/solidity |
| 328 | `        // other ops: silent drop is safe — _balance is credited before any` | — | https://docs.acki-nacki.org/solidity |
| 329 | `        // outbound. Any new bounce:true outbound MUST extend the set above.` | — | https://docs.acki-nacki.org/solidity |
| 330 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 331 | `` | — | https://docs.acki-nacki.org/solidity |
| 332 | `    // ─── Views ────────────────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 333 | `` | — | https://docs.acki-nacki.org/solidity |
| 334 | `    function getDetails() external view returns (` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 335 | `        address root,` | — | https://docs.acki-nacki.org/solidity |
| 336 | `        address owner,` | — | https://docs.acki-nacki.org/solidity |
| 337 | `        uint128 balance` | — | https://docs.acki-nacki.org/solidity |
| 338 | `    ) {` | — | https://docs.acki-nacki.org/solidity |
| 339 | `        return (_root, _owner, _balance);` | — | https://docs.acki-nacki.org/solidity |
| 340 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 341 | `` | — | https://docs.acki-nacki.org/solidity |
| 342 | `    /// Forward-fee estimate for `body` (~5% underestimate; `dest` unused).` | — | https://docs.acki-nacki.org/solidity |
| 343 | `    function estimateFwdFee(address dest, TvmCell body) external pure returns (uint128) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 344 | `        dest;` | — | https://docs.acki-nacki.org/solidity |
| 345 | `        return _estimateFwdFee(body);` | — | https://docs.acki-nacki.org/solidity |
| 346 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 347 | `` | — | https://docs.acki-nacki.org/solidity |
| 348 | `    function getFwdPrices() external pure returns (uint64 lumpPrice, uint64 bitPrice, uint64 cellPrice) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 349 | `        FwdPrices p = _loadFwdPrices();` | — | https://docs.acki-nacki.org/solidity |
| 350 | `        return (p.lumpPrice, p.bitPrice, p.cellPrice);` | — | https://docs.acki-nacki.org/solidity |
| 351 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 352 | `` | — | https://docs.acki-nacki.org/solidity |
| 353 | `    function getGasPrice() external pure returns (uint64 gasPrice) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 354 | `        return _loadGasPrice();` | — | https://docs.acki-nacki.org/solidity |
| 355 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 356 | `` | — | https://docs.acki-nacki.org/solidity |
| 357 | `    // ─── Internal helpers ─────────────────────────────────────────────────` | — | https://docs.acki-nacki.org/solidity |
| 358 | `` | — | https://docs.acki-nacki.org/solidity |
| 359 | `    function _getWalletAddress(address walletOwner) internal view returns (address walletAddress) {` | — | [functions](https://docs.acki-nacki.org/solidity/functions.html) |
| 360 | `        TvmCell init = abi.encodeStateInit({` | — | https://docs.acki-nacki.org/solidity |
| 361 | `            contr: AFTWallet,` | — | https://docs.acki-nacki.org/solidity |
| 362 | `            varInit: {_root: _root, _owner: walletOwner},` | — | https://docs.acki-nacki.org/solidity |
| 363 | `            code: tvm.code()` | — | https://docs.acki-nacki.org/solidity |
| 364 | `        });` | — | https://docs.acki-nacki.org/solidity |
| 365 | `        walletAddress = address.makeAddrStd(0, tvm.hash(init));` | — | https://docs.acki-nacki.org/solidity |
| 366 | `    }` | — | https://docs.acki-nacki.org/solidity |
| 367 | `}` | — | https://docs.acki-nacki.org/solidity |

---

**Summary**: No automated findings. Review each line for security considerations and refer to the linked documentation.
