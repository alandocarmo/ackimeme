import { randomUUID } from "crypto";

interface CreateInitialRiskProfileParams {
  launchRequest: {
    creator: {
      wallet: string;
    };
    coin: {
      name?: string;
      description?: string;
      totalSupply?: string;
    };
    links: {
      website?: string;
      telegramUrl?: string;
    };
  };
  session?: {
    proofLevel?: string;
    telegramBinding?: {
      userId?: string;
    };
  };
}

interface RiskProfile {
  id: string;
  launchId: string;
  creatorWallet: string;
  score: number;
  status: "manual_review" | "watch";
  signals: string[];
  createdAt: string;
}

export function createInitialRiskProfile({
  launchRequest,
  session,
}: CreateInitialRiskProfileParams): RiskProfile {
  const signals: string[] = [];
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

  if (!launchRequest.links?.website && !launchRequest.links?.telegramUrl) {
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

  // L-06: Use BigInt for supply comparison to avoid precision loss above 2^53
  const supplyStr = String(launchRequest.coin?.totalSupply || "0").replace(/\D/g, "") || "0";
  const supplyBig = BigInt(supplyStr);
  if (supplyBig > 900_000_000_000n) {
    score += 20;
    signals.push("supply_suspiciously_high");
  } else if (supplyBig > 0n && supplyBig < 100n) {
    score += 5;
    signals.push("supply_very_low");
  }

  return {
    id: randomUUID(),
    launchId: "",
    creatorWallet: launchRequest.creator?.wallet || "",
    score,
    status: score >= 50 ? "manual_review" : "watch",
    signals,
    createdAt: new Date().toISOString(),
  };
}
