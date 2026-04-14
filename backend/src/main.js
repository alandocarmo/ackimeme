const crypto = require("crypto");
require("dotenv").config();
const express = require("express");
const { buildPublicConfig, config } = require("./config");
const { pingDatabase, runMigrations } = require("./db");
const {
  createWalletChallenge,
  revokeSession,
  touchSession,
  verifyWalletChallenge,
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
  isTxHashUsed,
  markTxHashUsed,
  updateWalletLastLaunch,
  listLaunchesByWallet,
  listPublicLaunches,
} = require("./storage");
const { createTreasuryPaymentRecord } = require("./treasury");
const {
  getAccountBalance,
  isTip3DecoderAvailable,
} = require("./services/graphql.service");
const { uploadToIPFS, createTokenMetadata } = require("./services/ipfs.service");
const { deployTokenEcosystem } = require("./services/deployer.service");


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

async function checkTxHashDuplicate(txHash) {
  const used = await isTxHashUsed(txHash);
  if (used) {
    throw new Error("Este txHash já foi utilizado para criar outro token. Use uma nova transação.");
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

function buildReadinessChecks(databaseReachable) {
  return {
    databaseConfigured: Boolean(config.databaseUrl),
    databaseReachable,
    graphqlConfigured: Boolean(config.graphqlUrl),
    tip3DecoderAvailable: isTip3DecoderAvailable(),
    feeWalletConfigured: config.feeWalletConfigured,
    adminTokenConfigured: config.adminTokenStrong,
    allowedOriginsConfigured:
      config.allowedOrigins.length > 0 && !hasWildcardOrigin,
    storageProvider: "postgres",
  };
}



const app = express();
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowAll = !config.isProduction &&
    (config.allowedOrigins.length === 0 || hasWildcardOrigin);

  if (allowAll) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

function extractBearerToken(headerValue) {
  if (typeof headerValue !== "string") {
    return "";
  }

  const [type, token] = headerValue.split(" ");
  return type === "Bearer" ? token : "";
}



async function getOptionalSession(req) {
  const sessionToken = extractBearerToken(req.headers.authorization);

  if (!sessionToken) {
    return null;
  }

  return touchSession(sessionToken);
}

async function requireSession(req, res, next) {
  const sessionToken = extractBearerToken(req.headers.authorization);
  const session = await touchSession(sessionToken);

  if (!session) {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }

  req.session = session;
  return next();
}



// ─── Admin Security Layer ──────────────────────────────────────────────────
const ADMIN_MASTER_PASSWORD = config.adminToken; // reuse ADMIN_TOKEN as master password

function signAdminJwt(walletAddress) {
  const payload = Buffer.from(JSON.stringify({ w: walletAddress })).toString("base64url");
  const sig = crypto.createHmac("sha256", ADMIN_MASTER_PASSWORD).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyAdminJwt(token) {
  try {
    const [payload, sig] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", ADMIN_MASTER_PASSWORD).update(payload).digest("base64url");
    if (sig !== expectedSig) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch { return null; }
}

async function requireSecurityAdmin(req, res, next) {
  const authHeader = req.headers["x-admin-jwt"] || "";
  const data = verifyAdminJwt(authHeader);
  if (data) {
    req.admin = { authMode: "admin_jwt", walletAddress: data.w };
    return next();
  }
  return res.status(401).json({ error: "Acesso admin de segurança negado." });
}

// ── Admin unlock: verify master password, return short-lived JWT ──────────────
app.post("/admin/unlock", async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!config.adminTokenStrong) return res.status(503).json({ error: "ADMIN_TOKEN não configurado com segurança no backend." });
    if (!password || password !== ADMIN_MASTER_PASSWORD) return res.status(401).json({ error: "Senha incorreta." });
    
    return res.json({ success: true, adminJwt: signAdminJwt("admin") });
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
          checks.feeWalletConfigured &&
          checks.adminTokenConfigured &&
          checks.allowedOriginsConfigured);

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

app.post("/auth/challenge", async (req, res) => {
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

app.post("/auth/verify", async (req, res) => {
  try {
    const session = await verifyWalletChallenge({
      challengeId: req.body?.challengeId,
      walletAddress: req.body?.walletAddress,
      publicKey: req.body?.publicKey,
      signature: req.body?.signature,
      telegramInitData: req.body?.telegramInitData || "",
    });

    res.json({
      success: true,
      session,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/auth/session", async (req, res) => {
  const sessionToken = extractBearerToken(req.headers.authorization);
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
  const sessionToken = extractBearerToken(req.headers.authorization);
  const revoked = await revokeSession(sessionToken);

  res.json({
    success: revoked,
  });
});



// Security Mock Engine
app.use("/admin/security", requireSecurityAdmin, require("./security"));

app.get("/tokens/viral", (req, res) => {
  res.json({
    success: true,
    ranking: [
      { id: "1", name: "Pepe TVM", symbol: "$PEPET", trendingScore: 99.5, speed: "+1400%", bubbleCluster: 8, contractStatus: "Renounced" },
      { id: "2", name: "Acki Dog", symbol: "$ACKIDOG", trendingScore: 88.2, speed: "+450%", bubbleCluster: 5, contractStatus: "Renounced" },
      { id: "3", name: "Shill Net", symbol: "$SHILL", trendingScore: 65.4, speed: "+120%", bubbleCluster: 3, contractStatus: "Renounced" }
    ]
  });
});

app.post("/verify-payment", async (req, res) => {
  try {
    const walletAddress =
      typeof req.body?.walletAddress === "string"
        ? req.body.walletAddress.trim()
        : typeof req.body?.wallet === "string"
          ? req.body.wallet.trim()
          : "";
    const txHash = typeof req.body?.txHash === "string" ? req.body.txHash.trim() : "";
    const tokenSymbol =
      typeof req.body?.tokenSymbol === "string"
        ? req.body.tokenSymbol.trim()
        : typeof req.body?.paymentTokenSymbol === "string"
          ? req.body.paymentTokenSymbol.trim()
          : "";

    if (!walletAddress || !txHash || !tokenSymbol) {
      throw new Error("walletAddress, txHash e tokenSymbol são obrigatórios.");
    }

    const payment = await verifyPayment({
      walletAddress,
      txHash,
      tokenSymbol,
    });

    res.json({
      success: true,
      verifiedAt: new Date().toISOString(),
      payment,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/launch-request", requireSession, async (req, res) => {
  try {
    if (config.isProduction && !config.feeWalletConfigured) {
      return res.status(503).json({ 
        error: "Launchpad inoperante: FEE_WALLET não configurada para receber taxas de lançamento na Mainnet." 
      });
    }

    const launchRequest = normalizeLaunchRequest(req.body, req.session);

    // ── Rate limit: 1 token per wallet per hour (persistent) ─────────────────
    await checkWalletRateLimit(launchRequest.creator.wallet);

    // ── Duplicate txHash guard (persistent) ──────────────────────────────────
    await checkTxHashDuplicate(launchRequest.payment.txHash);

    // ── Creator must keep enough SHELL for chain deployment costs ────────────
    await ensureCreatorHasShellBalance(launchRequest.creator.wallet);

    const payment = await verifyPayment({
      walletAddress: launchRequest.creator.wallet,
      txHash: launchRequest.payment.txHash,
      tokenSymbol: launchRequest.payment.tokenSymbol,
    });

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
      creatorWallet: launchRequest.creator.wallet
    });

    // 3. Attach on-chain data to ticket
    launchTicket.onchainData = {
      ipfsHash,
      tokenRootAddress: deployResult.tokenRoot,
      bondingCurveAddress: deployResult.bondingCurve,
      deployStatus: deployResult.status
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
        `Deploy on-chain pendente (${deployResult.status}).`;
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

    // Persist rate limit and txHash after successful creation
    await markTxHashUsed(launchRequest.payment.txHash, launchRequest.creator.wallet);
    await updateWalletLastLaunch(launchRequest.creator.wallet);

    res.json({
      success: true,
      launchRequest: launchTicket,
    });
  } catch (error) {
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
            deployStatus: launch.status === "on_chain_deployed" ? "deployed" : "pending",
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
          deployStatus: found.status === "on_chain_deployed" ? "deployed" : "pending",
        },
      },
    });
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
  await pingDatabase();
  await runMigrations();

  if (!config.feeWalletConfigured) {
    console.warn("[Config] FEE_WALLET inválida ou placeholder. O fluxo de pagamento vai falhar.");
  }

  if (!isTip3DecoderAvailable()) {
    console.warn("[Config] Decoder TIP-3 indisponível. Validação de pagamento USDC ficará bloqueada.");
  }

  if (!config.adminTokenStrong) {
    console.warn("[Config] ADMIN_TOKEN fraco/inválido. Configure um segredo com 32+ caracteres.");
  }

  if (config.isProduction && (config.allowedOrigins.length === 0 || hasWildcardOrigin)) {
    console.warn("[Config] ALLOWED_ORIGINS ausente ou com '*'. Configure origens explícitas em produção.");
  }

  app.listen(config.port, () => {
    console.log(`Backend running on port ${config.port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
