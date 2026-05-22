export interface Session {
  walletAddress: string;
}

export interface Coin {
  name: string;
  symbol: string;
  description?: string;
  logoUrl?: string;
  tagline?: string;
  totalSupply: string | number;
}

export interface Protocol {
  slopeDivisor: number;
  pumpForever: boolean;
  isBoosted?: boolean;
}

export interface OnchainData {
  bondingCurveAddress?: string;
  tokenRootAddress?: string;
  deployStatus?: 'deployed' | 'pending' | 'pending_deployer_configuration' | 'failed' | string;
  tokenSupply?: string | number;
  ipfsHash?: string;
  reserveBalance?: string | number;
  lockedLiquidity?: string | number;
  updatedAt?: string;
}

export interface Launch {
  id: string;
  coin: Coin;
  protocol?: Protocol;
  onchainData?: OnchainData;
  status: string;
  walletAddress: string;
  links?: {
    website?: string;
    xUrl?: string;
    telegramUrl?: string;
  };
  riskProfile?: {
    score: number;
    status: string;
  };
  isBoosted?: boolean;
  creatorWallet?: string;
  createdAt?: string;
}

export interface Trade {
  id: string;
  type: 'buy' | 'sell';
  walletAddress: string;
  tokenAmount: string | number;
  shellAmount: string | number;
  timestamp?: string;
  createdAt?: string;
}

export interface CommentType {
  id: string;
  walletAddress: string;
  content: string;
  createdAt: string;
}

export interface Holder {
  walletAddress: string;
  balance: number;
  isBondingCurve?: boolean;
}

export interface ShellBuyConfig {
  enabled: boolean;
  usdcRoot: string;
  usdcRecipient: string;
  usdcDecimals: number;
}

export interface AppConfig {
  shellBuy?: ShellBuyConfig;
}
