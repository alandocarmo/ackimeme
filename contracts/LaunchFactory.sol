pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./AFTRoot.sol";
import "./BondingCurve.sol";

contract LaunchFactory {
    // ─── Events ───────────────────────────────────────────────────────────────
    event TokenLaunched(address tokenRoot, address bondingCurve, address creator, string name, string symbol);

    // ─── State ────────────────────────────────────────────────────────────────
    address public owner;
    address public feeRecipient;
    uint32 public launchCount;
    address public ackiSwapFactory;

    // TvmCells code of the contracts to be deployed
    TvmCell public tokenRootCode;
    TvmCell public bondingCurveCode;
    TvmCell public tokenWalletCode;

    constructor(
        address _owner,
        address _feeRecipient,
        TvmCell _tokenRootCode,
        TvmCell _bondingCurveCode,
        TvmCell _tokenWalletCode
    ) {
        tvm.accept();
        owner = _owner;
        feeRecipient = _feeRecipient;
        tokenRootCode = _tokenRootCode;
        bondingCurveCode = _bondingCurveCode;
        tokenWalletCode = _tokenWalletCode;
    }

    /// @notice Updates the code cells for future deployments
    function updateCodes(
        TvmCell _tokenRootCode,
        TvmCell _bondingCurveCode,
        TvmCell _tokenWalletCode
    ) external {
        require(msg.sender == owner, 101, "Only owner");
        tvm.accept();
        tokenRootCode = _tokenRootCode;
        bondingCurveCode = _bondingCurveCode;
        tokenWalletCode = _tokenWalletCode;
    }

    function setFeeRecipient(address _feeRecipient) external {
        require(msg.sender == owner, 101, "Only owner");
        tvm.accept();
        feeRecipient = _feeRecipient;
    }

    function setAckiSwapFactory(address _ackiSwapFactory) external {
        require(msg.sender == owner, 101, "Only owner");
        tvm.accept();
        ackiSwapFactory = _ackiSwapFactory;
    }

    /// @notice Deploys the TokenRoot and BondingCurve via internal messages
    /// Because this is an internal message, both contracts inherit LaunchFactory's Dapp ID.
    function deployTokenAndCurve(
        string name,
        string symbol,
        uint8 decimals,
        uint256 supplyCap,
        address creator,
        bytes creationFeeTxHash,
        bool pumpForever,
        uint256 slopeDivisor
    ) external {
        // This is a cross-dapp call from the user to the Factory. We accept the gas.
        tvm.accept();

        // Assume gas is provided via prefunding (address(this).balance). We need enough VMSHELL for two deployments + messages.
        require(address(this).balance >= 3 ton, 102, "Insufficient gas for launch (Factory must be prefunded)");

        launchCount++;

        // 1. Compute BondingCurve address deterministically based on static vars
        // We need the TokenRoot address first.
        // Wait, TokenRoot depends on name, symbol, decimals, rootOwner.
        // Wait, in Acki Nacki, address is determined by stateInit (code + static variables).
        // Let's assume TokenRoot's static vars are:
        // address static public rootOwner_;
        // string static public name_;
        // string static public symbol_;
        // uint8 static public decimals_;
        // address static public walletCode_;

        TvmCell rootStateInit = tvm.buildStateInit({
            contr: AFTRoot,
            varInit: {
                _deployer: address(this),
                _name: name,
                _symbol: symbol,
                _decimals: decimals
            },
            code: tokenRootCode
        });

        address tokenRootAddr = address(tvm.hash(rootStateInit));

        // 2. Compute BondingCurve address
        TvmCell curveStateInit = tvm.buildStateInit({
            contr: BondingCurve,
            varInit: {
                _tokenRoot: tokenRootAddr,
                _supplyCap: supplyCap,
                _factory: address(this)
            },
            code: bondingCurveCode
        });

        address bondingCurveAddr = address(tvm.hash(curveStateInit));

        // 3. Deploy BondingCurve
        new BondingCurve{
            stateInit: curveStateInit,
            value: 1 ton,
            flag: 1
        }(
            creator,
            tokenRootAddr,
            name,
            symbol,
            creationFeeTxHash,
            feeRecipient,
            pumpForever,
            slopeDivisor,
            ackiSwapFactory
        );

        // 4. Deploy TokenRoot with BondingCurve as the permanent Admin
        TvmCell emptyContent;
        new AFTRoot{
            stateInit: rootStateInit,
            value: 1 ton,
            flag: 1
        }(
            bondingCurveAddr, // admin
            true, // mintable
            emptyContent, // content
            tokenWalletCode, // walletCode
            address(0), // initialOwner
            0 // initialSupply
        );

        emit TokenLaunched(tokenRootAddr, bondingCurveAddr, creator, name, symbol);

        // 5. Post-Deploy Configuration
        // A1: Initialize the AFT wallet for the curve so it can sell/burn
        // Needs 2 SHELL for gas according to AFT rules.
        mapping(uint32 => varuint32) initCc;
        initCc[2] = varuint32(2_000_000_000); // 2 SHELL (assuming SHELL_CURRENCY_ID=2)
        BondingCurve(bondingCurveAddr).initAftWallet{value: 0.2 ton, currencies: initCc, flag: 1}();

        // Return excess gas to sender
        msg.sender.transfer({ value: 0, flag: 128, bounce: false });
    }
}
