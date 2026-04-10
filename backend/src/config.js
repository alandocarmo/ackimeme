const DEFAULT_APP_NAME = "AckiMeme";
const DEFAULT_NETWORK = "Acki Nacki";
const DEFAULT_SHELL_MIN_PAYMENT = 3;
const DEFAULT_USDC_MIN_PAYMENT = 10;
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

function readCreationFeeOptions() {
  return [
    {
      tokenSymbol: "SHELL",
      minimumAmount: readPositiveNumber(
        process.env.CREATION_FEE_SHELL,
        DEFAULT_SHELL_MIN_PAYMENT,
      ),
    },
    {
      tokenSymbol: "USDC",
      minimumAmount: readPositiveNumber(
        process.env.CREATION_FEE_USDC,
        DEFAULT_USDC_MIN_PAYMENT,
      ),
    },
  ];
}

const creationFeeOptions = readCreationFeeOptions();

const config = {
  port: readPositiveNumber(process.env.PORT, 3000),
  appName: process.env.APP_NAME || DEFAULT_APP_NAME,
  network: process.env.APP_NETWORK || DEFAULT_NETWORK,
  databaseUrl: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === "true",
  graphqlUrl: process.env.GRAPHQL_URL || "",
  feeWallet: process.env.FEE_WALLET || "",
  allowedOrigins: readCsv(process.env.ALLOWED_ORIGINS),
  creationFeeOptions,
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
  adminToken: process.env.ADMIN_TOKEN || "",
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
      feeWallet: config.feeWallet || "Configure backend/.env",
      creationFees: config.creationFeeOptions,
      appFeeSharePercent: config.appFeeSharePercent,
      networkSettlementToken: "VMSHELL",
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
    launchpad: {
      mode: "admin_curated_exclusive",
      projectStatus: "published_only_on_public_feed",
      submissionReview: "manual_review",
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
