const DEFAULT_APP_NAME = "AckiMeme";
const DEFAULT_NETWORK = "Acki Nacki";
const DEFAULT_USDC_MIN_PAYMENT = 3; // $3 USDC flat fee for token creation
const DEFAULT_USDC_DECIMALS = 6;
const DEFAULT_MIN_CREATOR_SHELL_BALANCE = 1;
const DEFAULT_AUTH_CHALLENGE_TTL_SECONDS = 5 * 60;
const DEFAULT_SESSION_TTL_HOURS = 24;
const DEFAULT_TELEGRAM_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;
const DEFAULT_DATABASE_URL = "postgresql://postgres:password@localhost:5432/ackimeme";

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
    normalized.includes("acki_fee_wallet_here")
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
      tokenSymbol: "USDC",
      minimumAmount: readPositiveNumber(
        process.env.CREATION_FEE_USDC,
        DEFAULT_USDC_MIN_PAYMENT,
      ),
      decimals: readPositiveNumber(
        process.env.USDC_DECIMALS,
        DEFAULT_USDC_DECIMALS,
      ),
    },
  ];
}

const creationFeeOptions = readCreationFeeOptions();
const feeWallet = process.env.FEE_WALLET || "";
const adminToken = process.env.ADMIN_TOKEN || "";
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
      networkSettlementToken: "VMSHELL",
      blockchainFee: {
        tokenSymbol: "SHELL",
        minimumCreatorBalance: config.minCreatorShellBalance,
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

module.exports = {
  buildPublicConfig,
  config,
};
