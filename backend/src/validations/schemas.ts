import { z } from "zod";

export const CreateLaunchSchema = z.object({
  coin: z.object({
    name: z.string().min(1).max(32),
    symbol: z.string().min(1).max(10).toUpperCase(),
    description: z.string().max(1000).optional(),
    logoUrl: z.string().url().optional().or(z.literal("")),
    totalSupply: z.string().optional(),
    tagline: z.string().max(100).optional(),
  }),
  creator: z.object({
    wallet: z.string().regex(/^-?[0-9]+:[0-9a-fA-F]{64}$/, "Endereço TVM inválido"),
  }),
  payment: z.object({
    txHash: z.string().min(10),
    tokenSymbol: z.string().default("SHELL").optional(),
  }),
  protocol: z.object({
    isBoosted: z.boolean().optional(),
    pumpForever: z.boolean().optional(),
    slopeDivisor: z.number().optional(),
  }).optional(),
  links: z.object({
    website: z.string().url().optional().or(z.literal("")),
    telegram: z.string().url().optional().or(z.literal("")),
    twitter: z.string().url().optional().or(z.literal("")),
  }).optional(),
});

export const AuthChallengeSchema = z.object({
  walletAddress: z.string().regex(/^-?[0-9]+:[0-9a-fA-F]{64}$/, "Endereço TVM inválido").optional(),
  telegramInitData: z.string().optional(),
});

export const AuthVerifySchema = z.object({
  challengeId: z.string().uuid().optional(),
  walletAddress: z.string().regex(/^-?[0-9]+:[0-9a-fA-F]{64}$/, "Endereço TVM inválido").optional(),
  publicKey: z.string().optional(),
  signature: z.string().optional(),
  telegramInitData: z.string().optional(),
});

export const VerifyPaymentSchema = z.object({
  walletAddress: z.string().regex(/^-?[0-9]+:[0-9a-fA-F]{64}$/).optional(),
  wallet: z.string().regex(/^-?[0-9]+:[0-9a-fA-F]{64}$/).optional(),
  txHash: z.string().min(10).optional(),
  tokenSymbol: z.string().optional(),
  paymentTokenSymbol: z.string().optional(),
  isBoosted: z.boolean().optional(),
});

export const CommentSchema = z.object({
  content: z.string().min(1).max(500),
});
