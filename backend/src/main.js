const { randomUUID } = require("crypto");
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
  normalizeProjectContentUpdateInput,
  normalizeProjectInput,
  normalizeProjectStatusUpdate,
  normalizeSubmissionInput,
  normalizeSubmissionModerationInput,
  normalizeTaskContentUpdateInput,
  normalizeTaskStatusUpdate,
  normalizeTaskInput,
} = require("./launchpad");
const { createLaunchTicket, normalizeLaunchRequest } = require("./launches");
const { verifyPayment } = require("./payments");
const { createInitialRiskProfile } = require("./risk");
const {
  createLaunchBundle,
  createLaunchpadProject,
  createLaunchpadTask,
  createLaunchpadTaskSubmission,
  getPublicLaunchpadProjectBySlug,
  getAdminOverview,
  getLaunchById,
  isTxHashUsed,
  markTxHashUsed,
  getWalletLastLaunch,
  updateWalletLastLaunch,
  listAdminLaunchpadProjects,
  listAdminLaunchpadSubmissions,
  listAllLaunches,
  listMyLaunchpadSubmissions,
  listLaunchesByWallet,
  listPublicLaunchpadProjects,
  listPublicLaunches,
  moderateLaunchpadSubmission,
  updateLaunchpadProjectContent,
  updateLaunchpadProjectStatus,
  updateLaunchpadTaskContent,
  updateLaunchpadTaskStatus,
} = require("./storage");
const { createTreasuryPaymentRecord } = require("./treasury");
const { getAccountBalance } = require("./services/graphql.service");
const { uploadToIPFS, createTokenMetadata } = require("./services/ipfs.service");
const { deployTokenEcosystem } = require("./services/deployer.service");


// ─── Rate Limit & txHash: now persistent in PostgreSQL ───────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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

// ─── Admin unlock JWT secret ──────────────────────────────────────────────────
const ADMIN_MASTER_PASSWORD = config.adminToken; // reuse ADMIN_TOKEN as master password

function signAdminJwt(walletAddress) {
  // Simple HMAC-based token (no jwt lib needed): header.payload.sig
  const payload = Buffer.from(JSON.stringify({
    w: walletAddress,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1h
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", ADMIN_MASTER_PASSWORD)
    .update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyAdminJwt(token) {
  try {
    const [payload, sig] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", ADMIN_MASTER_PASSWORD)
      .update(payload).digest("base64url");
    if (sig !== expectedSig) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowAll =
    config.allowedOrigins.length === 0 || config.allowedOrigins.includes("*");

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

function isAdminWallet(walletAddress) {
  return config.adminWallets.includes(String(walletAddress || "").trim().toLowerCase());
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

async function requireAdmin(req, res, next) {
  const adminToken = typeof req.headers["x-admin-token"] === "string"
    ? req.headers["x-admin-token"]
    : "";
  const sessionToken = extractBearerToken(req.headers.authorization);
  const session = sessionToken ? await touchSession(sessionToken) : null;
  const walletAllowed = Boolean(session?.walletAddress) && isAdminWallet(session.walletAddress);
  const tokenAllowed = Boolean(config.adminToken) && adminToken === config.adminToken;

  if (!config.adminToken && config.adminWallets.length === 0) {
    return res.status(503).json({
      error: "Configure ADMIN_WALLETS ou ADMIN_TOKEN no backend.",
    });
  }

  if (!walletAllowed && !tokenAllowed) {
    return res.status(401).json({
      error: "Acesso admin negado. Use wallet autorizada ou ADMIN_TOKEN válido.",
    });
  }

  req.admin = {
    authMode: walletAllowed ? "wallet_session" : "admin_token",
    session,
    walletAddress: session?.walletAddress || "",
  };

  return next();
}

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
      res.json({
        ok: true,
        checks: {
          databaseConfigured: Boolean(config.databaseUrl),
          databaseReachable: true,
          graphqlConfigured: Boolean(config.graphqlUrl),
          feeWalletConfigured: Boolean(config.feeWallet),
          adminTokenConfigured: Boolean(config.adminToken),
          storageProvider: "postgres",
        },
      });
    })
    .catch(() => {
      res.status(503).json({
        ok: false,
        checks: {
          databaseConfigured: Boolean(config.databaseUrl),
          databaseReachable: false,
          graphqlConfigured: Boolean(config.graphqlUrl),
          feeWalletConfigured: Boolean(config.feeWallet),
          adminTokenConfigured: Boolean(config.adminToken),
          storageProvider: "postgres",
        },
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

// ── Admin unlock: verify master password, return short-lived JWT ──────────────
app.post("/admin/unlock", async (req, res) => {
  try {
    const { password, walletAddress } = req.body || {};
    if (!ADMIN_MASTER_PASSWORD) {
      return res.status(503).json({ error: "ADMIN_TOKEN não configurado no backend." });
    }
    if (!password || password !== ADMIN_MASTER_PASSWORD) {
      return res.status(401).json({ error: "Senha incorreta." });
    }
    // Optionally check wallet too
    const wallet = String(walletAddress || "").toLowerCase();
    const walletOk = config.adminWallets.length === 0 || config.adminWallets.includes(wallet);
    if (!walletOk) {
      return res.status(401).json({ error: "Wallet não autorizada como admin." });
    }
    const adminJwt = signAdminJwt(wallet);
    return res.json({ success: true, adminJwt });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── Admin JWT middleware (alternative to X-Admin-Token) ───────────────────────
async function requireAdminJwt(req, res, next) {
  const authHeader = req.headers["x-admin-jwt"] || "";
  const data = verifyAdminJwt(authHeader);
  if (data) {
    req.admin = { authMode: "admin_jwt", walletAddress: data.w };
    return next();
  }
  // Fallback to existing requireAdmin
  return requireAdmin(req, res, next);
}

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
    const launchRequest = normalizeLaunchRequest(req.body, req.session);

    // ── Rate limit: 1 token per wallet per hour (persistent) ─────────────────
    await checkWalletRateLimit(launchRequest.creator.wallet);

    // ── Duplicate txHash guard (persistent) ──────────────────────────────────
    await checkTxHashDuplicate(launchRequest.payment.txHash);

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

    if (deployResult.status === "on_chain_init" || deployResult.status === "deployed") {
      launchTicket.status = "on_chain_deployed";
      launchTicket.mintingAvailable = true;
      launchTicket.note = `Token criado com sucesso no IPFS (${ipfsHash}) e instanciado na Acki Nacki.`;
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

app.get("/launchpad/projects", (_, res) => {
  listPublicLaunchpadProjects(6)
    .then((projects) => {
      res.json({
        success: true,
        projects,
      });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

app.get("/launchpad/projects/:slug", async (req, res) => {
  try {
    const session = await getOptionalSession(req);
    const detail = await getPublicLaunchpadProjectBySlug(
      req.params.slug,
      session?.walletAddress || "",
    );

    if (!detail) {
      return res.status(404).json({ error: "Campanha exclusiva não encontrada." });
    }

    return res.json({
      success: true,
      project: detail.project,
      viewer: detail.viewer,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/launchpad/submissions/my", requireSession, (req, res) => {
  listMyLaunchpadSubmissions(req.session.walletAddress)
    .then((submissions) => {
      res.json({
        success: true,
        submissions,
      });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

app.post("/launchpad/tasks/:taskId/submit", requireSession, async (req, res) => {
  try {
    const submission = normalizeSubmissionInput(req.body, req.session);
    const storedSubmission = await createLaunchpadTaskSubmission({
      projectId: typeof req.body?.projectId === "string" ? req.body.projectId.trim() : "",
      taskId: req.params.taskId,
      submission,
      auditEvent: {
        id: submission.id,
        type: "launchpad.submission.upserted",
        createdAt: new Date().toISOString(),
        walletAddress: req.session.walletAddress,
        payload: {
          taskId: req.params.taskId,
        },
      },
    });

    res.json({
      success: true,
      submission: storedSubmission,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/admin/overview", requireAdmin, (_, res) => {
  getAdminOverview()
    .then((overview) => {
      res.json({
        success: true,
        overview,
      });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

app.get("/admin/access", requireAdmin, (req, res) => {
  res.json({
    success: true,
    access: {
      authMode: req.admin.authMode,
      walletAddress: req.admin.walletAddress,
    },
  });
});

app.get("/admin/launchpad/projects", requireAdmin, (_, res) => {
  listAdminLaunchpadProjects()
    .then((projects) => {
      res.json({
        success: true,
        projects,
      });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

app.get("/admin/launchpad/submissions", requireAdmin, (_, res) => {
  listAdminLaunchpadSubmissions()
    .then((submissions) => {
      res.json({
        success: true,
        submissions,
      });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

app.post("/admin/launchpad/projects", requireAdmin, async (req, res) => {
  try {
    const project = normalizeProjectInput(req.body);
    await createLaunchpadProject({
      project,
      auditEvent: {
        id: project.id,
        type: "launchpad.project.created",
        createdAt: new Date().toISOString(),
        payload: {
          projectId: project.id,
          slug: project.slug,
        },
      },
    });

    res.json({
      success: true,
      project,
    });
  } catch (error) {
    res.status(400).json({
      error:
        error.code === "23505" ? "Slug do projeto exclusivo já existe." : error.message,
    });
  }
});

app.patch("/admin/launchpad/projects/:projectId", requireAdmin, async (req, res) => {
  try {
    const update = normalizeProjectStatusUpdate(req.body);
    const project = await updateLaunchpadProjectStatus({
      projectId: req.params.projectId,
      status: update.status,
      updatedBy: req.admin.walletAddress || req.admin.authMode,
      auditEvent: {
        id: randomUUID(),
        type: "launchpad.project.status_updated",
        createdAt: new Date().toISOString(),
        payload: {
          projectId: req.params.projectId,
          status: update.status,
        },
      },
    });

    res.json({
      success: true,
      project,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/admin/launchpad/projects/:projectId/content", requireAdmin, async (req, res) => {
  try {
    const content = normalizeProjectContentUpdateInput(req.body);
    const project = await updateLaunchpadProjectContent({
      projectId: req.params.projectId,
      content,
      updatedBy: req.admin.walletAddress || req.admin.authMode,
      auditEvent: {
        id: randomUUID(),
        type: "launchpad.project.content_updated",
        createdAt: new Date().toISOString(),
        payload: {
          projectId: req.params.projectId,
          slug: content.slug,
        },
      },
    });

    res.json({
      success: true,
      project,
    });
  } catch (error) {
    res.status(400).json({
      error:
        error.code === "23505" ? "Slug do projeto exclusivo já existe." : error.message,
    });
  }
});

app.post("/admin/launchpad/projects/:projectId/tasks", requireAdmin, async (req, res) => {
  try {
    const task = normalizeTaskInput(req.body);
    const storedTask = await createLaunchpadTask({
      projectId: req.params.projectId,
      task,
      auditEvent: {
        id: task.id,
        type: "launchpad.task.created",
        createdAt: new Date().toISOString(),
        payload: {
          projectId: req.params.projectId,
          taskId: task.id,
        },
      },
    });

    res.json({
      success: true,
      task: storedTask,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/admin/launchpad/tasks/:taskId/content", requireAdmin, async (req, res) => {
  try {
    const content = normalizeTaskContentUpdateInput(req.body);
    const task = await updateLaunchpadTaskContent({
      taskId: req.params.taskId,
      content,
      updatedBy: req.admin.walletAddress || req.admin.authMode,
      auditEvent: {
        id: randomUUID(),
        type: "launchpad.task.content_updated",
        createdAt: new Date().toISOString(),
        payload: {
          taskId: req.params.taskId,
        },
      },
    });

    res.json({
      success: true,
      task,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/admin/launchpad/tasks/:taskId", requireAdmin, async (req, res) => {
  try {
    const update = normalizeTaskStatusUpdate(req.body);
    const task = await updateLaunchpadTaskStatus({
      taskId: req.params.taskId,
      status: update.status,
      updatedBy: req.admin.walletAddress || req.admin.authMode,
      auditEvent: {
        id: randomUUID(),
        type: "launchpad.task.status_updated",
        createdAt: new Date().toISOString(),
        payload: {
          taskId: req.params.taskId,
          status: update.status,
        },
      },
    });

    res.json({
      success: true,
      task,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/admin/launchpad/submissions/:submissionId", requireAdmin, async (req, res) => {
  try {
    const moderation = normalizeSubmissionModerationInput(req.body);
    const submission = await moderateLaunchpadSubmission({
      submissionId: req.params.submissionId,
      status: moderation.status,
      reviewNote: moderation.reviewNote,
      reviewedBy: req.admin.walletAddress || moderation.reviewedBy,
      reviewedAt: moderation.reviewedAt,
      auditEvent: {
        id: randomUUID(),
        type: "launchpad.submission.moderated",
        createdAt: new Date().toISOString(),
        payload: {
          submissionId: req.params.submissionId,
          status: moderation.status,
          reviewNote: moderation.reviewNote,
        },
      },
    });

    res.json({
      success: true,
      submission,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/admin/launches", requireAdmin, (_, res) => {
  listAllLaunches()
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

async function start() {
  await pingDatabase();
  await runMigrations();

  app.listen(config.port, () => {
    console.log(`Backend running on port ${config.port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
