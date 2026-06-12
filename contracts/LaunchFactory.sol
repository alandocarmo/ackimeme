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
    address public ammFactory;

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

    function setAmmFactory(address _ammFactory) external {
        require(msg.sender == owner, 101, "Only owner can set AckiSwapFactory");
        tvm.accept();
        ammFactory = _ammFactory;
    }

    /// @notice Deploys the TokenRoot and BondingCurve via internal messages
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
        require(msg.pubkey() == tvm.pubkey(), 100, "Only the factory platform can launch tokens");
        // R7: without an AMM factory the curve deploys with ammFactory=0 and can
        // never migrate (and the approve below would burn value at address(0)).
        require(ammFactory != address(0), 103, "AMM factory not set (call setAmmFactory)");
        tvm.accept();

        // Assume gas is provided via prefunding (address(this).balance). We need enough VMSHELL for two deployments + messages.
        require(address(this).balance >= 3 ton, 102, "Insufficient gas for launch (Factory must be prefunded)");

        launchCount++;

        // 1. Compute TokenRoot address deterministically based on static vars

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
            ammFactory
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
        // 5. Initialize AFT Wallet for BondingCurve
        mapping(uint32 => varuint32) initCc;
        initCc[2] = varuint32(2_000_000_000); // 2 SHELL (assuming SHELL_CURRENCY_ID=2)
        BondingCurve(bondingCurveAddr).initAftWallet{value: 0.2 ton, currencies: initCc, flag: 1}();

        // 6. Approve the BondingCurve in the AckiSwapFactory
        IAckiSwapFactory(ammFactory).approveBondingCurve{value: 0.1 ton, flag: 1}(bondingCurveAddr);
    }
}
