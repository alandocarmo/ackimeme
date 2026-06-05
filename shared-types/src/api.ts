export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface VerifyPaymentPayload {
  walletAddress: string;
  txHash: string;
  tokenSymbol: string;
  isBoosted?: boolean;
}

export interface VerifiedPayment {
  success: boolean;
  txHash: string;
  walletAddress: string;
  payerWallet: string;
  tokenSymbol: string;
  amount: number | string;
  nanoAmount: string;
  feeWallet: string;
  minimumAmount: number | string;
  networkSettlementToken: string;
  networkSettlementStatus: string;
}

export interface CreateLaunchPayload {
  name: string;
  symbol: string;
  description: string;
  totalSupply: string;
  paymentTxHash: string;
  pumpForever: boolean;
  website?: string;
  twitter?: string;
  telegram?: string;
  isBoosted?: boolean;
  slopeDivisor?: number;
}

export interface GlobalStats {
  totalLaunches: number;
  totalVolume: number;
  totalTraders: number;
  activePairs: number;
}

export interface PriceCandle {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Anomaly {
  id: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  resolved: boolean;
}

export interface AppConfig {
  shellBuy?: {
    enabled: boolean;
    usdcRoot: string;
    usdcRecipient: string;
    usdcDecimals: number;
  };
  payment?: {
    feeWallet: string;
    creationFees: Array<{ tokenSymbol: string; minimumAmount: number }>;
    blockchainFee: { tokenSymbol: string; minimumCreatorBalance: number };
  };
}
