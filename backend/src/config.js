const DEFAULT_APP_NAME = "AckiMeme";
const DEFAULT_NETWORK = "Acki Nacki";
const DEFAULT_SHELL_MIN_PAYMENT = 3; // ~$3 USD equivalent in SHELL for token creation
const DEFAULT_SHELL_DECIMALS = 9;    // SHELL uses 9 decimals (nano)
const DEFAULT_MIN_CREATOR_SHELL_BALANCE = 1;
const DEFAULT_AUTH_CHALLENGE_TTL_SECONDS = 5 * 60;
const DEFAULT_SESSION_TTL_HOURS = 24;
const DEFAULT_TELEGRAM_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;
const DEFAULT_DATABASE_URL = "";

function readPositiveNumber(value, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function readCsv(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPlaceholderValue(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    normalized === "change_me" ||
    normalized.includes("placeholder") ||
    normalized.includes("your_") ||
    normalized.includes("example") ||
    normalized.includes("acki_fee_wallet_here") ||
    normalized.includes("configure")
  );
}

function isConfiguredWallet(value) {
  const normalized = String(value || "").trim();

  if (!normalized || isPlaceholderValue(normalized)) {
    return false;
  }

  // Keep local dev wallet support explicit while requiring a real wallet in prod.
  return normalized === "dev-wallet-local" || /^0:[0-9a-f]{64}$/i.test(normalized);
}

function isStrongSecret(value, minimumLength = 32) {
  const normalized = String(value || "").trim();

  if (!normalized || isPlaceholderValue(normalized)) {
    return false;
  }

  return normalized.length >= minimumLength;
}

function readCreationFeeOptions() {
  return [
    {
      tokenSymbol: "SHELL",
      minimumAmount: readPositiveNumber(
        process.env.CREATION_FEE_SHELL,
        DEFAULT_SHELL_MIN_PAYMENT,
      ),
      decimals: DEFAULT_SHELL_DECIMALS,
    },
  ];
}

const creationFeeOptions = readCreationFeeOptions();
const feeWallet = process.env.FEE_WALLET || "";
const adminToken = process.env.ADMIN_TOKEN || "";
const jwtSecret = process.env.JWT_SECRET || "";
const isProduction = process.env.NODE_ENV === "production";

const config = {
  port: readPositiveNumber(process.env.PORT, 3000),
  appName: process.env.APP_NAME || DEFAULT_APP_NAME,
  network: process.env.APP_NETWORK || DEFAULT_NETWORK,
  isProduction,
  databaseUrl: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === "true",
  graphqlUrl: process.env.GRAPHQL_URL || "",
  feeWallet,
  feeWalletConfigured: isConfiguredWallet(feeWallet),
  allowedOrigins: readCsv(process.env.ALLOWED_ORIGINS),
  creationFeeOptions,
  minCreatorShellBalance: readPositiveNumber(
    process.env.MIN_CREATOR_SHELL_BALANCE,
    DEFAULT_MIN_CREATOR_SHELL_BALANCE,
  ),
  authChallengeTtlSeconds: readPositiveNumber(
    process.env.AUTH_CHALLENGE_TTL_SECONDS,
    DEFAULT_AUTH_CHALLENGE_TTL_SECONDS,
  ),
  sessionTtlHours: readPositiveNumber(
    process.env.SESSION_TTL_HOURS,
    DEFAULT_SESSION_TTL_HOURS,
  ),
  telegramBotToken:
    process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "",
  telegramAuthMaxAgeSeconds: readPositiveNumber(
    process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS,
    DEFAULT_TELEGRAM_AUTH_MAX_AGE_SECONDS,
  ),
  adminToken,
  adminTokenStrong: isStrongSecret(adminToken, 32),
  jwtSecret,
  jwtSecretConfigured: isStrongSecret(jwtSecret, 32) && jwtSecret !== adminToken,
  adminWallets: readCsv(process.env.ADMIN_WALLETS).map((item) => item.toLowerCase()),
  appFeeSharePercent: 100,
  launchDistribution: {
    type: "pump_fun_bonding_curve",
    fairLaunch: true,
  },
};

function buildPublicConfig() {
  return {
    appName: config.appName,
    network: config.network,
    payment: {
      feeWallet: config.feeWalletConfigured ? config.feeWallet : "Configure backend/.env",
      creationFees: config.creationFeeOptions,
      appFeeSharePercent: config.appFeeSharePercent,
      // SHELL is the only fee token — it is also the native blockchain gas token
      feeTokenSymbol: "SHELL",
      blockchainFee: {
        tokenSymbol: "SHELL",
        minimumCreatorBalance: config.minCreatorShellBalance,
        note: "The creation fee (~$3 in SHELL) plus blockchain gas fees are both paid in SHELL.",
      },
    },
    auth: {
      challengeTtlSeconds: config.authChallengeTtlSeconds,
      walletProofMode: "signature_challenge",
      telegramBindingRequired: Boolean(config.telegramBotToken),
    },
    storage: {
      provider: "postgres",
    },
    launch: {
      mintingMode: "manual-review",
      symbolMaxLength: 10,
      nameMaxLength: 32,
      descriptionMaxLength: 280,
      distribution: config.launchDistribution,
    },
    admin: {
      authMode: config.adminWallets.length > 0 ? "wallet_or_token" : "token_only",
    },
  };
}

function validateConfig() {
  const errors = [];

  if (isProduction) {
    if (!config.feeWalletConfigured) {
      errors.push("FEE_WALLET não está configurada corretamente (requer formato 0:abc...)");
    }
    if (!config.adminTokenStrong) {
      errors.push("ADMIN_TOKEN precisa ter pelo menos 32 caracteres em produção.");
    }
    if (!config.jwtSecretConfigured) {
      errors.push("JWT_SECRET precisa ser forte (32+ caracteres) e diferente do ADMIN_TOKEN em produção.");
    }
    if (!config.databaseUrl) {
      errors.push("DATABASE_URL é obrigatória em produção.");
    }
    if (!process.env.DEPLOYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY.length !== 64) {
      errors.push("DEPLOYER_PRIVATE_KEY inválida ou ausente (necessário para deploys on-chain).");
    }
    if (process.env.ENABLE_ONCHAIN_DEPLOY !== "true") {
      errors.push("ENABLE_ONCHAIN_DEPLOY deve ser 'true' na produção (sem simulações).");
    }
    if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_API_KEY) {
      errors.push("PINATA_API_KEY/SECRET_API_KEY ausentes (necessário para IPFS).");
    }
    if (config.graphqlUrl.includes("shellnet") && !config.graphqlUrl.includes("mainnet")) {
      errors.push("GRAPHQL_URL aponta para testnet (shellnet) em ambiente de produção. Use o endpoint mainnet.");
    }
  }

  if (errors.length > 0) {
    console.error("\n❌ ERRO DE CONFIGURAÇÃO CRÍTICO:");
    errors.forEach((e) => console.error(`   - ${e}`));
    console.error("\nA aplicação não pode iniciar sem estas correções no .env\n");
    process.exit(1);
  }

  console.log("✅ Configuração validada com sucesso.");
}

module.exports = {
  buildPublicConfig,
  config,
  validateConfig,
};
