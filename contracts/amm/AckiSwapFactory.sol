pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./AckiSwapPair.sol";

interface IFactoryCallback {
    function onPairDeployed(address pair) external;
}

contract AckiSwapFactory {
    address static _owner;
    TvmCell static _pairCode;
    
    address public feeRecipient;
    address public launchFactory;

    mapping(address => bool) public approvedBondingCurves;

    event PairCreated(address tokenRoot, address pairAddress, uint64 timestamp);

    constructor(address _feeRecipient) {
        require(msg.pubkey() == tvm.pubkey(), 100);
        require(_feeRecipient != address(0), 101, "Fee recipient cannot be zero");
        tvm.accept();
        feeRecipient = _feeRecipient;
    }

    function setFeeRecipient(address _feeRecipient) external {
        require(msg.pubkey() == tvm.pubkey(), 100);
        require(_feeRecipient != address(0), 101, "Fee recipient cannot be zero");
        tvm.accept();
        feeRecipient = _feeRecipient;
    }

    function setLaunchFactory(address _launchFactory) external {
        require(msg.pubkey() == tvm.pubkey(), 100);
        require(_launchFactory != address(0), 101, "LaunchFactory cannot be zero");
        tvm.accept();
        launchFactory = _launchFactory;
    }

    function approveBondingCurve(address bc) external {
        require(msg.pubkey() == tvm.pubkey() || msg.sender == launchFactory, 100);
        tvm.accept();
        approvedBondingCurves[bc] = true;
    }

    function deployPair(address tokenRoot, address callbackTarget) external {
        require(approvedBondingCurves[msg.sender], 102, "Only approved BondingCurves can deploy pairs");
        tvm.accept();
        TvmCell stateInit = abi.encodeStateInit({
            contr: AckiSwapPair,
            varInit: {
                _factory: address(this),
                _tokenRoot: tokenRoot,
                _feeRecipient: feeRecipient
            },
            code: _pairCode
        });

        address pair = new AckiSwapPair{
            stateInit: stateInit,
            value: 2000000000, // 2 SHELL
            flag: 0,
            bounce: false
        }(callbackTarget);

        emit PairCreated(tokenRoot, pair, uint64(block.timestamp));
        
        if (callbackTarget != address(0)) {
            // R7-C1: flag 64 would forward the inbound value, which arrives
            // zeroed cross-Dapp-ID — send an explicit non-zero value instead.
            IFactoryCallback(callbackTarget).onPairDeployed{value: 0.1 ton, flag: 1}(pair);
        }
    }

    function getPairAddress(address tokenRoot) external view returns (address) {
        TvmCell stateInit = abi.encodeStateInit({
            contr: AckiSwapPair,
            varInit: {
                _factory: address(this),
                _tokenRoot: tokenRoot,
                _feeRecipient: feeRecipient
            },
            code: _pairCode
        });
        return address.makeAddrStd(0, tvm.hash(stateInit));
    }
}
