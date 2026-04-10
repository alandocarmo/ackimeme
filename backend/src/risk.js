const { randomUUID } = require("crypto");

function createInitialRiskProfile({ launchRequest, session }) {
  const signals = [];
  let score = 20;

  if (!session?.telegramBinding?.userId) {
    score += 15;
    signals.push("telegram_binding_missing");
  }

  if (
    session?.proofLevel === "signature_only_until_wallet_contract_binding"
  ) {
    score += 20;
    signals.push("wallet_contract_binding_pending");
  }

  if (launchRequest.payment.tokenSymbol === "USDC") {
    score += 5;
    signals.push("requires_vm_shell_treasury_buffer");
  }

  if (!launchRequest.links.website && !launchRequest.links.telegramUrl) {
    score += 10;
    signals.push("limited_social_footprint");
  }

  return {
    id: randomUUID(),
    launchId: "",
    creatorWallet: launchRequest.creator.wallet,
    score,
    status: score >= 50 ? "manual_review" : "watch",
    signals,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  createInitialRiskProfile,
};
