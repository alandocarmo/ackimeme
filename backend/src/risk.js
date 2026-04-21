const { randomUUID } = require("crypto");

function createInitialRiskProfile({ launchRequest, session }) {
  const signals = [];
  let score = 30; // L-04: Increased base score to +30 for new untrusted networks

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

  if (!launchRequest.links.website && !launchRequest.links.telegramUrl) {
    score += 10;
    signals.push("limited_social_footprint");
  }

  // ── Sinais dinâmicos adicionais ───────────────────────────────────────────

  // Nomes genéricos ou suspeitamente curtos
  const name = String(launchRequest.coin?.name || "").trim();
  if (name.length <= 2) {
    score += 10;
    signals.push("name_suspiciously_short");
  }

  // Descrição ausente ou muito curta
  const desc = String(launchRequest.coin?.description || "").trim();
  if (desc.length < 10) {
    score += 5;
    signals.push("description_minimal");
  }

  // Supply muito alto ou muito baixo (fora do range razoável)
  const supply = Number(String(launchRequest.coin?.totalSupply || "0").replace(/\D/g, ""));
  if (supply > 0 && supply < 1000) {
    score += 10;
    signals.push("supply_suspiciously_low");
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
