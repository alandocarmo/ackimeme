/**
 * ABI definitions for on-chain contract interaction.
 *
 * A-06: Updated to ABI version 2.3 with "pubkey" header to match
 * contracts compiled with pragma AbiHeader pubkey (tvm-solidity >= 0.76.1).
 *
 * BondingCurve: buy/sell/getters — used in the trade widget
 * TokenWallet:  burn — used for the sell flow (burn tokens via TokenWallet)
 * TokenRoot:    getWalletAddress — used to resolve user's TokenWallet address
 */

import BondingCurveAbi from './BondingCurve.abi.json';
import TokenWalletAbi from './TokenWallet.abi.json';
import TokenRootAbi from './TokenRoot.abi.json';
import USDCShellRouterAbi from './USDCShellRouter.abi.json';

export { BondingCurveAbi, TokenWalletAbi, TokenRootAbi, USDCShellRouterAbi };
