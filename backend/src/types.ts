export interface Creator {
  wallet: string;
}

export interface Payment {
  txHash: string;
  tokenSymbol: string;
  requiredAmount?: number;
  networkSettlementToken?: string;
  networkSettlementStatus?: string;
}

export interface Coin {
  name: string;
  symbol: string;
  tagline?: string;
  description: string;
  totalSupply: string;
  logoUrl?: string;
}

export interface Links {
  website?: string;
  xUrl?: string;
  telegramUrl?: string;
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

export interface LaunchRequest {
  creator: Creator;
  payment: Payment;
  protocol: Protocol;
  coin: Coin;
  links?: Links;
  context?: {
    app: string;
    network: string;
    submittedAt: string;
  };
}

export interface TreasuryPayment {
  tokenSymbol: string;
  amount: string;
}

export interface RiskProfile {
  status: string;
  score: number;
  launchId?: string;
}

export interface OnchainData {
  ipfsHash?: string;
  tokenRootAddress?: string;
  bondingCurveAddress?: string;
  deployStatus?: string;
  deployReason?: string;
  reserveBalance?: string;
  tokenSupply?: string;
  lockedLiquidity?: boolean;
  updatedAt?: string;
}

export interface LaunchTicket {
  id: string;
  status: string;
  mintingAvailable?: boolean;
  note?: string;
  launchRequest: LaunchRequest;
  treasuryPayment: TreasuryPayment;
  riskProfile: RiskProfile;
  createdAt: string;
  ipfsHash?: string;
  tokenRootAddress?: string;
  bondingCurveAddress?: string;
  onchainData?: OnchainData;
}

export interface Session {
  token: string;
  walletAddress: string;
  createdAt?: string;
  expiresAt?: string;
}

export interface Trade {
  id: string;
  launchId: string;
  txHash: string;
  walletAddress: string;
  type: string;
  tokenAmount: string;
  shellAmount: string;
  price: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  launchId: string;
  walletAddress: string;
  content: string;
  createdAt: string;
}
