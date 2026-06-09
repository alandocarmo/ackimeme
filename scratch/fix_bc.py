import re

def fix_bc():
    with open('../contracts/BondingCurve.sol', 'r') as f:
        content = f.read()

    # 1. Remove duplicate declarations at line 101/102
    content = re.sub(r'    address public factoryAddress;\n    address public ammPairAddress;\n', '', content)

    # 2. Fix getBuyPrice (remove AMM logic entirely)
    # The AMM logic is inside `if (isAmm) { ... }` block. We already revert in `buy()` and `sell()` if `isAmm`.
    # For `getBuyPrice` and `getSellReturn`, if `isAmm` is true, we should revert or return 0.
    
    getBuyPrice_old = r'''    function getBuyPrice\(uint256 tokenAmount\) public view returns \(uint128\) \{
        if \(isAmm\) \{
            uint256 tokenPool = _supplyCap - totalSupply;
            require\(ammKLast > 0, 219, "AMM invariant is zero - pool corrupted"\);
            require\(tokenPool > tokenAmount \+ 1, 215, "Not enough AMM liquidity"\);
            uint256 newReserve = ammKLast / \(tokenPool - tokenAmount\);
            return uint128\(newReserve - reserveBalance\);
        \}'''
    
    getBuyPrice_new = '''    function getBuyPrice(uint256 tokenAmount) public view returns (uint128) {
        require(!isAmm, 250, "Trading ended");'''
    content = re.sub(getBuyPrice_old, getBuyPrice_new, content)

    getSellReturn_old = r'''    function getSellReturn\(uint256 tokenAmount\) public view returns \(uint128\) \{
        if \(totalSupply == 0 \|\| tokenAmount > totalSupply\) return 0;
        if \(isAmm\) \{
            uint256 tokenPool = _supplyCap - totalSupply;
            require\(ammKLast > 0, 219, "AMM invariant is zero - pool corrupted"\);
            require\(tokenPool > tokenAmount \+ 1, 215, "Not enough AMM liquidity"\);
            uint256 newReserve = ammKLast / \(tokenPool \+ tokenAmount\);
            // C-02: Prevent underflow when sell amount is too large for current reserve
            require\(reserveBalance >= newReserve, 220, "Sell too large for current reserve"\);
            return uint128\(reserveBalance - newReserve\);
        \}'''
    
    getSellReturn_new = '''    function getSellReturn(uint256 tokenAmount) public view returns (uint128) {
        if (totalSupply == 0 || tokenAmount > totalSupply) return 0;
        require(!isAmm, 250, "Trading ended");'''
    content = re.sub(getSellReturn_old, getSellReturn_new, content)

    # 3. Remove ammKLast in _applyFees
    applyFees_old = r'''        if \(isAmm\) \{
            ammKLast = reserveBalance \* \(_supplyCap - totalSupply\);
        \}'''
    content = re.sub(applyFees_old, '', content)

    # 4. Remove ammKLast in _migrateToAmm (already removed manually but we had old ones?)
    # Wait, the error log says "ammKLast = reserveBalance * tokenPool" at 543. Let's see what's there.
    # Actually, let's just replace all occurrences of `ammKLast = .*?;\n` with empty string.
    content = re.sub(r'\s*ammKLast = .*?;', '', content)
    content = re.sub(r'\s*uint256 public ammKLast;.*?\n', '', content)

    with open('../contracts/BondingCurve.sol', 'w') as f:
        f.write(content)

if __name__ == '__main__':
    fix_bc()
