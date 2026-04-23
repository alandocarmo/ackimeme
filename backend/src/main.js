const crypto = require("crypto");
require("dotenv").config();
const express = require("express");
const { buildPublicConfig, config, validateConfig } = require("./config");
const { pool, pingDatabase, runMigrations } = require("./db");
const {
  createWalletChallenge,
  revokeSession,
  touchSession,
  verifyWalletChallenge,
  generateQrSession,
  getQrSessionStatus,
  processQrWebhook,
} = require("./auth");
const {
  createLaunchTicket,
  normalizeLaunchRequest,
} = require("./launches");
const { verifyPayment } = require("./payments");
const { createInitialRiskProfile } = require("./risk");
const {
  createLaunchBundle,
  getLaunchById,
  getWalletLastLaunch,
  getShellBuyOrderById,
  getShellBuyOrderByTxHash,
  isTxHashUsed,
  listShellBuyOrdersByWallet,
  markTxHashUsed,
  reserveTxHash,
  releaseTxHashReservation,
  updateWalletLastLaunch,
  createShellBuyOrder,
  listLaunchesByWallet,
  listPublicLaunches,
  cleanupExpiredAuthData,
  getCommentsByLaunchId,
  addComment,
} = require("./storage");
const { createTreasuryPaymentRecord } = require("./treasury");
const {
  getAccountBalance,
  getTip3TransferPayment,
  isTip3DecoderAvailable,
} = require("./services/graphql.service");
const { uploadToIPFS, createTokenMetadata } = require("./services/ipfs.service");
const { deployTokenEcosystem } = require("./services/deployer.service");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { startSyncJob, stopSyncJob } = require("./services/sync.service");

// ─── Background Jobs ────────────────────────────────────────────────────────
// Limpeza de sessões e challenges expirados roda a cada 10 minutos 
// em vez de sobrecarregar os endpoints de autenticação.
setInterval(() => {
  cleanupExpiredAuthData().catch((err) =>
    console.error("[Cron] Erro ao limpar dados de auth expirados:", err.message)
  );
}, 10 * 60 * 1000);

// Audit #5: L1 in-memory cache for single-instance mode.
// In serverless/multi-instance environments, this cache may be empty on subsequent requests.
// The /launch-request endpoint handles this gracefully by re-verifying on-chain if cache misses.
const verifiedPaymentsCache = new Map();

// Limpeza de pagamentos verificados não consumidos (L1 cache fallback)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of verifiedPaymentsCache) {
    if (now - entry.timestamp > 15 * 60 * 1000) {
      verifiedPaymentsCache.delete(key);
    }
  }
}, 5 * 60 * 1000);


// ─── Rate Limit & txHash: now persistent in PostgreSQL ───────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const hasWildcardOrigin = config.allowedOrigins.includes("*");

async function checkWalletRateLimit(walletAddress) {
  const lastTime = await getWalletLastLaunch(walletAddress);
  if (lastTime && Date.now() - lastTime.getTime() < RATE_LIMIT_WINDOW_MS) {
    const waitMinutes = Math.ceil((RATE_LIMIT_WINDOW_MS - (Date.now() - lastTime.getTime())) / 60000);
    throw new Error(`Rate limit: aguarde ${waitMinutes} minuto(s) para criar outro token.`);
  }
}



async function ensureCreatorHasShellBalance(walletAddress) {
  const balanceInfo = await getAccountBalance(walletAddress);

  if (!balanceInfo) {
    throw new Error("Carteira do criador não encontrada na Acki Nacki.");
  }

  const balance = Number(balanceInfo.balance || 0);
  if (!Number.isFinite(balance) || balance < config.minCreatorShellBalance) {
    throw new Error(
      `Saldo SHELL insuficiente para custos de blockchain. ` +
      `Mínimo recomendado: ${config.minCreatorShellBalance} SHELL.`,
    );
  }
}

function isShellBuyAvailable() {
  return (
    config.shellBuy.enabled &&
    config.shellBuy.usdcRecipientConfigured &&
    isTip3DecoderAvailable()
  );
}

function calcShellAmountFromUsdc(usdcAmount) {
  const parsedAmount = Number(usdcAmount || 0);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return 0;
  }
  return Number((parsedAmount * config.shellBuy.shellPerUsdc).toFixed(9));
}

function buildReadinessChecks(databaseReachable) {
  return {
    databaseConfigured: Boolean(config.databaseUrl),
    databaseReachable,
    graphqlConfigured: Boolean(config.graphqlUrl),
    tip3DecoderAvailable: isTip3DecoderAvailable(),
    shellBuyEnabled: config.shellBuy.enabled,
    shellBuyReady: !config.shellBuy.enabled || isShellBuyAvailable(),
    feeWalletConfigured: config.feeWalletConfigured,
    adminTokenConfigured: config.adminTokenStrong,
    allowedOriginsConfigured:
      config.allowedOrigins.length > 0 && !hasWildcardOrigin,
    storageProvider: "postgres",
  };
}



const app = express();

// Trust proxy (Vercel, Nginx, CloudFlare) — necessário para:
// 1. express-rate-limit usar o IP real do cliente (não o IP do proxy)
// 2. req.ip retornar o IP correto nos logs e auditoria
app.set("trust proxy", 1);

// Security middlewares
// A-12: Configurar CSP apropriado em vez de desabilitar
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"], // Backend is an API, shouldn't load external resources
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requests por IP a cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again later." }
});
app.use(globalLimiter);

// Rate limiters dedicados para endpoints sensíveis
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 requests por IP por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth requests. Please wait before trying again." }
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // 5 verificações por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many payment verification requests. Please wait." }
});

// Parse JSON com limite rígido (100kb é suficiente para os payloads do DApp)
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.use((req, res, next) => {
  const isProduction = config.isProduction;
  const origin = req.headers.origin;

  if (!isProduction) {
    // Development: permissive but specific if possible
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else {
    // Production: STRICT whitelist
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    } else if (config.allowedOrigins.length === 0) {
      // Emergency fallback if ALLOWED_ORIGINS is empty in prod (not recommended)
      res.setHeader("Access-Control-Allow-Origin", "null");
    }
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  // ─── CSRF Protection for Cookie-based Admin Endpoints ──────────────────────
  // We use Referer/Origin validation for state-changing admin requests
  if (req.path.startsWith("/admin") && ["POST", "PATCH", "DELETE"].includes(req.method)) {
    const referer = req.headers.referer;
    const originHeader = req.headers.origin;
    
    // Audit #6: Exact host comparison instead of substring to prevent CSRF bypass
    const isValidOrigin = (url) => {
      if (!url) return false;
      try {
        const parsed = new URL(url);
        return config.allowedOrigins.some(o => {
          try {
            const allowed = new URL(o);
            return allowed.host === parsed.host;
          } catch { return false; }
        });
      } catch { return false; }
    };

    if (isProduction && !isValidOrigin(originHeader) && !isValidOrigin(referer)) {
      console.warn(`[Security] Potential CSRF blocked on ${req.path} from ${originHeader || referer}`);
      return res.status(403).json({ error: "Acesso negado: Origem não autorizada (CSRF Protection)." });
    }
  }

  return next();
});

function extractSessionToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return req.cookies?.sessionToken || "";
}

function setSessionCookie(res, sessionToken) {
  res.cookie("sessionToken", sessionToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  });
}




async function requireSession(req, res, next) {
  const sessionToken = extractSessionToken(req);
  const session = await touchSession(sessionToken);

  if (!session) {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }

  req.session = session;
  return next();
}



// ─── Admin Security Layer ──────────────────────────────────────────────────
const ADMIN_MASTER_PASSWORD = config.adminToken; // Senha para login admin
const JWT_SIGNING_SECRET = config.jwtSecret;     // Segredo separado para assinar JWTs

function signAdminJwt(walletAddress) {
  return jwt.sign({ w: walletAddress }, JWT_SIGNING_SECRET, { expiresIn: "4h" });
}

function verifyAdminJwt(token) {
  try {
    return jwt.verify(token, JWT_SIGNING_SECRET);
  } catch { 
    return null; 
  }
}

async function requireSecurityAdmin(req, res, next) {
  const authCookie = req.cookies?.adminJwt || "";
  const authHeader = req.headers["x-admin-jwt"] || "";
  const token = authCookie || authHeader;
  
  const data = verifyAdminJwt(token);
  if (data) {
    req.admin = { authMode: "admin_jwt", walletAddress: data.w };
    return next();
  }
  return res.status(401).json({ error: "Acesso admin de segurança negado." });
}

// ── Admin unlock: verify master password, return short-lived JWT ──────────────
app.post("/admin/unlock", authLimiter, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!config.adminTokenStrong) return res.status(503).json({ error: "ADMIN_TOKEN não configurado com segurança no backend." });
    if (!password || password !== ADMIN_MASTER_PASSWORD) return res.status(401).json({ error: "Senha incorreta." });
    
    const token = signAdminJwt("admin");
    // Secure JWT via HttpOnly cookie
    res.cookie("adminJwt", token, {
       httpOnly: true,
       secure: config.isProduction,
       sameSite: "strict",
       path: "/",
       maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });
    
    // A-06: JWT only via HttpOnly cookie — not in response body (prevents XSS exposure)
    return res.json({ success: true });
  } catch (err) {
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
    timestamp: new Date().toISOString(),
  });
});

app.get("/readyz", (_, res) => {
  pingDatabase()
    .then(() => {
      const checks = buildReadinessChecks(true);
      const readyForProduction =
        !config.isProduction ||
        (checks.graphqlConfigured &&
          checks.tip3DecoderAvailable &&
          checks.shellBuyReady &&
          checks.feeWalletConfigured &&
          checks.adminTokenConfigured &&
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
    })
    .catch(() => {
      if (config.isProduction) {
        return res.status(503).json({ ok: false });
      }
      const checks = buildReadinessChecks(false);
      res.status(503).json({
        ok: false,
        checks,
      });
    });
});

app.get("/config", (_, res) => {
  res.json(buildPublicConfig());
});

app.post("/auth/challenge", authLimiter, async (req, res) => {
  try {
    const challenge = await createWalletChallenge({
      walletAddress: req.body?.walletAddress,
      telegramInitData: req.body?.telegramInitData || "",
    });

    res.json({
      success: true,
      challenge,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/auth/verify", authLimiter, async (req, res) => {
  try {
    const session = await verifyWalletChallenge({
      challengeId: req.body?.challengeId,
      walletAddress: req.body?.walletAddress,
      publicKey: req.body?.publicKey,
      signature: req.body?.signature,
      telegramInitData: req.body?.telegramInitData || "",
    });

    // sameSite: "none" é necessário para cookies dentro de iframe do Telegram WebApp.
    // "lax" bloqueia cookies cross-site (iframe), impossibilitando sessões no Telegram.
    setSessionCookie(res, session.token);

    res.json({
      success: true,
      session,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─── QR Deep Link Endpoints ──────────────────────────────────────────────────

app.post("/auth/qr/generate", authLimiter, async (req, res) => {
  try {
    const sessionData = await generateQrSession();
    res.json({ success: true, ...sessionData });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/auth/qr/status/:sessionId", async (req, res) => {
  try {
    const statusData = await getQrSessionStatus(req.params.sessionId);
    if (statusData?.status === "done" && statusData?.sessionToken) {
      setSessionCookie(res, statusData.sessionToken);
    }
    res.json({ success: true, ...statusData });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/auth/qr/webhook/:sessionId", async (req, res) => {
  if (config.isProduction && !process.env.QR_WEBHOOK_SECRET) {
    return res.status(404).json({ error: "Not found." }); // ocultar em prod
  }

  if (config.isProduction) {
    const appSecret = req.headers["x-app-webhook-secret"];
    if (!appSecret || appSecret !== process.env.QR_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Webhook não autorizado." });
    }
  }

  try {
    // In a real implementation this endpoint is called by the Mobile App via webhook.
    // It would contain a signed payload. For the mock, we assume the payload is correct.
    const result = await processQrWebhook({
      sessionId: req.params.sessionId,
      walletAddress: req.body?.walletAddress,
      publicKey: req.body?.publicKey,
      signature: req.body?.signature,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

app.get("/auth/session", async (req, res) => {
  const sessionToken = extractSessionToken(req);
  const session = await touchSession(sessionToken);

  if (!session) {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }

  return res.json({
    success: true,
    session,
  });
});

app.post("/auth/logout", async (req, res) => {
  const sessionToken = extractSessionToken(req);
  const revoked = await revokeSession(sessionToken);

  res.clearCookie("sessionToken", {
    path: "/",
    sameSite: config.isProduction ? "none" : "lax",
    secure: config.isProduction,
  });

  res.json({
    success: revoked,
  });
});



// Security Engine — anomalies and viral ranking from real database data
app.use("/admin/security", requireSecurityAdmin, require("./security"));

app.get("/tokens/viral", async (req, res) => {
  try {
    const launches = await listPublicLaunches(10);
    res.json({
      success: true,
      ranking: launches.map((launch) => ({
        id: launch.id,
        name: launch.launchRequest?.coin?.name || "",
        symbol: launch.launchRequest?.coin?.symbol || "",
        riskScore: launch.riskProfile?.score || 0,
        createdAt: launch.createdAt,
        status: launch.status,
      })),
      source: "database",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/verify-payment", paymentLimiter, requireSession, async (req, res) => {
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
          : "";

    if (!walletAddress) {
      throw new Error("Sessão inválida para validar pagamento.");
    }

    if (walletFromBody && walletFromBody !== walletAddress) {
      throw new Error("walletAddress no payload diverge da sessão autenticada.");
    }

    if (!txHash || !tokenSymbol) {
      throw new Error("txHash e tokenSymbol são obrigatórios.");
    }

    const payment = await verifyPayment({
      walletAddress,
      txHash,
      tokenSymbol,
    });

    verifiedPaymentsCache.set(txHash, { payment, timestamp: Date.now() });

    res.json({
      success: true,
      verifiedAt: new Date().toISOString(),
      payment,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/shell-buy/verify", paymentLimiter, requireSession, async (req, res) => {
  try {
    if (!config.shellBuy.enabled) {
      return res.status(503).json({
        error: "Compra de SHELL via USDC está desativada no backend.",
      });
    }

    if (!config.shellBuy.usdcRecipientConfigured) {
      return res.status(503).json({
        error: "Destino USDC da compra de SHELL não está configurado no backend.",
      });
    }

    if (!isTip3DecoderAvailable()) {
      return res.status(503).json({
        error:
          "Validação TIP-3 indisponível no backend. Não é possível confirmar pagamentos USDC.",
      });
    }

    const walletAddress = String(req.session?.walletAddress || "").trim();
    const txHash = String(req.body?.txHash || "").trim();

    if (!walletAddress) {
      throw new Error("Sessão inválida para validar compra de SHELL.");
    }

    if (!txHash) {
      throw new Error("txHash é obrigatório para validar compra de SHELL.");
    }

    const existingOrder = await getShellBuyOrderByTxHash(txHash);
    if (existingOrder) {
      if (existingOrder.walletAddress !== walletAddress.toLowerCase()) {
        throw new Error("Este txHash já foi validado para outra wallet.");
      }

      return res.json({
        success: true,
        duplicate: true,
        order: existingOrder,
      });
    }

    const payment = await getTip3TransferPayment({
      txHash,
      senderWallet: walletAddress,
      recipientWallet: config.shellBuy.usdcRecipient,
      decimals: config.shellBuy.usdcDecimals,
    });

    if (!payment) {
      throw new Error(
        "Não foi encontrada transferência TIP-3 USDC válida para o endereço configurado.",
      );
    }

    if (Number(payment.amount) < config.shellBuy.minUsdcAmount) {
      throw new Error(
        `Valor USDC insuficiente. Mínimo: ${config.shellBuy.minUsdcAmount} USDC.`,
      );
    }

    const shellAmount = calcShellAmountFromUsdc(payment.amount);
    if (!shellAmount) {
      throw new Error("Falha ao calcular quantidade de SHELL a partir do pagamento USDC.");
    }

    const nowIso = new Date().toISOString();
    const order = {
      id: crypto.randomUUID(),
      walletAddress,
      txHash,
      usdcAmount: Number(payment.amount),
      shellAmount,
      usdcRecipient: config.shellBuy.usdcRecipient,
      status: "payment_confirmed_waiting_settlement",
      paymentProof: {
        sender: payment.sender,
        recipient: payment.recipient,
        rawAmount: payment.rawAmount,
        decimals: payment.decimals,
        proof: payment.proof || {},
      },
      note:
        "Pagamento USDC confirmado. O settlement de SHELL depende do Accumulator/Exchange.",
      createdAt: nowIso,
      updatedAt: nowIso,
      onChainVerifiedAt: nowIso,
    };

    try {
      await createShellBuyOrder(order);
    } catch (dbError) {
      if (dbError && dbError.code === "23505") {
        const concurrentOrder = await getShellBuyOrderByTxHash(txHash);
        if (concurrentOrder) {
          if (concurrentOrder.walletAddress !== walletAddress.toLowerCase()) {
            throw new Error("Este txHash já foi validado para outra wallet.");
          }
          return res.json({
            success: true,
            duplicate: true,
            order: concurrentOrder,
          });
        }
      }
      throw dbError;
    }

    res.json({
      success: true,
      verifiedAt: nowIso,
      order,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/shell-buy/my-orders", requireSession, async (req, res) => {
  try {
    const orders = await listShellBuyOrdersByWallet(req.session.walletAddress, 30);
    res.json({ success: true, orders });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/shell-buy/order/:id", requireSession, async (req, res) => {
  try {
    const order = await getShellBuyOrderById(req.params.id);
    if (!order || order.walletAddress !== String(req.session.walletAddress || "").toLowerCase()) {
      return res.status(404).json({ error: "Pedido não encontrado." });
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/launch-request", requireSession, async (req, res) => {
  let txHashReserved = false;
  let reservedTxHash = "";

  try {
    if (config.isProduction && !config.feeWalletConfigured) {
      return res.status(503).json({ 
        error: "Launchpad inoperante: FEE_WALLET não configurada para receber taxas de lançamento na Mainnet." 
      });
    }

    const launchRequest = normalizeLaunchRequest(req.body, req.session);

    // A-07: Reordered checks — verify payment FIRST, then check balance.
    // Original order rejected users who paid the fee but had low remaining balance,
    // which was confusing. Now we confirm payment was valid before checking gas.

    // ── Rate limit: 1 token per wallet per hour (persistent) ─────────────────
    await checkWalletRateLimit(launchRequest.creator.wallet);

    // ── Duplicate txHash guard with reservation (persistent + race-safe) ────
    const reserved = await reserveTxHash(
      launchRequest.payment.txHash,
      launchRequest.creator.wallet,
    );
    if (!reserved) {
      throw new Error("Este txHash já foi utilizado para criar outro token. Use uma nova transação.");
    }
    txHashReserved = true;
    reservedTxHash = launchRequest.payment.txHash;

    // ── Verify payment FIRST (A-07) ──────────────────────────────────────────
    let payment;
    const cached = verifiedPaymentsCache.get(launchRequest.payment.txHash);
    if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
      payment = cached.payment;
      verifiedPaymentsCache.delete(launchRequest.payment.txHash);
    } else {
      payment = await verifyPayment({
        walletAddress: launchRequest.creator.wallet,
        txHash: launchRequest.payment.txHash,
        tokenSymbol: launchRequest.payment.tokenSymbol,
      });
    }

    // ── Creator must keep enough SHELL for chain deployment costs (after payment confirmed) ──
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

    // ── Phase 2: On-chain Automation & IPFS ──────────────────────────────────
    console.log(`[Launch] Iniciando automação on-chain para ${launchTicket.id}`);
    
    // 1. Upload Metadata to IPFS
    const metadata = createTokenMetadata(launchRequest);
    const ipfsHash = await uploadToIPFS(metadata);
    
    // 2. Trigger On-chain Deployment
    const deployResult = await deployTokenEcosystem({
      name: launchRequest.coin.name,
      symbol: launchRequest.coin.symbol,
      totalSupply: launchRequest.coin.totalSupply,
      ipfsHash: ipfsHash,
      creatorWallet: launchRequest.creator.wallet,
      paymentTxHash: launchRequest.payment.txHash,
    });

    // 3. Attach on-chain data to ticket
    launchTicket.onchainData = {
      ipfsHash,
      tokenRootAddress: deployResult.tokenRoot,
      bondingCurveAddress: deployResult.bondingCurve,
      deployStatus: deployResult.status,
      deployReason: deployResult.reason || "",
    };

    if (deployResult.status === "deployed") {
      launchTicket.status = "on_chain_deployed";
      launchTicket.mintingAvailable = true;
      launchTicket.note = `Token criado com sucesso no IPFS (${ipfsHash}) e instanciado na Acki Nacki.`;
    } else {
      launchTicket.status = "payment_verified_waiting_blockchain_integration";
      launchTicket.mintingAvailable = false;
      launchTicket.note =
        `Pagamento verificado e metadata em IPFS (${ipfsHash}). ` +
        `Deploy on-chain: ${deployResult.status}` +
        (deployResult.reason ? ` — ${deployResult.reason}` : ".");
    }

    await createLaunchBundle({

      launchTicket,
      auditEvent: {
        id: launchTicket.id,
        type: "launch.created",
        createdAt: new Date().toISOString(),
        walletAddress: launchRequest.creator.wallet,
        launchId: launchTicket.id,
        payload: {},
      },
    });

    // Persist rate limit after successful creation (txHash already reserved)
    await updateWalletLastLaunch(launchRequest.creator.wallet);

    res.json({
      success: true,
      launchRequest: launchTicket,
    });
  } catch (error) {
    if (txHashReserved && reservedTxHash) {
      await releaseTxHashReservation(reservedTxHash).catch(() => {});
    }
    res.status(400).json({ error: error.message });
  }
});

app.get("/launches/my", requireSession, (req, res) => {
  listLaunchesByWallet(req.session.walletAddress)
    .then((launches) => {
      res.json({
        success: true,
        launches,
      });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

app.get("/launches/public", (_, res) => {
  listPublicLaunches(30)
    .then((launches) => {
      res.json({
        success: true,
        launches: launches.map((launch) => ({
          id: launch.id,
          status: launch.status,
          createdAt: launch.createdAt,
          creatorWallet: launch.launchRequest.creator.wallet,
          coin: {
            name: launch.launchRequest.coin.name,
            symbol: launch.launchRequest.coin.symbol,
            tagline: launch.launchRequest.coin.tagline,
            description: launch.launchRequest.coin.description,
            totalSupply: launch.launchRequest.coin.totalSupply,
            logoUrl: launch.launchRequest.coin.logoUrl,
          },
          links: launch.launchRequest.links,
          protocol: launch.launchRequest.protocol,
          treasuryPayment: {
            tokenSymbol: launch.treasuryPayment.tokenSymbol,
            amount: launch.treasuryPayment.amount,
          },
          riskProfile: {
            status: launch.riskProfile.status,
            score: launch.riskProfile.score,
          },
          onchainData: {
            ipfsHash: launch.ipfsHash,
            tokenRootAddress: launch.tokenRootAddress,
            bondingCurveAddress: launch.bondingCurveAddress,
            // M-03: Expose real deployStatus from onchainData instead of
            // binary deployed/pending mapping. This preserves intermediate states like
            // 'awaiting_chain_integration', 'pending_deployer_configuration', 'deploy_error'
            deployStatus: launch.onchainData?.deployStatus || 
                          (launch.status === "on_chain_deployed" ? "deployed" : "pending"),
            reserveBalance: launch.onchainData?.reserveBalance || "0",
            tokenSupply: launch.onchainData?.tokenSupply || "0",
            lockedLiquidity: launch.onchainData?.lockedLiquidity || false,
            updatedAt: launch.onchainData?.updatedAt || null,
          },
        })),

      });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

// ── GET single token by ID (direct query — no full table scan) ───────────────
app.get("/launches/:id", async (req, res) => {
  try {
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
          // M-03: Expose real deployStatus
          deployStatus: found.onchainData?.deployStatus || 
                        (found.status === "on_chain_deployed" ? "deployed" : "pending"),
          reserveBalance: found.onchainData?.reserveBalance || "0",
          tokenSupply: found.onchainData?.tokenSupply || "0",
          lockedLiquidity: found.onchainData?.lockedLiquidity || false,
          updatedAt: found.onchainData?.updatedAt || null,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ── Comments API (Feature: Chat) ──────────────────────────────────────────────
app.get("/launches/:id/comments", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const comments = await getCommentsByLaunchId(req.params.id, limit);
    res.json({ success: true, comments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const commentRateLimits = new Map();

app.post("/launches/:id/comments", requireSession, async (req, res) => {
  try {
    const wallet = req.session.walletAddress;
    const now = Date.now();
    const lastCommentTime = commentRateLimits.get(wallet) || 0;
    
    // DESIGN-5: Rate limit (1 comment per 30s per wallet)
    if (now - lastCommentTime < 30000) {
      return res.status(429).json({ error: "Aguarde 30 segundos antes de postar outro comentário." });
    }

    const content = String(req.body.content || "").trim();
    
    if (!content || content.length > 500) {
      return res.status(400).json({ error: "Comentário deve ter entre 1 e 500 caracteres." });
    }

    // DESIGN-5: Basic URL/link filtering to prevent spam/phishing
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)/i;
    if (urlRegex.test(content)) {
      return res.status(400).json({ error: "Links não são permitidos nos comentários por segurança." });
    }

    commentRateLimits.set(wallet, now);

    const comment = {
      id: crypto.randomUUID(),
      launchId: req.params.id,
      walletAddress: req.session.walletAddress,
      content,
      createdAt: new Date().toISOString()
    };

    const savedComment = await addComment(comment);
    res.json({ success: true, comment: savedComment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── GET wallet SHELL balance (for UI pre-flight check) ───────────────────────
app.get("/wallet/:address/balance", async (req, res) => {
  try {
    const balance = await getAccountBalance(req.params.address);
    if (!balance) return res.status(404).json({ error: "Conta não encontrada na Acki Nacki." });
    res.json({ success: true, balance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});



async function start() {
  // 1. Validate Config first
  validateConfig();

  // 2. Database
  await pingDatabase();
  await runMigrations();

  if (!isTip3DecoderAvailable()) {
    console.warn("[Config] Decoder TIP-3 indisponível. Validação de pagamento USDC ficará bloqueada.");
  }
  if (config.shellBuy.enabled && !config.shellBuy.usdcRecipientConfigured) {
    console.warn(
      "[Config] ENABLE_SHELL_BUY está ativo, mas SHELL_BUY_USDC_RECIPIENT é inválido.",
    );
  }

  const server = app.listen(config.port, () => {
    console.log(`Backend running on port ${config.port} (Production: ${config.isProduction})`);
    // Start background jobs
    startSyncJob();
  });

  // 3. Graceful Shutdown
  const shutdown = async (signal) => {
    console.log(`\n[Server] ${signal} received. Closing resources...`);
    
    // Stop sync job
    stopSyncJob();

    // Stop accepting new connections
    server.close(() => {
      console.log("[Server] Connection pool closed.");
    });

    // Close DB pool
    try {
      await pool.end();
      console.log("[Database] Pool closed.");
    } catch (err) {
      console.error("[Database] Error closing pool:", err.message);
    }

    console.log("[Server] Shutdown complete. Bye!\n");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
