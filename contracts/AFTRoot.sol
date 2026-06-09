// SPDX-License-Identifier: MIT
pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./modifiers/modifiers.sol";
import "./interfaces/IAFTExcesses.sol";
import "./interfaces/IAFTWallet.sol";
import "./interfaces/IAFTWalletAddressReceiver.sol";
import "./AFTWallet.sol";

/// AFT root — TON jetton-master (discoverable) port.
///
/// Mint follows the same warm-first / onBounce-cold-retry pattern as
/// wallet→wallet transfer.
contract AFTRoot is Modifiers {
    string constant version = "1.0.0";

    address static _deployer;
    string static _name;
    string static _symbol;
    uint128 static _decimals;

    address _admin;
    address _pendingAdmin;
    bool _mintable;
    uint128 _totalSupply;

    TvmCell _content;
    TvmCell _walletCode;

    /// Dual deploy auth: `_deployer` contract path OR `tvm.pubkey()` keypair
    /// path — set exactly one in the stateInit.
    constructor(
        address admin,
        bool mintable,
        TvmCell content,
        TvmCell walletCode,
        address initialOwner,
        uint128 initialSupply
    ) {
        bool byContract = _deployer != ZERO_ADDRESS && msg.sender == _deployer;
        bool byKeys = tvm.pubkey() != 0 && msg.pubkey() == tvm.pubkey();
        require(byContract || byKeys, ERR_INVALID_SENDER);
        require(_decimals <= DECIMALS_MAX, ERR_TOO_BIG_DECIMALS);
        // admin == 0 would collide with external msg.sender in onlyAdmin
        require(admin != ZERO_ADDRESS, ERR_INVALID_SENDER);
        tvm.accept();

        _admin = admin;
        _content = content;
        _walletCode = walletCode;

        emit RootConfigured{dest: _adminChannel()}(
            _name,
            _symbol,
            _decimals,
            admin,
            mintable,
            uint64(block.timestamp)
        );

        // force mint on to seed initialSupply, then lock to caller intent
        _mintable = true;
        if (initialSupply > 0) {
            _mint(initialOwner, initialSupply, 0, ZERO_ADDRESS, 0, TvmCell());
        }
        _mintable = mintable;
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    function mint(
        uint64 queryId,
        address toOwner,
        uint128 amount,
        address responseDestination,
        uint128 forwardShellAmount,
        TvmCell forwardPayload
    ) public internalMsg onlyAdmin(_admin) functionID(0x2786d61d) {
        tvm.accept();
        _mint(toOwner, amount, queryId, responseDestination, forwardShellAmount, forwardPayload);
    }

    function closeMint() public internalMsg onlyAdmin(_admin) accept functionID(0x58f5d4f2) {
        _mintable = false;
        emit MintClosed{dest: _adminChannel()}(_admin, uint64(block.timestamp));
    }

    function setPendingAdmin(address newAdmin) public internalMsg onlyAdmin(_admin) accept functionID(0x1b1064d7) {
        _pendingAdmin = newAdmin;
        emit PendingAdminSet{dest: _adminChannel()}(_admin, newAdmin, uint64(block.timestamp));
    }

    function acceptAdmin() public internalMsg onlyPendingAdmin(_pendingAdmin) accept functionID(0x726cafdd) {
        address oldAdmin = _admin;
        _admin = _pendingAdmin;
        _pendingAdmin = ZERO_ADDRESS;
        emit AdminAccepted{dest: _adminChannel()}(oldAdmin, _admin, uint64(block.timestamp));
    }

    function setContent(TvmCell content) public internalMsg onlyAdmin(_admin) accept functionID(0x0d7dc08a) {
        _content = content;
        emit ContentUpdated{dest: _adminChannel()}(_admin, tvm.hash(content), uint64(block.timestamp));
    }

    // ─── Discovery (TEP-89 0x2c76b973) ────────────────────────────────────

    function provideWalletAddress(
        uint64 queryId,
        address ownerAddress,
        bool includeAddress
    ) public internalMsg functionID(0x2c76b973) {
        tvm.accept();

        address walletAddress = _getWalletAddress(ownerAddress);
        optional(address) owner;
        if (includeAddress) {
            owner.set(ownerAddress);
        }

        emit WalletAddressProvided{dest: _adminChannel()}(
            queryId,
            msg.sender,
            ownerAddress,
            walletAddress,
            includeAddress,
            uint64(block.timestamp)
        );

        TvmCell body = abi.encodeBody(
            IAFTWalletAddressReceiver.takeWalletAddress,
            queryId, walletAddress, owner
        );
        uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)
                                 + uint128(SHELL_PER_HOP)
                                 + _estimateFwdFee(body));
        require(_inboundShell() >= conversion, ERR_INSUFFICIENT_FUEL);
        // gosh.cnvrtshellq(conversion);

        // forward inbound SHELL net of conversion
        uint128 forward = _inboundShell() - uint128(conversion);
        mapping(uint32 => varuint32) outCc;
        if (forward > 0) outCc[CURRENCIES_ID_SHELL] = varuint32(forward);

        // value must be non-zero — AN denies gas_credit on msg.value = 0
        IAFTWalletAddressReceiver(msg.sender).takeWalletAddress{
            value: varuint16(SHELL_PER_HOP),
            currencies: outCc,
            flag: 1,
            bounce: false
        }(queryId, walletAddress, owner);
    }

    // ─── Burn intake (TEP-74 0x7bdd97de) ──────────────────────────────────

    function onAFTBurnNotification(
        uint64 queryId,
        uint128 amount,
        address sender,
        address responseDestination
    ) public internalMsg functionID(0x7bdd97de) {
        require(msg.sender == _getWalletAddress(sender), ERR_WRONG_WALLET);

        tvm.accept();
        _totalSupply -= amount;

        emit AFTBurned{dest: _activityChannel()}(
            queryId,
            sender,
            amount,
            _totalSupply,
            uint64(block.timestamp)
        );

        if (responseDestination != ZERO_ADDRESS) {
            // own gas + 1 excess outbound (value=0, body fwd_fee)
            TvmCell body = abi.encodeBody(IAFTExcesses.onAFTExcesses, queryId);
            uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)
                                     + _estimateFwdFee(body));
            // gosh.cnvrtshellq(conversion);

            // forward inbound SHELL net of conversion, capped per outbound
            uint128 currentSh = _currentShell();
            uint128 forward = currentSh > uint128(conversion) ? currentSh - uint128(conversion) : 0;
            if (forward > SHELL_PER_EXCESS_MAX) forward = SHELL_PER_EXCESS_MAX;
            mapping(uint32 => varuint32) excCc;
            if (forward > 0) {
                excCc[CURRENCIES_ID_SHELL] = varuint32(forward);
            }
            IAFTExcesses(responseDestination).onAFTExcesses{
                value: varuint16(0),
                currencies: excCc,
                flag: 1,
                bounce: false
            }(queryId);
        }
    }

    // ─── Transfer recording (wallet→root callback after credit commit) ────

    function recordTransfer(
        uint64 queryId,
        address fromOwner,
        address toOwner,
        uint128 amount,
        bool notifiedReceiver,
        uint256 forwardPayloadHash
    ) public internalMsg functionID(0xae71da1a) {
        // auth runs in gas_credit — bogus callers never get past credit phase
        require(msg.sender == _getWalletAddress(toOwner), ERR_WRONG_WALLET);
        tvm.accept();

        emit AFTTransferred{dest: _activityChannel()}(
            queryId,
            fromOwner,
            toOwner,
            amount,
            notifiedReceiver,
            forwardPayloadHash,
            uint64(block.timestamp)
        );
    }

    // ─── Bounce handling — stateless via body-ref decode ──────────────────

    onBounce(TvmSlice body) external {
        tvm.accept();

        uint32 op = body.load(uint32);
        uint64 queryId = body.load(uint64);
        uint128 amount = body.load(uint128);

        if (op == OP_INTERNAL_TRANSFER) {
            // warm bounce — peer didn't exist; retry cold-form
            TvmCell fullCell = body.loadRef();
            (
                uint32 fid,
                uint64 qId,
                uint128 amt,
                address from_,
                address destOwner,
                address responseAddress,
                uint128 forwardShellAmount,
                TvmCell forwardPayload
            ) = abi.decode(fullCell, (
                uint32, uint64, uint128, address, address, address, uint128, TvmCell
            ));
            fid; qId; amt; from_;

            TvmCell init = _buildWalletInitData(destOwner);
            TvmCell coldBody = abi.encodeBody(
                AFTWallet,
                queryId, amount, address(this), destOwner, responseAddress,
                forwardShellAmount, forwardPayload
            );
            uint128 deployFwd = _estimateFwdFee(coldBody) + _estimateFwdFee(init);
            uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)
                                     + uint128(SHELL_PER_DEPLOY)
                                     + deployFwd);
            // gosh.cnvrtshellq(conversion);

            // forward all remaining SHELL — receiver re-caps its own refunds
            uint128 forward = _currentShell();
            forward = forward > uint128(conversion) ? forward - uint128(conversion) : 0;
            mapping(uint32 => varuint32) outCc;
            if (forward > 0) outCc[CURRENCIES_ID_SHELL] = varuint32(forward);

            new AFTWallet{
                stateInit: init,
                value: varuint16(SHELL_PER_DEPLOY),
                currencies: outCc,
                flag: 0,
                bounce: true
            }(queryId, amount, address(this), destOwner, responseAddress, forwardShellAmount, forwardPayload);
        } else if (op == 0x00000001) {
            // cold-form deploy also failed — roll back supply
            _totalSupply -= amount;
            emit AFTMintRolledBack{dest: _activityChannel()}(
                queryId,
                amount,
                _totalSupply,
                uint64(block.timestamp)
            );
        }
    }

    // ─── Views ────────────────────────────────────────────────────────────

    function getAftData() external view returns (
        uint128 totalSupply,
        bool mintable,
        address adminAddress,
        TvmCell content,
        TvmCell walletCode
    ) {
        return (_totalSupply, _mintable, _admin, _content, _walletCode);
    }

    /// TON-tooling alias for getAftData.
    function getJettonData() external view returns (
        uint128 totalSupply,
        bool mintable,
        address adminAddress,
        TvmCell content,
        TvmCell walletCode
    ) {
        return (_totalSupply, _mintable, _admin, _content, _walletCode);
    }

    function getWalletAddress(address ownerAddress) external view returns (address walletAddress) {
        return _getWalletAddress(ownerAddress);
    }

    function getDetails() external view returns (
        string name,
        string symbol,
        uint128 decimals,
        address deployer,
        address admin,
        address pendingAdmin,
        bool mintable,
        uint128 totalSupply
    ) {
        return (_name, _symbol, _decimals, _deployer, _admin, _pendingAdmin, _mintable, _totalSupply);
    }

    /// Forward-fee estimate for `body` (~5% underestimate; `dest` unused).
    function estimateFwdFee(address dest, TvmCell body) external pure returns (uint128) {
        dest;
        return _estimateFwdFee(body);
    }

    function getFwdPrices() external pure returns (uint64 lumpPrice, uint64 bitPrice, uint64 cellPrice) {
        FwdPrices p = _loadFwdPrices();
        return (p.lumpPrice, p.bitPrice, p.cellPrice);
    }

    function getGasPrice() external pure returns (uint64 gasPrice) {
        return _loadGasPrice();
    }

    // ─── Internal helpers ─────────────────────────────────────────────────

    /// Entry-hop self-conversion + warm-first internalTransfer.
    function _mint(
        address toOwner,
        uint128 amount,
        uint64 queryId,
        address responseDestination,
        uint128 forwardShellAmount,
        TvmCell forwardPayload
    ) internal {
        require(amount > 0, ERR_ZERO_AMOUNT);
        require(_mintable, ERR_MINT_DISABLED);
        require(toOwner != ZERO_ADDRESS, ERR_INVALID_SENDER);

        _totalSupply += amount;

        TvmCell body = abi.encodeBody(
            IAFTWallet.internalTransfer,
            queryId, amount, address(this), toOwner, responseDestination,
            forwardShellAmount, forwardPayload
        );
        uint64 conversion = uint64(_gasToNative(EST_GAS_ENTRY)
                                 + uint128(SHELL_PER_HOP)
                                 + _estimateFwdFee(body));
        // gosh.cnvrtshellq(conversion);

        uint128 currentSh = _currentShell();
        uint128 forward = currentSh > uint128(conversion) ? currentSh - uint128(conversion) : 0;
        mapping(uint32 => varuint32) outCc;
        if (forward > 0) outCc[CURRENCIES_ID_SHELL] = varuint32(forward);

        // warm-first; if the wallet is uninit the msg bounces → cold retry
        address wallet = _getWalletAddress(toOwner);
        IAFTWallet(wallet).internalTransfer{
            value: varuint16(SHELL_PER_HOP),
            currencies: outCc,
            flag: 1,
            bounce: true
        }(queryId, amount, address(this), toOwner, responseDestination, forwardShellAmount, forwardPayload);

        emit AFTMinted{dest: _activityChannel()}(
            queryId,
            toOwner,
            amount,
            _totalSupply,
            tvm.hash(forwardPayload),
            uint64(block.timestamp)
        );
    }

    function _buildWalletInitData(address walletOwner) internal view returns (TvmCell) {
        return abi.encodeStateInit({
            contr: AFTWallet,
            varInit: {
                _root: address(this),
                _owner: walletOwner
            },
            code: _walletCode
        });
    }

    function _getWalletAddress(address walletOwner) internal view returns (address walletAddress) {
        walletAddress = address.makeAddrStd(0, tvm.hash(_buildWalletInitData(walletOwner)));
    }
}
