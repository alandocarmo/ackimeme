import re

def update_pair():
    with open('../contracts/amm/AckiSwapPair.sol', 'r') as f:
        content = f.read()

    # Add _feeRecipient to static vars
    content = re.sub(
        r'address static _tokenRoot;',
        r'address static _tokenRoot;\n    address static _feeRecipient;',
        content
    )

    # Replace swapShellForToken
    swap_shell_old = r'''    function swapShellForToken\(uint128 minAmountOut, address responseDestination\) external \{
        require\(initialized, 103\);
        uint128 amountIn = uint128\(msg.value\) - 1000000000; // Deduct 1 SHELL for gas
        require\(amountIn > 0, 104\);

        tvm.accept\(\);

        // 0.3% fee: amountInWithFee = amountIn \* 997
        uint128 amountInWithFee = amountIn \* 997;
        uint128 numerator = amountInWithFee \* reserveToken;
        uint128 denominator = \(reserveShell \* 1000\) \+ amountInWithFee;
        uint128 amountOut = numerator / denominator;

        require\(amountOut >= minAmountOut, 105\);
        require\(amountOut < reserveToken, 106\);

        reserveShell \+= amountIn;
        reserveToken -= amountOut;

        emit Swap\(msg.sender, amountIn, 0, 0, amountOut\);

        TvmCell emptyPayload;
        IAFTWallet\(tokenWallet\).internalTransfer\{value: varuint16\(0\), flag: 64\}\(
            0,
            amountOut,
            address\(this\),
            msg.sender, // toOwner
            responseDestination, // excess
            0,
            emptyPayload
        \);
    \}'''

    swap_shell_new = '''    function swapShellForToken(uint128 minAmountOut, address responseDestination) external {
        require(initialized, 103);
        uint128 amountIn = uint128(msg.value) - 1000000000; // Deduct 1 SHELL for gas
        require(amountIn > 0, 104);

        tvm.accept();

        // Protocol Fee: 0.05%
        uint128 protocolFee = (amountIn * 5) / 10000;
        uint128 amountInAfterProtocolFee = amountIn - protocolFee;

        // Pool Fee: 0.25%
        uint128 amountInWithPoolFee = amountInAfterProtocolFee * 9975;
        uint128 numerator = amountInWithPoolFee * reserveToken;
        uint128 denominator = (reserveShell * 10000) + amountInWithPoolFee;
        uint128 amountOut = numerator / denominator;

        require(amountOut >= minAmountOut, 105);
        require(amountOut < reserveToken, 106);

        reserveShell += amountInAfterProtocolFee;
        reserveToken -= amountOut;

        emit Swap(msg.sender, amountIn, 0, 0, amountOut);

        // Send Protocol Fee to feeRecipient
        mapping(uint32 => varuint32) feeCc;
        feeCc[2] = varuint32(protocolFee);
        _feeRecipient.transfer({value: 50000000, flag: 0, bounce: false, currencies: feeCc});

        TvmCell emptyPayload;
        IAFTWallet(tokenWallet).internalTransfer{value: varuint16(0), flag: 64}(
            0,
            amountOut,
            address(this),
            msg.sender, // toOwner
            responseDestination, // excess
            0,
            emptyPayload
        );
    }'''
    content = re.sub(swap_shell_old, swap_shell_new, content)

    # Replace _swapTokenForShell
    swap_token_old = r'''    function _swapTokenForShell\(uint128 amountIn, address user, uint128 minAmountOut, address responseDestination\) private \{
        // 0.3% fee
        uint128 amountInWithFee = amountIn \* 997;
        uint128 numerator = amountInWithFee \* reserveShell;
        uint128 denominator = \(reserveToken \* 1000\) \+ amountInWithFee;
        uint128 amountOut = numerator / denominator;

        require\(amountOut >= minAmountOut, 105\);
        require\(amountOut < reserveShell, 106\);

        reserveToken \+= amountIn;
        reserveShell -= amountOut;

        emit Swap\(user, 0, amountIn, amountOut, 0\);

        mapping\(uint32 => varuint32\) payoutCurrencies;
        payoutCurrencies\[2\] = varuint32\(amountOut\);
        responseDestination.transfer\(\{value: varuint16\(0\), flag: 64, bounce: false, currencies: payoutCurrencies\}\);
    \}'''

    swap_token_new = '''    function _swapTokenForShell(uint128 amountIn, address user, uint128 minAmountOut, address responseDestination) private {
        // Protocol Fee: 0.05%
        uint128 protocolFee = (amountIn * 5) / 10000;
        uint128 amountInAfterProtocolFee = amountIn - protocolFee;

        // Pool Fee: 0.25%
        uint128 amountInWithPoolFee = amountInAfterProtocolFee * 9975;
        uint128 numerator = amountInWithPoolFee * reserveShell;
        uint128 denominator = (reserveToken * 10000) + amountInWithPoolFee;
        uint128 amountOut = numerator / denominator;

        require(amountOut >= minAmountOut, 105);
        require(amountOut < reserveShell, 106);

        reserveToken += amountInAfterProtocolFee;
        reserveShell -= amountOut;

        emit Swap(user, 0, amountIn, amountOut, 0);

        // Send Protocol Fee (Tokens) to feeRecipient
        TvmCell emptyPayload;
        IAFTWallet(tokenWallet).internalTransfer{value: 50000000, flag: 0}(
            0,
            protocolFee,
            address(this),
            _feeRecipient, // toOwner
            _feeRecipient, // excess
            0,
            emptyPayload
        );

        mapping(uint32 => varuint32) payoutCurrencies;
        payoutCurrencies[2] = varuint32(amountOut);
        responseDestination.transfer({value: varuint16(0), flag: 64, bounce: false, currencies: payoutCurrencies});
    }'''
    content = re.sub(swap_token_old, swap_token_new, content)

    with open('../contracts/amm/AckiSwapPair.sol', 'w') as f:
        f.write(content)

if __name__ == '__main__':
    update_pair()
