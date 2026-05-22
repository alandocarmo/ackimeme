export interface BondingCurveDeployParams {
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  initialSupply: string;
}

export interface BondingCurveOutput {
  currentPrice: string;
  totalSupply: string;
  reserveBalance: string;
}
