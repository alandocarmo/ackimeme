export interface Coin {
    name: string;
    symbol: string;
    description?: string;
    logoUrl?: string;
    tagline?: string;
    totalSupply: string | number;
}
export interface Protocol {
    distribution?: {
        type: string;
        fairLaunch: boolean;
    };
    treasury?: {
        appFeeSharePercent: number;
        feeWallet: string;
        feeTokenSymbol: string;
    };
    blockchainFee?: {
        tokenSymbol: string;
        minimumCreatorBalance: number;
    };
    launchMode?: string;
    bondingCurveStatus?: string;
    poolAutomationStatus?: string;
    pumpForever?: boolean;
    isBoosted?: boolean;
    slopeDivisor?: number;
}
export interface OnchainData {
    bondingCurveAddress?: string;
    tokenRootAddress?: string;
    deployStatus?: 'deployed' | 'pending' | 'pending_deployer_configuration' | 'failed' | string;
    deployReason?: string;
    tokenSupply?: string | number;
    ipfsHash?: string;
    reserveBalance?: string | number;
    lockedLiquidity?: string | number | boolean;
    updatedAt?: string;
}
