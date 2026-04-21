pragma tvm-solidity >= 0.76.1;

// ─── Shared Interfaces ──────────────────────────────────────────────────────
// All cross-contract interfaces in one file to avoid duplicate declarations
// when contracts import each other.

interface ITokenRoot {
    function mint(uint32 mintNonce, address recipient, uint256 amount, uint128 deployWalletValue) external;
    function notifyBurn(uint256 amount, address refundAddress, address callbackTarget) external;
}

interface ITokenWallet {
    function receiveTokens(uint32 nonce, uint256 amount) external;
}

interface IBondingCurve {
    function onTokenBurned(uint256 amount, address refundAddress) external;
}

interface IDexPool {
    function addLiquidity(uint128 shellAmount, uint128 tokenAmount) external;
}
