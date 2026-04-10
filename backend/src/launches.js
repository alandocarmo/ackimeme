const { randomUUID } = require("crypto");
const { config } = require("./config");
const { getCreationFeeRequirement, normalizeTokenSymbol } = require("./treasury");

const MAX_NAME_LENGTH = 32;
const MAX_SYMBOL_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 280;
const MAX_SUPPLY_DIGITS = 18;
const MAX_TAGLINE_LENGTH = 72;

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requireText(value, fieldName, options = {}) {
  const text = trimString(value);
  const minLength = options.minLength || 1;
  const maxLength = options.maxLength || Number.POSITIVE_INFINITY;

  if (!text) {
    throw new Error(`${fieldName} é obrigatório.`);
  }

  if (text.length < minLength) {
    throw new Error(
      `${fieldName} precisa ter pelo menos ${minLength} caracteres.`,
    );
  }

  if (text.length > maxLength) {
    throw new Error(
      `${fieldName} precisa ter no máximo ${maxLength} caracteres.`,
    );
  }

  return text;
}

function normalizeSymbol(value) {
  const sanitized = requireText(value, "Ticker", {
    minLength: 2,
    maxLength: MAX_SYMBOL_LENGTH * 2,
  })
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (sanitized.length < 2) {
    throw new Error("Ticker precisa ter ao menos 2 letras ou números.");
  }

  if (sanitized.length > MAX_SYMBOL_LENGTH) {
    throw new Error(
      `Ticker precisa ter no máximo ${MAX_SYMBOL_LENGTH} caracteres.`,
    );
  }

  return sanitized;
}

function normalizeSupply(value) {
  const digits = String(value ?? "")
    .trim()
    .replace(/[.,]/g, "");

  if (!/^\d+$/.test(digits)) {
    throw new Error("Supply precisa ser um número inteiro positivo.");
  }

  if (digits === "0") {
    throw new Error("Supply precisa ser maior que zero.");
  }

  if (digits.length > MAX_SUPPLY_DIGITS) {
    throw new Error("Supply ultrapassa o limite suportado.");
  }

  return digits;
}

function normalizeOptionalUrl(value, fieldName) {
  const url = trimString(value);

  if (!url) {
    return "";
  }

  try {
    return new URL(url).toString();
  } catch (error) {
    throw new Error(`${fieldName} precisa ser uma URL válida.`);
  }
}

function normalizeLaunchRequest(body = {}, session = null) {
  const creatorWallet = requireText(
    body.creatorWallet || session?.walletAddress,
    "Wallet do criador",
    {
      minLength: 6,
      maxLength: 128,
    },
  );

  if (session?.walletAddress && creatorWallet !== session.walletAddress) {
    throw new Error("Wallet do criador diverge da sessão autenticada.");
  }

  const tokenSymbol = normalizeTokenSymbol(body.paymentTokenSymbol);
  const feeRequirement = getCreationFeeRequirement(tokenSymbol);

  return {
    creator: {
      wallet: creatorWallet,
      sessionId: session?.id || "",
      telegramUserId: session?.telegramBinding?.userId || "",
    },
    payment: {
      txHash: requireText(body.txHash, "Tx hash", {
        minLength: 6,
        maxLength: 180,
      }),
      tokenSymbol: feeRequirement.tokenSymbol,
      requiredAmount: feeRequirement.minimumAmount,
      networkSettlementToken: feeRequirement.networkSettlementToken,
      networkSettlementStatus: feeRequirement.networkSettlementStatus,
    },
    protocol: {
      distribution: {
        type: config.launchDistribution.type,
        fairLaunch: config.launchDistribution.fairLaunch,
      },
      treasury: {
        appFeeSharePercent: config.appFeeSharePercent,
        feeWallet: config.feeWallet,
      },
      launchMode: "bonding_curve_pending",
      bondingCurveStatus: "not_implemented",
      poolAutomationStatus: "not_implemented",
    },
    coin: {
      name: requireText(body.name, "Nome do token", {
        minLength: 2,
        maxLength: MAX_NAME_LENGTH,
      }),
      symbol: normalizeSymbol(body.symbol),
      tagline: trimString(body.tagline).slice(0, MAX_TAGLINE_LENGTH),
      description: requireText(body.description, "Descrição", {
        minLength: 20,
        maxLength: MAX_DESCRIPTION_LENGTH,
      }),
      totalSupply: normalizeSupply(body.totalSupply),
      logoUrl: normalizeOptionalUrl(body.logoUrl, "Logo URL"),
    },
    links: {
      website: normalizeOptionalUrl(body.website, "Website"),
      xUrl: normalizeOptionalUrl(body.xUrl, "X"),
      telegramUrl: normalizeOptionalUrl(body.telegramUrl, "Telegram"),
    },
    context: {
      app: config.appName,
      network: config.network,
      submittedAt: new Date().toISOString(),
    },
  };
}

function createLaunchTicket({ launchRequest, treasuryPayment, riskProfile }) {
  const launchId = randomUUID();

  return {
    id: launchId,
    status: "payment_verified_waiting_blockchain_integration",
    mintingAvailable: false,
    note: "Pagamento verificado. Falta conectar o mint on-chain da Acki Nacki no backend.",
    launchRequest,
    treasuryPayment,
    riskProfile: {
      ...riskProfile,
      launchId,
    },
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  createLaunchTicket,
  normalizeLaunchRequest,
};
