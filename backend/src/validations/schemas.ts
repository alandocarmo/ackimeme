import { z } from "zod";
import { config } from "../config";

/** TVM address or local dev wallet (see config.isConfiguredWallet). */
export const WalletAddressInput = z
  .string()
  .refine(
    (v) =>
      (!config.isProduction && v === "dev-wallet-local") || /^-?[0-9]+:[0-9a-fA-F]{64}$/i.test(v),
    { message: "Endereço TVM inválido" },
  );

const boolish = z.union([
  z.boolean(),
  z.literal("true"),
  z.literal("false"),
]);

/** Matches frontend + normalizeLaunchRequest (flat body). */
const FlatCreateLaunchSchema = z
  .object({
    name: z.string().min(2).max(32),
    symbol: z.string().min(2).max(10),
    description: z.string().min(20).max(280),
    totalSupply: z.coerce.string().min(1),
    tagline: z.string().max(72).optional(),
    logoUrl: z.string().max(2048).optional(),
    website: z.string().max(2048).optional(),
    xUrl: z.string().max(2048).optional(),
    telegramUrl: z.string().max(2048).optional(),
    txHash: z.string().min(6).max(180),
    creatorWallet: WalletAddressInput.optional(),
    pumpForever: boolish.optional(),
    isBoosted: boolish.optional(),
    slopeDivisor: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

function flattenNestedLaunchBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || !("coin" in body)) {
    return body;
  }

  const nested = body as Record<string, unknown>;
  const coin = (nested.coin || {}) as Record<string, unknown>;
  const creator = (nested.creator || {}) as Record<string, unknown>;
  const payment = (nested.payment || {}) as Record<string, unknown>;
  const protocol = (nested.protocol || {}) as Record<string, unknown>;
  const links = (nested.links || {}) as Record<string, unknown>;

  return {
    name: coin.name,
    symbol: coin.symbol,
    description: coin.description,
    totalSupply: coin.totalSupply,
    tagline: coin.tagline,
    logoUrl: coin.logoUrl,
    website: links.website,
    xUrl: links.twitter ?? links.xUrl,
    telegramUrl: links.telegram ?? links.telegramUrl,
    txHash: payment.txHash,
    creatorWallet: creator.wallet,
    pumpForever: protocol.pumpForever,
    isBoosted: protocol.isBoosted,
    slopeDivisor: protocol.slopeDivisor,
  };
}

export const CreateLaunchSchema = z.preprocess(
  flattenNestedLaunchBody,
  FlatCreateLaunchSchema,
);

export const AuthChallengeSchema = z.object({
  walletAddress: WalletAddressInput,
  telegramInitData: z.string().optional(),
});

export const AuthVerifySchema = z.object({
  challengeId: z.string().uuid(),
  walletAddress: WalletAddressInput,
  publicKey: z.string().min(1),
  signature: z.string().min(1),
  telegramInitData: z.string().optional(),
});

export const VerifyPaymentSchema = z.object({
  walletAddress: WalletAddressInput.optional(),
  wallet: WalletAddressInput.optional(),
  txHash: z.string().min(6).max(180),
  tokenSymbol: z.string().optional().default("SHELL"),
  paymentTokenSymbol: z.string().optional(),
  isBoosted: boolish.optional(),
});

export const CommentSchema = z.object({
  content: z.string().min(1).max(500),
});
