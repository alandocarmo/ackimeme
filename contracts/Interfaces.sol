pragma tvm-solidity >= 0.76.1;

// ─── Shared Interfaces ──────────────────────────────────────────────────────
// All cross-contract interfaces in one file to avoid duplicate declarations
// when contracts import each other.

interface ITokenRoot {
    function mint(uint32 mintNonce, address recipient, uint256 amount, uint128 deployWalletValue) external;
    function onMintDelivered(uint32 mintNonce) external;
    function transferFromWallet(uint32 walletSeqno, address fromOwner, address recipientOwner, uint256 amount) external;
    function onTransferDelivered(uint32 transferNonce) external;
    function notifyBurn(uint32 seqno, uint256 amount, address refundAddress, address callbackTarget, uint128 minShellOut) external;
}

interface ITokenWallet {
    function receiveTokens(uint32 nonce, uint256 amount) external;
    function receiveTransfer(uint32 nonce, uint256 amount) external;
    function onTransferDelivered(uint32 seqno) external;
    function onTransferFailed(uint32 seqno) external;
    function onBurnFailed(uint32 seqno) external;
}

interface IBondingCurve {
    function onTokenBurned(uint32 burnNonce, uint256 amount, address refundAddress, uint128 minShellOut) external;
    function onMintSuccess(uint32 mintNonce) external;
    function onMintFailed(uint32 mintNonce) external;
}

// ─── I-06: Shared gas constants ──────────────────────────────────────────────
// Extracted from BondingCurve, TokenRoot, and TokenWallet to avoid duplication.
// Contracts can reference these via GasConstants.GAS_TOP_UP etc.
// NOTE: TVM-Solidity libraries with constants are inlined at compile time,
// so there is no extra deployment cost or cross-contract call overhead.
library GasConstants {
    uint64 constant GAS_TOP_UP = 2_000_000_000;        // 2 VMSHELL in nano
    uint128 constant MIN_EXECUTION_GAS = 1 ton;         // 1 VMSHELL threshold
}
