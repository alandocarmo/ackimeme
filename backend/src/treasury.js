const { randomUUID } = require("crypto");
const { config } = require("./config");

function normalizeTokenSymbol(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getCreationFeeRequirement(tokenSymbol) {
  if (!config.feeWalletConfigured) {
    throw new Error("FEE_WALLET não configurada corretamente no backend.");
  }

  const normalizedToken = normalizeTokenSymbol(tokenSymbol || "SHELL");

  // SHELL-only: all creation fees are paid in the native SHELL token
  const option = config.creationFeeOptions.find(
    (item) => item.tokenSymbol === normalizedToken,
  );

  if (!option) {
    throw new Error(
      `Token de taxa "${normalizedToken}" não suportado. Use SHELL para pagar a taxa de criação.`,
    );
  }

  return {
    ...option,
    feeWallet: config.feeWallet,
    appFeeSharePercent: config.appFeeSharePercent,
    // SHELL is the native token — no secondary settlement needed
    networkSettlementToken: "SHELL",
    networkSettlementStatus: "native_shell_direct",
  };
}

function createTreasuryPaymentRecord({
  creatorWallet,
  txHash,
  tokenSymbol,
  amount,
}) {
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

module.exports = {
  createTreasuryPaymentRecord,
  getCreationFeeRequirement,
  normalizeTokenSymbol,
};
