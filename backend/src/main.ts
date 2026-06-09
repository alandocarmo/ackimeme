import * as crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Process] Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[Process] Uncaught Exception:", error);
  process.exit(1);
});
import express, { Request, Response, NextFunction } from "express";
import { buildPublicConfig, config, validateConfig } from "./config";
import { query, pool, pingDatabase, runMigrations } from "./db";
import {
  createWalletChallenge,
  revokeSession,
  touchSession,
  verifyWalletChallenge,
  generateQrSession,
  getQrSessionStatus,
  processQrWebhook,
} from "./auth";
import {
  createLaunchTicket,
  normalizeLaunchRequest,
} from "./launches";
import { verifyPayment } from "./payments";
import { createInitialRiskProfile } from "./risk";
import {
  createLaunchBundle,
  getLaunchById,
  getWalletLastLaunch,
  checkAndUpdateWalletRateLimit,
  updateWalletLastLaunch,
  listLaunchesByWallet,
  listPublicLaunches,
  cleanupExpiredAuthData,
  getCommentsByLaunchId,
  addComment,
  reserveTxHash,
  releaseTxHashReservation,
  getTradesByLaunchId,
  getTopHoldersByLaunchId,
  searchLaunches,
  addFavorite,
  removeFavorite,
  listFavorites,
  getPriceHistoryByLaunchId,
  getGlobalStats,
  updateLaunchOnchainState,
} from "./storage";
import { createTreasuryPaymentRecord } from "./treasury";
import {
  getAccountBalance,
  getAccountPublicKey,
} from "./services/graphql.service";
import { uploadToIPFS, createTokenMetadata } from "./services/ipfs.service";
import { deployTokenEcosystem, assertOnchainDeployReady } from "./services/deployer.service";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "./redis";
import { Server, Socket } from "socket.io";
import * as http from "http";
import * as jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { startSyncJob, stopSyncJob, setSocketIo } from "./services/sync.service";
import securityEngine from "./security";
import { validate } from "./validations/validate";
import { CreateLaunchSchema, AuthChallengeSchema, AuthVerifySchema, VerifyPaymentSchema, CommentSchema } from "./validations/schemas";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      session?: any;
      admin?: any;
    }
  }
}

let io: Server | null = null; // Global Socket.io instance

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireValidUUID(req: Request, res: Response, next: NextFunction) {
  const id = (req.params.id || req.params.sessionId) as string | undefined;
  if (id && !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "ID inválido." });
  }
  next();
}

const ADDRESS_REGEX = /^-?[0-9]+:[0-9a-fA-F]{64}$/;
function requireValidAddress(req: Request, res: Response, next: NextFunction) {
  const address = req.params.address as string | undefined;
  if (address && !ADDRESS_REGEX.test(address)) {
    return res.status(400).json({ error: "Endereço inválido." });
  }
  next();
}

// ─── Redis Setup ────────────────────────────────────────────────────────────
if (redisClient) {
  redisClient.connect()
    .then(() => console.log("[Redis] Conectado para rate limiting e cache"))
    .catch((err: any) => console.error("[Redis] Falha na conexão inicial:", err.message));
}

// ─── Background Jobs ────────────────────────────────────────────────────────
const authCleanupTimer = setInterval(() => {
  cleanupExpiredAuthData().catch((err: any) =>
    console.error("[Cron] Erro ao limpar dados de auth expirados:", err.message)
  );
}, 10 * 60 * 1000);

// Removido cache em memória: const verifiedPaymentsCache = new Map<string, { payment: any; timestamp: number }>();

function normalizeCachePart(value: any): string {
  return String(value || "").trim().toLowerCase();
}

interface CacheKeyParams {
  walletAddress: string;
  txHash: string;
  tokenSymbol: string;
  isBoosted?: boolean;
}

function buildVerifiedPaymentCacheKey({ walletAddress, txHash, tokenSymbol, isBoosted = false }: CacheKeyParams): string {
  return [
    normalizeCachePart(walletAddress),
    normalizeCachePart(txHash),
    normalizeCachePart(tokenSymbol || "SHELL"),
    String(isBoosted)
  ].join(":");
}

function isCachedPaymentUsable(cached: any, { walletAddress, txHash, tokenSymbol }: CacheKeyParams): boolean {
  if (!cached || Date.now() - cached.timestamp >= 15 * 60 * 1000) {
    return false;
  }

  const payment = cached.payment || {};
  return (
    normalizeCachePart(payment.walletAddress || payment.payerWallet) ===
      normalizeCachePart(walletAddress) &&
    normalizeCachePart(payment.txHash) === normalizeCachePart(txHash) &&
    normalizeCachePart(payment.tokenSymbol) === normalizeCachePart(tokenSymbol || "SHELL")
  );
}

// Cache agora é limpo automaticamente pelo TTL do Redis

// ─── Rate Limit & txHash: now persistent in PostgreSQL ───────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const hasWildcardOrigin = config.allowedOrigins.includes("*");

async function checkWalletRateLimit(walletAddress: string): Promise<void> {
  const result = await checkAndUpdateWalletRateLimit(walletAddress, RATE_LIMIT_WINDOW_MS);
  if (!result.success && result.timeSinceLastLaunch !== undefined) {
    const waitMinutes = Math.ceil((RATE_LIMIT_WINDOW_MS - result.timeSinceLastLaunch) / 60000);
    throw new Error(`Rate limit: aguarde ${waitMinutes} minuto(s) para criar outro token.`);
  }
}

async function ensureCreatorHasShellBalance(walletAddress: string): Promise<void> {
  const balanceInfo = await getAccountBalance(walletAddress);

  if (!balanceInfo) {
    throw new Error("Carteira do criador não encontrada na Acki Nacki.");
  }

  const balance = Number(balanceInfo.shellEccBalance || 0);
  if (!Number.isFinite(balance) || balance < config.minCreatorShellBalance) {
    throw new Error(
      `Saldo SHELL insuficiente para custos de blockchain. ` +
      `Mínimo recomendado: ${config.minCreatorShellBalance} SHELL.`,
    );
  }
}

async function buildReadinessChecks(databaseReachable: boolean): Promise<any> {
  let redisReachable = false;
  if (redisClient) {
    try {
      await redisClient.ping();
      redisReachable = true;
    } catch {
      redisReachable = false;
    }
  }
  return {
    databaseConfigured: Boolean(config.databaseUrl),
    databaseReachable,
    graphqlConfigured: Boolean(config.graphqlUrl),
    feeWalletConfigured: config.feeWalletConfigured,
    adminWalletsConfigured: config.adminWallets.length > 0,
    allowedOriginsConfigured:
      config.allowedOrigins.length > 0 && !hasWildcardOrigin,
    storageProvider: "postgres",
    redisReachable,
    socketIoRunning: Boolean(io),
  };
}

const app = express();

app.set("trust proxy", 1);

app.use((req: Request, res: Response, next: NextFunction) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

// Security middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));

// Rate Limit Store
const getRateLimitStore = () => {
  if (redisClient) {
    return new RedisStore({
      sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
    });
  }
  return undefined; // fallback to MemoryStore
};

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  store: getRateLimitStore(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again later." }
});
app.use(globalLimiter);

// Rate limiters dedicados para endpoints sensíveis
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  store: getRateLimitStore(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth requests. Please wait before trying again." }
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  store: getRateLimitStore(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many payment verification requests. Please wait." }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  store: getRateLimitStore(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait." }
});

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.use((req: Request, res: Response, next: NextFunction) => {
  const isProduction = config.isProduction;
  const origin = req.headers.origin;

  if (!isProduction) {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  } else {
    if (origin) {
      try {
        const parsedOrigin = new URL(origin);
        const isAllowed = config.allowedOrigins.some(o => {
          try {
            return new URL(o).origin === parsedOrigin.origin;
          } catch { return o === origin; }
        });
        if (isAllowed) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Vary", "Origin");
        }
      } catch {
        if (config.allowedOrigins.includes(origin)) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Vary", "Origin");
        }
      }
    }
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token, x-admin-jwt");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  // CSRF Protection
  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    const referer = req.headers.referer;
    const originHeader = req.headers.origin;
    
    const isValidOrigin = (url: string | undefined) => {
      if (!url) return false;
      try {
        const parsed = new URL(url);
        return config.allowedOrigins.some(o => {
          try {
            const allowed = new URL(o);
            return allowed.host === parsed.host && allowed.protocol === parsed.protocol;
          } catch { return false; }
        });
      } catch { return false; }
    };

    if (isProduction && !isValidOrigin(originHeader) && !isValidOrigin(referer)) {
      if (!req.path.startsWith("/auth/qr/webhook")) {
        console.warn(`[Security] Potential CSRF blocked on ${req.path} from ${originHeader || referer}`);
        return res.status(403).json({ error: "Acesso negado: Origem não autorizada (CSRF Protection)." });
      }
    }
  }

  return next();
});

function extractSessionToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return req.cookies?.["__Host-sessionToken"] || req.cookies?.sessionToken || "";
}

function setSessionCookie(res: Response, sessionToken: string): void {
  const cookieName = config.isProduction ? "__Host-sessionToken" : "sessionToken";
  res.cookie(cookieName, sessionToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? "strict" : "lax",
    path: "/",
    maxAge: config.sessionTtlHours * 60 * 60 * 1000,
  });
}

function buildPublicSession(session: any): any {
  if (!session) {
    return null;
  }
  const { token: _token, ...publicSession } = session;
  return publicSession;
}

async function requireSession(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionToken = extractSessionToken(req);
    const session = await touchSession(sessionToken);

    if (!session) {
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }

    req.session = session;
    return next();
  } catch (err) {
    return res.status(500).json({ error: "Erro interno ao validar sessão." });
  }
}

// ─── Admin Security Layer ──────────────────────────────────────────────────
const JWT_SIGNING_SECRET = config.jwtSecret;     // Segredo separado para assinar JWTs

function signAdminJwt(walletAddress: string): string {
  return jwt.sign({ w: walletAddress }, JWT_SIGNING_SECRET, { expiresIn: "4h" });
}

function verifyAdminJwt(token: string): any {
  try {
    return jwt.verify(token, JWT_SIGNING_SECRET);
  } catch { 
    return null; 
  }
}

async function requireSecurityAdmin(req: Request, res: Response, next: NextFunction) {
  const authCookie = req.cookies?.adminJwt || "";
  const authHeader = (req.headers["x-admin-jwt"] as string) || "";
  const token = authCookie || authHeader;
  
  const data = verifyAdminJwt(token);
  if (data) {
    req.admin = { authMode: "admin_jwt", walletAddress: data.w };
    return next();
  }
  return res.status(401).json({ error: "Acesso admin de segurança negado." });
}

app.post("/admin/unlock", authLimiter, requireSession, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body || {};
    
    if (req.session.walletAddress.toLowerCase() !== String(walletAddress || "").toLowerCase()) {
      return res.status(403).json({ error: "Acesso negado: carteira não corresponde à sessão autenticada." });
    }

    if (config.adminWallets.length === 0) {
      return res.status(503).json({ error: "ADMIN_WALLETS não configurado no servidor." });
    }

    if (!config.adminWallets.includes(String(walletAddress).toLowerCase())) {
      return res.status(403).json({ error: "Acesso negado: carteira não autorizada no whitelist." });
    }
    
    const token = signAdminJwt(req.session.walletAddress);
    res.cookie("adminJwt", token, {
       httpOnly: true,
       secure: config.isProduction,
       sameSite: config.isProduction ? "strict" : "lax",
       path: "/",
       maxAge: 4 * 60 * 60 * 1000
    });
    
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/", (_, res) => {
  res.json({
    ok: true,
    service: config.appName,
    network: config.network,
  });
});

app.get("/healthz", (_, res) => {
  res.json({
    ok: true,
    service: config.appName,
  });
});

app.get("/readyz", async (_, res) => {
  try {
    await pingDatabase();
    if (process.env.REDIS_URL && redisClient && redisClient.isOpen === false) {
      throw new Error("Redis is not connected");
    }
    const checks = await buildReadinessChecks(true);
    const readyForProduction =
      !config.isProduction ||
      (checks.graphqlConfigured &&
        checks.feeWalletConfigured &&
        checks.allowedOriginsConfigured);

    if (config.isProduction) {
      return res.status(readyForProduction ? 200 : 503).json({ ok: readyForProduction });
    }

    if (!readyForProduction) {
      return res.status(503).json({
        ok: false,
        checks,
      });
    }

    return res.json({
      ok: true,
      checks,
    });
  } catch {
    if (config.isProduction) {
      return res.status(503).json({ ok: false });
    }
    const checks = await buildReadinessChecks(false);
    res.status(503).json({
      ok: false,
      checks,
    });
  }
});

app.get("/config", (_, res) => {
  res.json(buildPublicConfig());
});

app.post("/auth/challenge", authLimiter, validate(AuthChallengeSchema), async (req: Request, res: Response) => {
  try {
    const challenge = await createWalletChallenge({
      walletAddress: req.body?.walletAddress,
      telegramInitData: req.body?.telegramInitData || "",
    });

    res.json({
      success: true,
      challenge,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/auth/verify", authLimiter, validate(AuthVerifySchema), async (req: Request, res: Response) => {
  try {
    const session = await verifyWalletChallenge({
      challengeId: req.body?.challengeId,
      walletAddress: req.body?.walletAddress,
      publicKey: req.body?.publicKey,
      signature: req.body?.signature,
      telegramInitData: req.body?.telegramInitData || "",
    });

    setSessionCookie(res, session.token || "");

    res.json({
      success: true,
      session: buildPublicSession(session),
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ─── QR Deep Link Endpoints ──────────────────────────────────────────────────

app.post("/auth/qr/generate", authLimiter, async (req: Request, res: Response) => {
  try {
    const sessionData = await generateQrSession();
    res.json({ success: true, ...sessionData });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/auth/qr/status/:sessionId", apiLimiter, requireValidUUID, async (req: Request, res: Response) => {
  try {
    const statusData = await getQrSessionStatus(req.params.sessionId);
    const sessionToken = statusData?.sessionToken;
    if (statusData?.status === "done" && sessionToken) {
      setSessionCookie(res, sessionToken);
    }
    const { sessionToken: _sessionToken, ...publicStatus } = statusData || {};
    res.json({ success: true, ...publicStatus });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/auth/qr/webhook/:sessionId", authLimiter, requireValidUUID, async (req: Request, res: Response) => {
  if (config.isProduction && !process.env.QR_WEBHOOK_SECRET) {
    return res.status(404).json({ error: "Not found." });
  }

  if (config.isProduction) {
    const appSecret = req.headers["x-app-webhook-secret"] as string;
    if (!appSecret || !process.env.QR_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Webhook não autorizado." });
    }
    const secretBuffer = Buffer.from(appSecret);
    const expectedBuffer = Buffer.from(process.env.QR_WEBHOOK_SECRET);
    if (secretBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(secretBuffer, expectedBuffer)) {
      return res.status(401).json({ error: "Webhook não autorizado." });
    }
  }

  try {
    const result = await processQrWebhook({
      sessionId: req.params.sessionId,
      walletAddress: req.body?.walletAddress,
      publicKey: req.body?.publicKey,
      signature: req.body?.signature,
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/auth/session", async (req: Request, res: Response) => {
  try {
    const sessionToken = extractSessionToken(req);
    const session = await touchSession(sessionToken);

    if (!session) {
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }

    return res.json({
      success: true,
      session: buildPublicSession(session),
    });
  } catch (err) {
    return res.status(500).json({ error: "Erro interno ao obter sessão." });
  }
});

app.post("/auth/logout", async (req: Request, res: Response) => {
  try {
    const sessionToken = extractSessionToken(req);
    const revoked = await revokeSession(sessionToken);

    const cookieName = config.isProduction ? "__Host-sessionToken" : "sessionToken";
    res.clearCookie(cookieName, {
      path: "/",
      sameSite: config.isProduction ? "strict" : "lax",
      secure: config.isProduction,
    });

    res.json({
      success: revoked,
    });
  } catch (err) {
    return res.status(500).json({ error: "Erro interno ao revogar sessão." });
  }
});

app.use("/admin/security", requireSecurityAdmin, securityEngine);

app.get("/tokens/viral", async (req: Request, res: Response) => {
  try {
    const launches = await listPublicLaunches(10);
    res.json({
      success: true,
      ranking: launches.map((launch: any) => ({
        id: launch.id,
        name: launch.launchRequest?.coin?.name || "",
        symbol: launch.launchRequest?.coin?.symbol || "",
        riskScore: launch.riskProfile?.score || 0,
        createdAt: launch.createdAt,
        status: launch.status,
      })),
      source: "database",
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.post("/verify-payment", paymentLimiter, requireSession, validate(VerifyPaymentSchema), async (req: Request, res: Response) => {
  try {
    const walletFromBody =
      typeof req.body?.walletAddress === "string"
        ? req.body.walletAddress.trim()
        : typeof req.body?.wallet === "string"
          ? req.body.wallet.trim()
          : "";
    const walletAddress = String(req.session?.walletAddress || "").trim();
    const txHash = typeof req.body?.txHash === "string" ? req.body.txHash.trim() : "";
    const tokenSymbol =
      typeof req.body?.tokenSymbol === "string"
        ? req.body.tokenSymbol.trim()
        : typeof req.body?.paymentTokenSymbol === "string"
          ? req.body.paymentTokenSymbol.trim()
          : "SHELL";

    if (!walletAddress) {
      throw new Error("Sessão inválida para validar pagamento.");
    }

    if (walletFromBody && walletFromBody !== walletAddress) {
      throw new Error("walletAddress no payload diverge da sessão autenticada.");
    }

    if (!txHash) {
      throw new Error("txHash é obrigatório.");
    }

    const isBoosted = req.body?.isBoosted === "true" || req.body?.isBoosted === true;

    const payment = await verifyPayment({
      walletAddress,
      txHash,
      tokenSymbol,
      isBoosted,
    });

    if (redisClient) {
      await redisClient.setEx(
        buildVerifiedPaymentCacheKey({ walletAddress, txHash, tokenSymbol, isBoosted }),
        15 * 60, // 15 minutes TTL
        JSON.stringify({ payment, timestamp: Date.now() })
      );
    }

    res.json({
      success: true,
      verifiedAt: new Date().toISOString(),
      payment,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});



app.post("/launch-request", requireSession, validate(CreateLaunchSchema), async (req: Request, res: Response) => {
  let txHashReserved = false;
  let reservedTxHash = "";
  let chainDeployAttempted = false;

  try {
    if (config.isProduction && !config.feeWalletConfigured) {
      return res.status(503).json({ 
        error: "Launchpad inoperante: FEE_WALLET não configurada para receber taxas de lançamento na Mainnet." 
      });
    }

    const launchRequest = normalizeLaunchRequest(req.body, req.session);

    await checkWalletRateLimit(launchRequest.creator.wallet);

    const reserved = await reserveTxHash(
      launchRequest.payment.txHash,
      launchRequest.creator.wallet,
    );
    if (!reserved) {
      throw new Error("Este txHash já foi utilizado para criar outro token. Use uma nova transação.");
    }
    txHashReserved = true;
    reservedTxHash = launchRequest.payment.txHash;

    let payment;
    const isBoosted = Boolean(launchRequest.protocol?.isBoosted);
    const paymentCacheKey = buildVerifiedPaymentCacheKey({
      walletAddress: launchRequest.creator.wallet,
      txHash: launchRequest.payment.txHash,
      tokenSymbol: launchRequest.payment.tokenSymbol,
      isBoosted,
    });
    
    let cachedStr: string | null = null;
    if (redisClient) {
      cachedStr = await redisClient.get(paymentCacheKey);
    }
    const cached = cachedStr ? JSON.parse(cachedStr) : undefined;
    
    if (
      isCachedPaymentUsable(cached, {
        walletAddress: launchRequest.creator.wallet,
        txHash: launchRequest.payment.txHash,
        tokenSymbol: launchRequest.payment.tokenSymbol,
      })
    ) {
      payment = cached!.payment;
      if (redisClient) {
        await redisClient.del(paymentCacheKey);
      }
    } else {
      if (redisClient) {
        await redisClient.del(paymentCacheKey);
      }
      payment = await verifyPayment({
        walletAddress: launchRequest.creator.wallet,
        txHash: launchRequest.payment.txHash,
        tokenSymbol: launchRequest.payment.tokenSymbol,
        isBoosted,
      });
    }

    await ensureCreatorHasShellBalance(launchRequest.creator.wallet);

    const treasuryPayment = createTreasuryPaymentRecord({
      creatorWallet: launchRequest.creator.wallet,
      txHash: launchRequest.payment.txHash,
      tokenSymbol: launchRequest.payment.tokenSymbol,
      amount: payment.amount,
    });

    const riskProfile = createInitialRiskProfile({
      launchRequest,
      session: req.session,
    });

    const launchTicket = createLaunchTicket({
      launchRequest,
      treasuryPayment,
      riskProfile,
    });

    console.log(`[Launch] Iniciando upload IPFS do token: ${launchTicket.id}`);
    const metadata = createTokenMetadata(launchRequest);
    const ipfsHash = await uploadToIPFS(metadata);

    console.log(`[Launch] Salvando token preliminar no banco: ${launchTicket.id}`);
    
    try {
      await createLaunchBundle({
        launchTicket,
        auditEvent: {
          id: crypto.randomUUID(),
          type: "launch.created.pending",
          createdAt: new Date().toISOString(),
          walletAddress: launchRequest.creator.wallet,
          launchId: launchTicket.id,
          payload: { stage: "pre_deploy" },
        },
      });
    } catch (bundleErr: any) {
      if (bundleErr && bundleErr.code === "23505") {
        throw new Error("Um token com este endereço on-chain já existe...");
      }
      throw bundleErr;
    }

    console.log(`[Launch] Iniciando automação on-chain para ${launchTicket.id}`);
    
    const deployResult = await deployTokenEcosystem({
      name: launchRequest.coin.name,
      symbol: launchRequest.coin.symbol,
      totalSupply: launchRequest.coin.totalSupply,
      ipfsHash: ipfsHash,
      creatorWallet: launchRequest.creator.wallet,
      paymentTxHash: launchRequest.payment.txHash,
      pumpForever: launchRequest.protocol.pumpForever,
      slopeDivisor: launchRequest.protocol.slopeDivisor,
    });
    chainDeployAttempted = Boolean(deployResult.chainAttempted);

    launchTicket.onchainData = {
      ipfsHash,
      tokenRootAddress: deployResult.tokenRoot,
      bondingCurveAddress: deployResult.bondingCurve,
      deployStatus: deployResult.status,
      deployReason: deployResult.reason || "",
    };

    if (deployResult.status === "deployed" || deployResult.status === "deployment_queued") {
      launchTicket.status = "deployment_queued";
      launchTicket.mintingAvailable = false;
      launchTicket.note = `Token submetido à blockchain com sucesso. Aguardando processamento on-chain da Acki Nacki...`;
    } else if (deployResult.status === "pending_onchain_recovery") {
      launchTicket.status = "on_chain_pending_recovery";
      launchTicket.mintingAvailable = false;
      launchTicket.note =
        `Token registrado com metadata no IPFS (${ipfsHash}); ` +
        "uma transação on-chain já foi enviada e será confirmada pelo sync/recovery.";
    } else if (
      deployResult.status === "awaiting_chain_integration" &&
      process.env.ENABLE_ONCHAIN_DEPLOY !== "true"
    ) {
      launchTicket.status = "payment_verified_waiting_blockchain_integration";
      launchTicket.mintingAvailable = false;
      launchTicket.note =
        `Token registrado com metadata no IPFS (${ipfsHash}), ` +
        "aguardando ativação do deploy on-chain no backend.";
    } else {
      await updateLaunchOnchainState(launchTicket.id, {
         reserveBalance: "0",
         tokenSupply: launchRequest.coin.totalSupply,
         lockedLiquidity: false,
         status: "deploy_failed",
         deployStatus: deployResult.status,
         deployReason: deployResult.reason || "",
      });
      throw new Error(`Falha no deploy on-chain: ${deployResult.status} - ${deployResult.reason}`);
    }

    try {
      await updateLaunchOnchainState(launchTicket.id, {
        reserveBalance: "0",
        tokenSupply: launchRequest.coin.totalSupply,
        lockedLiquidity: false,
        status: launchTicket.status,
        deployStatus: deployResult.status,
        deployReason: deployResult.reason || "",
        ipfsHash,
        tokenRootAddress: deployResult.tokenRoot,
        bondingCurveAddress: deployResult.bondingCurve,
      });
    } catch (bundleErr: any) {
      if (bundleErr && bundleErr.code === "23505") {
        throw new Error(
          "Um token com este endereço on-chain já existe. " +
          "Isso pode ocorrer em retries de deploy. Use uma nova transação de pagamento."
        );
      }
      throw bundleErr;
    }

    await updateWalletLastLaunch(launchRequest.creator.wallet);

    if (io) {
      io.emit("new_launch", {
        id: launchTicket.id,
        status: launchTicket.status,
        createdAt: launchTicket.createdAt,
        coin: {
          name: launchRequest.coin.name,
          symbol: launchRequest.coin.symbol,
          logoUrl: launchRequest.coin.logoUrl
        }
      });
    }

    res.json({
      success: true,
      launchRequest: launchTicket,
    });
  } catch (error: any) {
    if (txHashReserved && reservedTxHash && !chainDeployAttempted) {
      await releaseTxHashReservation(reservedTxHash).catch(() => {});
    } else if (txHashReserved && reservedTxHash && chainDeployAttempted) {
      console.warn(
        `[Launch] Preservando reserva do txHash ${reservedTxHash} porque uma tentativa on-chain já foi iniciada.`,
      );
    }
    res.status(400).json({ error: error.message });
  }
});

function mapPublicLaunch(launch: any): any {
  if (!launch) return null;
  return {
    id: launch.id,
    status: launch.status,
    createdAt: launch.createdAt,
    creatorWallet: launch.launchRequest?.creator?.wallet || launch.wallet_address || "",
    coin: {
      name: launch.launchRequest?.coin?.name || "",
      symbol: launch.launchRequest?.coin?.symbol || "",
      tagline: launch.launchRequest?.coin?.tagline || "",
      description: launch.launchRequest?.coin?.description || "",
      totalSupply: launch.launchRequest?.coin?.totalSupply || "0",
      logoUrl: launch.launchRequest?.coin?.logoUrl || "",
    },
    links: launch.launchRequest?.links || {},
    protocol: launch.launchRequest?.protocol || {},
    treasuryPayment: {
      tokenSymbol: launch.treasuryPayment?.tokenSymbol || "SHELL",
      amount: launch.treasuryPayment?.amount || "0",
    },
    riskProfile: {
      status: launch.riskProfile?.status || "low",
      score: launch.riskProfile?.score || 0,
    },
    onchainData: {
      ipfsHash: launch.ipfsHash || "",
      tokenRootAddress: launch.tokenRootAddress || "",
      bondingCurveAddress: launch.bondingCurveAddress || "",
      deployStatus: launch.onchainData?.deployStatus || 
                    (launch.status === "on_chain_deployed" ? "deployed" : "pending"),
      reserveBalance: launch.onchainData?.reserveBalance || "0",
      tokenSupply: launch.onchainData?.tokenSupply || "0",
      lockedLiquidity: launch.onchainData?.lockedLiquidity || false,
      updatedAt: launch.onchainData?.updatedAt || null,
    },
  };
}

app.get("/launches/search", (req: Request, res: Response) => {
  const queryParam = String(req.query.q || "").trim();
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 30));
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
  if (!queryParam) {
    return res.json({ success: true, launches: [] });
  }
  searchLaunches(queryParam, limit, offset)
    .then((launches) => {
      res.json({
        success: true,
        launches: launches.map(mapPublicLaunch),
      });
    })
    .catch((error) => {
      res.status(500).json({ error: 'Erro interno do servidor.' });
    });
});

app.post("/launches/:id/favorite", requireSession, requireValidUUID, async (req: Request, res: Response) => {
  try {
    const success = await addFavorite(req.session.walletAddress, req.params.id);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.delete("/launches/:id/favorite", requireSession, requireValidUUID, async (req: Request, res: Response) => {
  try {
    const success = await removeFavorite(req.session.walletAddress, req.params.id);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.get("/launches/my/favorites", requireSession, async (req: Request, res: Response) => {
  try {
    const launches = await listFavorites(req.session.walletAddress);
    res.json({
      success: true,
      launches: launches.map(mapPublicLaunch),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.get("/launches/:id/price-history", requireValidUUID, async (req: Request, res: Response) => {
  try {
    const interval = Math.max(1, parseInt(req.query.interval as string) || 15);
    const history = await getPriceHistoryByLaunchId(req.params.id, interval);
    res.json({
      success: true,
      history,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.get("/stats", async (req: Request, res: Response) => {
  try {
    res.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=15");
    if (redisClient && redisClient.isOpen) {
      const cached = await redisClient.get("global_stats");
      if (cached) return res.json({ success: true, stats: JSON.parse(cached) });
    }
    const stats = await getGlobalStats();
    if (redisClient && redisClient.isOpen) {
      await redisClient.set("global_stats", JSON.stringify(stats), { EX: 15 });
    }
    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.get("/launches/my", requireSession, (req: Request, res: Response) => {
  listLaunchesByWallet(req.session.walletAddress)
    .then((launches) => {
      res.json({
        success: true,
        launches: launches.map(mapPublicLaunch),
      });
    })
    .catch((error) => {
      res.status(500).json({ error: 'Erro interno do servidor.' });
    });
});

app.get("/public/launches", (req: Request, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  res.set("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
  listPublicLaunches(limit, offset)
    .then((launches) => {
      res.json({
        success: true,
        launches: launches.map(mapPublicLaunch),
      });
    })
    .catch((error) => {
      res.status(500).json({ error: 'Erro interno do servidor.' });
    });
});

app.get("/launches/:id", requireValidUUID, async (req: Request, res: Response) => {
  try {
    res.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=15");
    const found = await getLaunchById(req.params.id);
    if (!found) return res.status(404).json({ error: "Token não encontrado." });
    res.json({
      success: true,
      launch: {
        id: found.id,
        status: found.status,
        createdAt: found.createdAt,
        creatorWallet: found.launchRequest.creator.wallet,
        coin: {
          name: found.launchRequest.coin.name,
          symbol: found.launchRequest.coin.symbol,
          tagline: found.launchRequest.coin.tagline,
          description: found.launchRequest.coin.description,
          totalSupply: found.launchRequest.coin.totalSupply,
          logoUrl: found.launchRequest.coin.logoUrl,
        },
        links: found.launchRequest.links || {},
        protocol: found.launchRequest.protocol || {},
        treasuryPayment: {
          tokenSymbol: found.treasuryPayment.tokenSymbol,
          amount: found.treasuryPayment.amount,
        },
        riskProfile: {
          status: found.riskProfile.status,
          score: found.riskProfile.score,
        },
        onchainData: {
          ipfsHash: found.ipfsHash,
          tokenRootAddress: found.tokenRootAddress,
          bondingCurveAddress: found.bondingCurveAddress,
          deployStatus: found.onchainData?.deployStatus || 
                        (found.status === "on_chain_deployed" ? "deployed" : "pending"),
          reserveBalance: found.onchainData?.reserveBalance || "0",
          tokenSupply: found.onchainData?.tokenSupply || "0",
          lockedLiquidity: found.onchainData?.lockedLiquidity || false,
          updatedAt: found.onchainData?.updatedAt || null,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.get("/launches/:id/comments", requireValidUUID, async (req: Request, res: Response) => {
  try {
    const rawLimit = parseInt(req.query.limit as string) || 50;
    const limit = Math.min(Math.max(rawLimit, 1), 100);
    const comments = await getCommentsByLaunchId(req.params.id, limit);
    res.json({ success: true, comments });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.post("/launches/:id/comments", requireSession, requireValidUUID, validate(CommentSchema), async (req: Request, res: Response) => {
  try {
    const launchExists = await query(`SELECT id FROM launches WHERE id=$1`, [req.params.id]);
    if ((launchExists.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Token não encontrado." });
    }

    const wallet = req.session.walletAddress;
    const content = String(req.body.content || "").trim();
    
    if (!content || content.length > 500) {
      return res.status(400).json({ error: "Comentário deve ter entre 1 e 500 caracteres." });
    }

    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)/i;
    if (urlRegex.test(content)) {
      return res.status(400).json({ error: "Links não são permitidos nos comentários por segurança." });
    }
    
    const rl = await query(
      `INSERT INTO wallet_rate_limits (wallet_address, last_comment_at)
       VALUES ($1, NOW())
       ON CONFLICT (wallet_address) DO UPDATE
         SET last_comment_at = NOW()
       WHERE wallet_rate_limits.last_comment_at IS NULL
          OR wallet_rate_limits.last_comment_at < NOW() - interval '30 seconds'
       RETURNING *`,
      [wallet]
    );

    if ((rl.rowCount ?? 0) === 0) {
      return res.status(429).json({ error: "Aguarde 30 segundos antes de postar outro comentário." });
    }

    // Insertion is already handled above in the rate limit check to prevent race conditions

    const comment = {
      id: crypto.randomUUID(),
      launchId: req.params.id,
      walletAddress: req.session.walletAddress,
      content,
      createdAt: new Date().toISOString()
    };

    const savedComment = await addComment(comment);
    
    if (io) {
      io.to(`token_${req.params.id}`).emit("new_comment", savedComment);
    }
    
    res.json({ success: true, comment: savedComment });
  } catch (err: any) {
    const isClientError = err.message?.includes("não encontrado") || err.message?.includes("entre 1 e 500") || err.message?.includes("Links não são");
    res.status(isClientError ? 400 : 500).json({ error: err.message });
  }
});

app.get("/launches/:id/trades", requireValidUUID, async (req: Request, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 50));
    const trades = await getTradesByLaunchId(req.params.id, limit);
    res.json({ success: true, trades });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.get("/launches/:id/holders", requireValidUUID, async (req: Request, res: Response) => {
  try {
    const launch = await getLaunchById(req.params.id);
    if (!launch) return res.status(404).json({ error: "Launch não encontrado." });

    const holders: any[] = await getTopHoldersByLaunchId(req.params.id, 20);
    
    const rawSupply = launch.onchainData?.tokenSupply || launch.launchRequest?.coin?.totalSupply || "1000000000";
    const isNano = Boolean(launch.onchainData?.tokenSupply);
    const totalSupply = isNano ? BigInt(rawSupply) : BigInt(rawSupply) * 1000000000n;
    
    const circulating = holders.reduce((acc: bigint, h: any) => acc + BigInt(h.balance), 0n);
    const bcBalance = totalSupply > circulating ? (totalSupply - circulating) : 0n;
    
    if (bcBalance > 0n && launch.bondingCurveAddress) {
      holders.push({
        walletAddress: launch.bondingCurveAddress,
        balance: String(bcBalance),
        isBondingCurve: true
      });
    }

    holders.sort((a: any, b: any) => {
      const aVal = BigInt(a.balance);
      const bVal = BigInt(b.balance);
      if (bVal > aVal) return 1;
      if (bVal < aVal) return -1;
      return 0;
    });

    res.json({ success: true, holders, totalSupply: totalSupply.toString() });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.get("/wallet/:address/balance", apiLimiter, requireValidAddress, async (req: Request, res: Response) => {
  try {
    const balance = await getAccountBalance(req.params.address);
    if (!balance) return res.status(404).json({ error: "Conta não encontrada na Acki Nacki." });
    res.json({ success: true, ...balance });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

async function start() {
  validateConfig();

  await pingDatabase();
  await runMigrations();
  assertOnchainDeployReady();

  const server = http.createServer(app);
  io = new Server(server, {
    cors: {
      origin: config.allowedOrigins?.length ? config.allowedOrigins : false,
      credentials: true
    }
  });
  
  const socketRateLimit = new Map<string, { count: number; startTime: number }>();
  
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of socketRateLimit.entries()) {
      if (now - val.startTime > 60000) socketRateLimit.delete(key);
    }
  }, 60000);

  io.use((socket, next) => {
    const rawIp = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
    const ip = Array.isArray(rawIp) ? rawIp[0] : (typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : "unknown");
    const now = Date.now();
    const limit = socketRateLimit.get(ip);
    
    if (limit && now - limit.startTime < 60000) {
      if (limit.count > 30) {
        return next(new Error("Rate limit exceeded for websockets"));
      }
      limit.count++;
    } else {
      socketRateLimit.set(ip, { count: 1, startTime: now });
    }
    
    next();
  });

  io.on("connection", (socket: Socket) => {
    socket.on("join_token", (tokenId) => {
      if (typeof tokenId !== "string" || !UUID_REGEX.test(tokenId)) return;
      socket.join(`token_${tokenId}`);
    });
  });

  setSocketIo(io);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("[Express] Unhandled error:", err);
    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: "JSON malformado." });
    }
    res.status(500).json({ error: "Erro interno do servidor." });
  });

  server.listen(config.port, () => {
    console.log(`Backend running on port ${config.port} (Production: ${config.isProduction})`);
    startSyncJob();
  });

  let isShuttingDown = false;
  const activeConnections = new Set<any>();

  server.on("connection", (socket) => {
    activeConnections.add(socket);
    socket.once("close", () => activeConnections.delete(socket));
  });

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[Server] ${signal} received. Closing resources...`);
    
    stopSyncJob();
    clearInterval(authCleanupTimer);

    server.close(async () => {
      console.log("[Server] Active HTTP requests finished.");
      try {
        await pool.end();
        console.log("[Database] Pool closed.");
      } catch (err: any) {
        console.error("[Database] Error closing pool:", err.message);
      }
      try {
        if (redisClient && redisClient.isOpen) {
          await redisClient.quit();
          console.log("[Redis] Connection closed.");
        }
      } catch (err: any) {
        console.error("[Redis] Error closing connection:", err.message);
      }
      console.log("[Server] Shutdown complete. Bye!\n");
      process.exit(0);
    });

    setTimeout(async () => {
      console.warn("[Server] Force closing hanging connections after 10s timeout...");
      for (const socket of activeConnections) {
        socket.destroy();
      }
      try { await pool.end(); } catch (e) {}
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
