export interface Trade {
  id: string;
  launchId?: string;
  type: 'buy' | 'sell' | string;
  walletAddress: string;
  tokenAmount: string | number;
  shellAmount: string | number;
  price?: number;
  txHash?: string;
  timestamp?: string;
  createdAt?: string;
}

export interface Holding {
  launch: any; // We'll replace with Launch later or use it as is if needed
  balance: string | number;
  value?: number;
}

export interface Holder {
  walletAddress: string;
  balance: number;
  isBondingCurve?: boolean;
}
