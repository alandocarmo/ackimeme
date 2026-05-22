export interface RiskProfile {
  id?: string;
  status: string;
  score: number;
  launchId?: string;
  creatorWallet?: string;
  signals?: any;
  createdAt?: string;
}
