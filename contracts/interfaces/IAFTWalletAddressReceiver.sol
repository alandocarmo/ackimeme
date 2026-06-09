// SPDX-License-Identifier: MIT
pragma tvm-solidity >= 0.76.1;

interface IAFTWalletAddressReceiver {
    function takeWalletAddress(
        uint64 queryId,
        address walletAddress,
        optional(address) ownerAddress
    ) external functionID(0xd1735400);
}
