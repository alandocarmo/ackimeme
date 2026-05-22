import { Coin, Protocol, OnchainData } from './coin';
import { RiskProfile } from './risk';
import { TreasuryPayment } from './treasury';

export type LaunchStatus = 'pending' | 'deploying' | 'live' | 'failed' | 'graduated' | 'pending_deployer_configuration' | 'deploy_error' | 'awaiting_chain_integration' | string;

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

export interface Links {
  website?: string;
  xUrl?: string;
  telegramUrl?: string;
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

export interface LaunchTicket {
  id: string;
  status: string;
  mintingAvailable?: boolean;
  curatedByAdmin?: boolean;
  isPublic?: boolean;
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

// Unified Launch interface for the frontend/backend list
export interface Launch {
  id: string;
  coin: Coin;
  protocol?: Protocol;
  onchainData?: OnchainData;
  status: LaunchStatus;
  walletAddress: string;
  creatorWallet?: string;
  links?: Links;
  riskProfile?: RiskProfile;
  isBoosted?: boolean;
  createdAt?: string;
}
