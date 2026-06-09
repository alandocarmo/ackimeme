// SPDX-License-Identifier: MIT
pragma tvm-solidity >= 0.76.1;

interface IAFTReceiver {
    function onAFTTransfer(
        uint64 queryId,
        uint128 amount,
        address sender,
        TvmCell forwardPayload
    ) external functionID(0x7362d09c);
}
