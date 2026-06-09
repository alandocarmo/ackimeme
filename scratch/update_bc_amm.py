import re

def update_file():
    with open('../contracts/BondingCurve.sol', 'r') as f:
        content = f.read()

    # 1. Add factory address to variables
    content = re.sub(
        r'address public myAftWallet;',
        r'address public myAftWallet;\n    address public factoryAddress;\n    address public ammPairAddress;',
        content
    )

    # 2. Add setFactory method
    content = re.sub(
        r'function unpause\(\) public whenPaused \{',
        r'function setFactory(address _factory) external {\n        require(msg.sender == owner, 102);\n        factoryAddress = _factory;\n    }\n\n    function unpause() public whenPaused {',
        content
    )

    # 3. Add IAFTWallet interface for internalTransfer
    content = re.sub(
        r'import "\./interfaces/IAFTWallet.sol";',
        r'import "./interfaces/IAFTWallet.sol";\n\ninterface IAckiSwapFactory {\n    function deployPair(address tokenRoot, address callbackTarget) external;\n}',
        content
    )

    # 4. Modify buy/sell to reject if isAmm
    content = re.sub(
        r'function buy\(uint128 minTokensOut, address responseAddress\) public whenNotPaused \{',
        r'function buy(uint128 minTokensOut, address responseAddress) public whenNotPaused {\n        require(!isAmm, 250, "BondingCurve trading ended. Use AckiSwap!");',
        content
    )

    content = re.sub(
        r'function sell\(uint128 tokenAmount, uint128 minShellOut\) internal whenNotPaused \{',
        r'function sell(uint128 tokenAmount, uint128 minShellOut) internal whenNotPaused {\n        require(!isAmm, 250, "BondingCurve trading ended. Use AckiSwap!");',
        content
    )

    # 5. Rewrite _migrateToAmm
    new_migrate = """    function _migrateToAmm() private {
        require(factoryAddress != address(0), 251, "AckiSwap Factory not set");
        isAmm = true;
        migratedAt = uint32(block.timestamp);
        
        // Asynchronously deploy pair and get callback
        IAckiSwapFactory(factoryAddress).deployPair{value: 2000000000, flag: 1}(_tokenRoot, address(this));
    }

    // Callback from AckiSwapFactory
    function onPairDeployed(address pair) external {
        require(msg.sender == factoryAddress, 252, "Only factory can call");
        ammPairAddress = pair;
        
        // Transfer all remaining SHELL
        mapping(uint32 => varuint32) emptyCc;
        uint128 shellToSend = reserveBalance - 1000000000; // retain 1 SHELL for gas
        
        // Transfer all remaining AFT tokens with Op = 1 (Initial Liquidity)
        TvmBuilder builder;
        builder.store(uint32(1)); // op = 1
        TvmCell payload = builder.toCell();

        IAFTWallet(myAftWallet).internalTransfer{value: 1000000000, flag: 1}(
            0,
            tokenPool,
            address(this),
            pair,
            owner, // excess returns to owner
            shellToSend, // forward Shell
            payload
        );
        
        emit MigratedToInternalAmm(0, migratedAt);
    }"""
    
    # We replace the old _migrateToAmm function entirely
    # The old _migrateToAmm goes from "function _migrateToAmm() private {" to the end of the function.
    content = re.sub(
        r'function _migrateToAmm\(\) private \{.*?(?=    function _applyFees)',
        new_migrate + '\n\n',
        content,
        flags=re.DOTALL
    )

    with open('../contracts/BondingCurve.sol', 'w') as f:
        f.write(content)

if __name__ == '__main__':
    update_file()
