// SPDX-License-Identifier: MIT
pragma tvm-solidity >= 0.76.1;

abstract contract Errors {
    string constant versionErrors = "1.0.0";

    uint16 constant ERR_NOT_ADMIN = 101;
    uint16 constant ERR_NOT_PENDING_ADMIN = 102;
    uint16 constant ERR_INVALID_SENDER = 103;
    uint16 constant ERR_LOW_BALANCE = 104;
    uint16 constant ERR_MINT_DISABLED = 105;
    uint16 constant ERR_WRONG_WALLET = 106;
    uint16 constant ERR_TOO_BIG_DECIMALS = 107;
    uint16 constant ERR_ZERO_AMOUNT = 108;
    uint16 constant ERR_INSUFFICIENT_FUEL = 109;
    uint16 constant ERR_DUPLICATE_QUERY = 110;

    uint16 constant ERR_EXPIRE_TOO_FAR = 222;      // expireAt beyond MAX_EXPIRE_HORIZON
    uint16 constant ERR_NO_FWD_PRICES = 223;       // config param 25/21 absent
}
