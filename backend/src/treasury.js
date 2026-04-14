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

  const normalizedToken = normalizeTokenSymbol(tokenSymbol);
  const option = config.creationFeeOptions.find(
    (item) => item.tokenSymbol === normalizedToken,
  );

  if (!option) {
    throw new Error("Token de taxa não suportado.");
  }

  return {
    ...option,
    feeWallet: config.feeWallet,
    appFeeSharePercent: config.appFeeSharePercent,
    networkSettlementToken: "VMSHELL",
    networkSettlementStatus:
      option.tokenSymbol === "SHELL"
        ? "can_be_converted_to_vm_shell"
        : "requires_vm_shell_treasury_buffer",
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
