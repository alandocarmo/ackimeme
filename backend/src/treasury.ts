import { randomUUID } from "crypto";
import { config } from "./config";

export function normalizeTokenSymbol(value: any): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

interface CreationFeeRequirement {
  tokenSymbol: string;
  minimumAmount: number;
  feeWallet: string;
  appFeeSharePercent: number;
  networkSettlementToken: string;
  networkSettlementStatus: string;
}

export function getCreationFeeRequirement(tokenSymbol: any): CreationFeeRequirement {
  if (!config.feeWalletConfigured) {
    throw new Error("FEE_WALLET não configurada corretamente no backend.");
  }

  const normalizedToken = normalizeTokenSymbol(tokenSymbol || "SHELL");

  // SHELL-only: all creation fees are paid in the native SHELL token
  const option = config.creationFeeOptions.find(
    (item: any) => item.tokenSymbol === normalizedToken,
  );

  if (!option) {
    throw new Error(
      `Token de taxa "${normalizedToken}" não suportado. Use SHELL para pagar a taxa de criação.`,
    );
  }

  return {
    tokenSymbol: option.tokenSymbol,
    minimumAmount: option.minimumAmount,
    feeWallet: config.feeWallet,
    appFeeSharePercent: config.appFeeSharePercent,
    // SHELL is the native token — no secondary settlement needed
    networkSettlementToken: "SHELL",
    networkSettlementStatus: "native_shell_direct",
  };
}

interface CreateTreasuryPaymentRecordParams {
  creatorWallet: string;
  txHash: string;
  tokenSymbol: string;
  amount: any;
}

interface TreasuryPaymentRecord {
  id: string;
  creatorWallet: string;
  txHash: string;
  tokenSymbol: string;
  amount: any;
  feeWallet: string;
  appFeeSharePercent: number;
  networkSettlementToken: string;
  networkSettlementStatus: string;
  recordedAt: string;
}

export function createTreasuryPaymentRecord({
  creatorWallet,
  txHash,
  tokenSymbol,
  amount,
}: CreateTreasuryPaymentRecordParams): TreasuryPaymentRecord {
  const requirement = getCreationFeeRequirement(tokenSymbol);

  return {
    id: randomUUID(),
    creatorWallet,
    txHash,
    tokenSymbol: requirement.tokenSymbol,
    amount,
    feeWallet: requirement.feeWallet,
    appFeeSharePercent: requirement.appFeeSharePercent,
    networkSettlementToken: requirement.networkSettlementToken,
    networkSettlementStatus: requirement.networkSettlementStatus,
    recordedAt: new Date().toISOString(),
  };
}
