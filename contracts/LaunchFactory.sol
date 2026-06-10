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
        // Assume gas is provided via msg.value. We need enough VMSHELL for two deployments.
        require(msg.value >= 2.5 ton, 102, "Insufficient gas for launch (send at least 2.5 SHELL)");
        
        // This is a cross-dapp call from the user to the Factory. We accept the gas.
        tvm.accept();

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
                _supplyCap: supplyCap
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
            slopeDivisor
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

        // Return excess gas to sender
        msg.sender.transfer({ value: 0, flag: 128, bounce: false });
    }
}
