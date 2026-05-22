export interface TreasuryPayment {
    id?: string;
    creatorWallet?: string;
    txHash?: string;
    tokenSymbol: string;
    amount: string;
    feeWallet?: string;
    appFeeSharePercent?: number;
    networkSettlementToken?: string;
    networkSettlementStatus?: string;
    recordedAt?: string;
}
export interface CreationFeeRequirement {
    minimumAmount: string;
    feeWallet: string;
}
