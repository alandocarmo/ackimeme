// SPDX-License-Identifier: MIT
pragma tvm-solidity >= 0.76.1;

interface IAFTExcesses {
    function onAFTExcesses(
        uint64 queryId
    ) external functionID(0xd53276db);
}
