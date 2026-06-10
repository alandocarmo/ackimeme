pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

/// @title DappConfig
/// @notice Manages centralized gas replenishment for the Dapp ID ecosystem.
contract DappConfig {
    uint128 public constant REPLENISH_THRESHOLD = 5 ton;
    uint128 public constant REPLENISH_AMOUNT = 10 ton;

    constructor() {
        tvm.accept();
    }

    /// @notice Called by the Acki Nacki network to replenish contracts under this Dapp ID
    function getTokens(address target) external view {
        tvm.accept();
        // Replenishes the target's execution gas (VMSHELL) up to the amount.
        // This is funded silently by the DappConfig's own VMSHELL balance.
        gosh.mintshell(uint64(REPLENISH_AMOUNT));
        target.transfer({ value: varuint16(REPLENISH_AMOUNT), flag: 0, bounce: false });
    }
}
