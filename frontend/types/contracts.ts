import { Address } from "everscale-inpage-provider";

export interface TransactionResult {
  transaction: {
    id: { hash: string };
    aborted: boolean;
    compute: { exitCode: number };
  };
}

export interface BondingCurveMethods {
  getBuyPrice(args: { tokenAmount: string }): { call(): Promise<{ value0: string }> };
  getSellReturn(args: { tokenAmount: string }): { call(): Promise<{ value0: string }> };
  getTradeFeeBps(args: {}): { call(): Promise<{ value0: string }> };
  buy(args: { tokenAmount: string; maxShellIn: string }): { send(args: { from: Address; amount: string; bounce: boolean; currencies?: any }): Promise<TransactionResult> };
}

export interface TokenRootMethods {
  getWalletAddress(args: { ownerAddress: Address }): { call(): Promise<{ walletAddress: Address }> };
}

export interface TokenWalletMethods {
  getDetails(args: {}): { call(): Promise<{ balance: string; owner: Address; root: Address }> };
  transfer(args: { queryId: string; amount: string; destinationOwner: Address; responseDestination: Address; customPayload: string | null; forwardShellAmount: string; forwardPayload: any }): { send(args: { from: Address; amount: string; bounce: boolean; currencies?: any }): Promise<TransactionResult> };
}

export interface TypedContract<T> {
  methods: T;
  address: Address;
}
