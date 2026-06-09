import * as dotenv from "dotenv";
dotenv.config();

const DEFAULT_APP_NAME = "AckiMeme";
const DEFAULT_NETWORK = "Acki Nacki";
const DEFAULT_SHELL_MIN_PAYMENT = 300; // ~$3 USD (300 SHELL × $0.01/SHELL via Accumulator: 100 SHELL = 1 USDC)
const DEFAULT_SHELL_DECIMALS = 9;    // SHELL uses 9 decimals (nano)
const DEFAULT_USDC_DECIMALS = 6;
const DEFAULT_MIN_CREATOR_SHELL_BALANCE = 1;
const DEFAULT_AUTH_CHALLENGE_TTL_SECONDS = 5 * 60;
const DEFAULT_SESSION_TTL_HOURS = 24;
const DEFAULT_TELEGRAM_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;
const DEFAULT_DATABASE_URL = "";

// V-AM-01: ECC Token ID constants matching on-chain BondingCurve.sol
// These mirror the contract constants to keep the full stack aligned.
export const ECC_TOKEN_IDS = Object.freeze({
  NACKL: 1,  // Staking & store of value (9 decimals)
  SHELL: 2,  // Utility token — the ONLY accepted payment (9 decimals)
  USDC:  3,  // Stablecoin (6 decimals)
});

function readPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function readCsv(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.trunc(parsed);
}

function isPlaceholderValue(value: unknown): boolean {
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

function isConfiguredWallet(value: unknown): boolean {
  const normalized = String(value || "").trim();
  if (!normalized || isPlaceholderValue(normalized)) {
    return false;
  }
  return normalized === "dev-wallet-local" || /^0:[0-9a-f]{64}$/i.test(normalized);
}

function isStrongSecret(value: unknown, minimumLength = 32): boolean {
  const normalized = String(value || "").trim();
  if (!normalized || isPlaceholderValue(normalized)) {
    return false;
  }
  return normalized.length >= minimumLength;
}

export interface CreationFeeOption {
  tokenSymbol: string;
  minimumAmount: number;
  decimals: number;
}

function readCreationFeeOptions(): CreationFeeOption[] {
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
const jwtSecret = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ CRITICAL ERROR: JWT_SECRET must be set in production.");
    process.exit(1);
  }
  const generated = require("crypto").randomBytes(32).toString("hex");
  console.warn("⚠️  JWT_SECRET não configurado — usando segredo aleatório (sessões admin não sobrevivem restart).");
  return generated;
})();
const isProduction = process.env.NODE_ENV === "production";

export interface AppConfig {
  port: number;
  appName: string;
  network: string;
  isProduction: boolean;
  databaseUrl: string;
  databaseSsl: boolean;
  graphqlUrl: string;
  feeWallet: string;
  feeWalletConfigured: boolean;
  allowedOrigins: string[];
  creationFeeOptions: CreationFeeOption[];
  minCreatorShellBalance: number;
  authChallengeTtlSeconds: number;
  sessionTtlHours: number;
  telegramBotToken: string;
  telegramAuthMaxAgeSeconds: number;
  telegramBotUsername: string;
  jwtSecret: string;
  jwtSecretConfigured: boolean;
  adminWallets: string[];
  appFeeSharePercent: number;
  launchDistribution: {
    type: string;
    fairLaunch: boolean;
  };
  shellBuy: boolean;
}

export const config: AppConfig = {
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
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || "ackinacki_bot",
  jwtSecret,
  jwtSecretConfigured: isStrongSecret(jwtSecret, 32),
  adminWallets: readCsv(process.env.ADMIN_WALLETS).map((item) => item.toLowerCase()),
  appFeeSharePercent: readPositiveInteger(process.env.APP_FEE_SHARE_PERCENT, 100),
  launchDistribution: {
    type: "pump_fun_bonding_curve",
    fairLaunch: true,
  },
  shellBuy: String(process.env.ENABLE_SHELL_BUY || "false").toLowerCase() === "true",
};

export function buildPublicConfig() {
  return {
    appName: config.appName,
    network: config.network,
    shellBuy: config.shellBuy,
    payment: {
      feeWallet: config.feeWalletConfigured ? config.feeWallet : "Configure backend/.env",
      creationFees: config.creationFeeOptions,
      appFeeSharePercent: config.appFeeSharePercent,
      feeTokenSymbol: "SHELL",
      blockchainFee: {
        tokenSymbol: "SHELL",
        minimumCreatorBalance: config.minCreatorShellBalance,
        note: "Taxa de produto em SHELL ECC (~$3). A execução on-chain (gas) é paga em VMSHELL.",
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
      authMode: "wallet_only",
    },
  };
}

export function validateConfig(): void {
  const errors: string[] = [];

  if (isProduction) {
    if (!config.feeWalletConfigured) {
      errors.push("FEE_WALLET não está configurada corretamente (requer formato 0:abc...)");
    }
    if (!config.jwtSecretConfigured) {
      errors.push("JWT_SECRET precisa ser forte (32+ caracteres) em produção.");
    }
    if (!config.databaseUrl) {
      errors.push("DATABASE_URL é obrigatória em produção.");
    }
    const deployerSecret = String(process.env.DEPLOYER_SECRET_KEY || process.env.DEPLOYER_PRIVATE_KEY || "").trim();
    if (!/^[0-9a-f]{64}([0-9a-f]{64})?$/i.test(deployerSecret)) {
      errors.push("DEPLOYER_SECRET_KEY inválida ou ausente: use 32 bytes/64 hex raw secret ou 64 bytes/128 hex signer secret.");
    }
    if (!process.env.DEPLOYER_WALLET_ADDRESS || !/^[-]?\d+:[0-9a-f]{64}$/i.test(process.env.DEPLOYER_WALLET_ADDRESS)) {
      errors.push("DEPLOYER_WALLET_ADDRESS inválida ou ausente para pré-financiar endereços futuros.");
    }
    if (process.env.ENABLE_ONCHAIN_DEPLOY !== "true") {
      console.warn("⚠️  Aviso: ENABLE_ONCHAIN_DEPLOY não é 'true'. Modo simulação on-chain ativo na produção.");
    }
    if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_API_KEY) {
      errors.push("PINATA_API_KEY/SECRET_API_KEY ausentes (necessário para IPFS).");
    }
    if (!config.graphqlUrl) {
      errors.push("GRAPHQL_URL é obrigatória em produção. Sem ela, GraphQL/Deployer/Sync caem para shellnet (testnet).");
    } else if (config.graphqlUrl.includes("shellnet") && !config.graphqlUrl.includes("mainnet")) {
      if (process.env.ALLOW_SHELLNET_GRAPHQL !== "true") {
        errors.push("GRAPHQL_URL aponta para testnet (shellnet) em ambiente de produção. Use o endpoint mainnet ou defina ALLOW_SHELLNET_GRAPHQL=true para testes.");
      } else {
        console.warn("⚠️  ALLOW_SHELLNET_GRAPHQL=true — usando shellnet em modo produção. NÃO usar em mainnet real!");
      }
    }
    if (!process.env.QR_WEBHOOK_SECRET || process.env.QR_WEBHOOK_SECRET.length < 32) {
      errors.push("QR_WEBHOOK_SECRET é obrigatório em produção (mínimo 32 caracteres) para proteger o webhook de autenticação QR.");
    }
    const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || process.env.API_BASE_URL || "";
    if (!backendUrl || backendUrl.includes("localhost")) {
      errors.push("BACKEND_URL (ou API_BASE_URL) deve ser a URL pública do backend em produção (não localhost).");
    }
    if (process.env.TELEGRAM_BOT_USERNAME === "ackinacki_bot" || !process.env.TELEGRAM_BOT_USERNAME) {
       console.warn("⚠️ TELEGRAM_BOT_USERNAME não configurado ou usando default 'ackinacki_bot'. Recomenda-se configurar o bot oficial do seu projeto.");
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
