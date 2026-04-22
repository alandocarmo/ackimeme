const crypto = require("crypto");
const { config } = require("./config");
const { getAccountPublicKey } = require("./services/graphql.service");
const { query } = require("./db");
const {
  createAuthChallenge: persistAuthChallenge,
  consumeChallengeAndCreateSession,
  getSessionByToken,
  getUnusedChallengeById,
  revokeSession,
  touchSession,
  createSessionOnly,
} = require("./storage");
const { verifyTelegramInitData } = require("./telegram");

const ED25519_SPKI_PREFIX = Buffer.from(
  "302a300506032b6570032100",
  "hex",
);

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function decodeBuffer(value, fieldName) {
  const normalized = trimString(value);

  if (!normalized) {
    throw new Error(`${fieldName} é obrigatório.`);
  }

  try {
    if (/^[0-9a-fA-F]+$/.test(normalized)) {
      return Buffer.from(normalized, "hex");
    }

    return Buffer.from(normalized, "base64");
  } catch (error) {
    throw new Error(`${fieldName} inválido.`);
  }
}

function buildEd25519PublicKey(publicKeyInput) {
  const rawPublicKey = decodeBuffer(publicKeyInput, "Public key");

  if (rawPublicKey.length === 32) {
    return {
      key: Buffer.concat([ED25519_SPKI_PREFIX, rawPublicKey]),
      format: "der",
      type: "spki",
    };
  }

  return {
    key: rawPublicKey,
    format: "der",
    type: "spki",
  };
}

// C-07: The everscale-inpage-provider signData() method hashes the data (SHA-256)
// before signing. So when verifying a signature from the extension wallet,
// we must hash the message first. For manual tvm-cli signatures, the raw
// message is signed directly. We try both modes.
function verifyDetachedSignature({ message, signature, publicKey }) {
  const signatureBuffer = decodeBuffer(signature, "Signature");
  const keyObject = buildEd25519PublicKey(publicKey);

  // Mode 1: Try raw UTF-8 verification (tvm-cli manual signing)
  const rawValid = crypto.verify(
    null,
    Buffer.from(message, "utf8"),
    keyObject,
    signatureBuffer,
  );
  if (rawValid) return true;

  // Mode 2: Try SHA-256 hashed verification (everscale-inpage-provider signData)
  // signData internally does: sign(sha256(base64_decode(data)))
  // The frontend sends btoa(challengeMsg) as data, so the provider signs sha256(challengeMsg_bytes)
  const hashedMessage = crypto.createHash("sha256").update(Buffer.from(message, "utf8")).digest();
  const hashedValid = crypto.verify(
    null,
    hashedMessage,
    keyObject,
    signatureBuffer,
  );
  return hashedValid;
}

function encodeChallengeMessage({
  challengeId,
  nonce,
  walletAddress,
  expiresAt,
  telegramUserId,
}) {
  return [
    "AckiMeme Wallet Login",
    "Action: login",
    `Network: ${config.network}`,
    `Challenge ID: ${challengeId}`,
    `Nonce: ${nonce}`,
    `Wallet: ${walletAddress}`,
    `Telegram User ID: ${telegramUserId || "unknown"}`,
    `Expires At: ${expiresAt}`,
  ].join("\n");
}

function encodeQrSessionMessage({ sessionId, walletAddress, expiresAt }) {
  return [
    "AckiMeme Wallet Login",
    "Action: qr_login",
    `Network: ${config.network}`,
    `Session ID: ${sessionId}`,
    `Wallet: ${walletAddress}`,
    `Expires At: ${expiresAt}`,
  ].join("\n");
}

// Removidas funções legacy de crypto. Detached Signature agora validada na TVM.

async function createWalletChallenge({ walletAddress, telegramInitData }) {
  const normalizedWallet = trimString(walletAddress);

  if (!normalizedWallet) {
    throw new Error("Wallet é obrigatória.");
  }

  const telegram = verifyTelegramInitData(telegramInitData);
  const challengeId = crypto.randomUUID();
  const nonce = crypto.randomBytes(16).toString("hex");
  
  const challenge = {
    id: challengeId,
    nonce: nonce,
    walletAddress: normalizedWallet,
    telegramBinding: {
      status: telegram.status,
      userId: telegram.user?.id ? String(telegram.user.id) : "",
      username: telegram.user?.username || "",
      firstName: telegram.user?.first_name || "",
    },
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(
      Date.now() + config.authChallengeTtlSeconds * 1000,
    ).toISOString(),
  };

  challenge.message = encodeChallengeMessage({
    challengeId: challenge.id,
    nonce: challenge.nonce,
    walletAddress: challenge.walletAddress,
    expiresAt: challenge.expiresAt,
    telegramUserId: challenge.telegramBinding.userId,
  });

  await persistAuthChallenge(challenge, {
    id: crypto.randomUUID(),
    type: "auth.challenge.created",
    createdAt: new Date().toISOString(),
    walletAddress: challenge.walletAddress,
    challengeId: challenge.id,
    payload: {},
  });

  return challenge;
}

async function verifyWalletChallenge({
  challengeId,
  walletAddress,
  publicKey,
  signature,
  telegramInitData,
}) {
  const normalizedWallet = trimString(walletAddress);
  const normalizedChallengeId = trimString(challengeId);

  if (!normalizedChallengeId || !normalizedWallet) {
    throw new Error("challengeId e wallet são obrigatórios.");
  }

  const telegram = verifyTelegramInitData(telegramInitData);
  const challenge = await getUnusedChallengeById(normalizedChallengeId);

  if (!challenge) {
    throw new Error("Challenge não encontrado ou já utilizado.");
  }

  if (challenge.walletAddress !== normalizedWallet) {
    throw new Error("Wallet divergente do challenge.");
  }

  if (Date.parse(challenge.expiresAt) <= Date.now()) {
    throw new Error("Challenge expirado.");
  }

  if (
    challenge.telegramBinding.userId &&
    challenge.telegramBinding.userId !== String(telegram.user?.id || "")
  ) {
    throw new Error("Sessão Telegram divergente do challenge original.");
  }

  // PROVA FORTE DA WALLET (Acki Nacki): Consulta on-chain para garantir consistência
  const walletProof = await getAccountPublicKey(normalizedWallet);
  if (!walletProof.isDeployed) {
    const reason = walletProof.reason || "Conta não encontrada ou não ativa.";
    throw new Error(`Carteira não encontrada na blockchain (Acki Nacki): ${reason}`);
  }

  // VINCULAÇÃO PUBLIC KEY ↔ WALLET (Segurança Crítica)
  // Compara a public key informada pelo usuário com a real da wallet na blockchain.
  // Sem isso, qualquer keypair Ed25519 pode se autenticar como qualquer wallet deployada.
  const normalizedInputKey = trimString(publicKey).toLowerCase();
  let proofLevel = "signature_only_until_wallet_contract_binding";

  if (walletProof.publicKey) {
    const normalizedOnChainKey = String(walletProof.publicKey).toLowerCase();
    if (normalizedInputKey !== normalizedOnChainKey) {
      throw new Error(
        "A public key informada não corresponde à public key da wallet na blockchain. " +
        "Certifique-se de usar a mesma chave que controla a carteira."
      );
    }
    proofLevel = "strong_tvm_contract_binding";
  } else {
    // Public key não pôde ser extraída da BOC — registrar aviso
    // A assinatura ainda será verificada, mas sem binding forte
    console.warn(
      `[Auth] Não foi possível extrair public key on-chain para ${normalizedWallet}. ` +
      `Proof level degradado para "signature_only_until_wallet_contract_binding". ` +
      `Verifique se nekoton-wasm está instalado corretamente.`
    );
  }

  // A-01: Bloqueia autenticação fraca (sem binding de publicKey) em produção.
  if (config.isProduction && proofLevel !== "strong_tvm_contract_binding") {
    throw new Error(
      "Em produção, a extração de chave pública on-chain é obrigatória " +
      "para prevenir impersonation. Instale nekoton-wasm ou @tvmsdk/core."
    );
  }

  // Verifica assinatura usando NodeJS Native Crypto para Ed25519 (Padrão TVM/Everscale)
  const signatureValid = verifyDetachedSignature({
    message: challenge.message,
    signature,
    publicKey,
  });

  if (!signatureValid) {
    throw new Error("Assinatura inválida no Ed25519. Verifique se public key corresponde.");
  }

  const sessionId = crypto.randomUUID();
  const tokenVal = crypto.randomBytes(32).toString("hex");

  const session = {
    id: sessionId,
    token: tokenVal,
    walletAddress: normalizedWallet,
    publicKey: trimString(publicKey),
    proofLevel,

    telegramBinding: {
      status: telegram.status,
      userId: telegram.user?.id ? String(telegram.user.id) : "",
      username: telegram.user?.username || "",
      firstName: telegram.user?.first_name || "",
    },
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(
      Date.now() + config.sessionTtlHours * 60 * 60 * 1000,
    ).toISOString(),
    lastSeenAt: new Date().toISOString(),
  };

  await consumeChallengeAndCreateSession({
    challengeId: normalizedChallengeId,
    session,
    auditEvent: {
      id: crypto.randomUUID(),
      type: "auth.session.created",
      createdAt: new Date().toISOString(),
      walletAddress: session.walletAddress,
      sessionId: session.id,
      payload: {},
    },
  });

  return session;
}

// ─── QR Code Auth (Deep Link Polling) ───────────────────────────────────────

async function generateQrSession() {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const baseUrl = (process.env.BACKEND_URL || process.env.API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const deepLink = `${baseUrl}/auth/qr/webhook/${sessionId}?expiresAt=${encodeURIComponent(expiresAt)}`;

  await query(`INSERT INTO qr_sessions (id, status, deep_link, expires_at) VALUES ($1, 'pending', $2, $3)`, [sessionId, deepLink, expiresAt]);

  return { sessionId, deepLink, expiresAt };
}

async function getQrSessionStatus(sessionId) {
  const res = await query(`SELECT * FROM qr_sessions WHERE id=$1`, [sessionId]);
  if (res.rowCount === 0) {
    return { status: 'expired' };
  }
  const session = res.rows[0];
  
  if (session.status === 'done') {
    // Return the token, then remove from DB to prevent replay
    await query(`DELETE FROM qr_sessions WHERE id=$1`, [sessionId]);
    return { status: 'done', sessionToken: session.session_token };
  }
  
  return { status: session.status };
}

async function processQrWebhook({ sessionId, walletAddress, publicKey, signature }) {
  const res = await query(`SELECT * FROM qr_sessions WHERE id=$1`, [sessionId]);
  if (res.rowCount === 0) {
    throw new Error("Sessão HTTP do QR Code expirada ou inválida.");
  }
  const sessionData = res.rows[0];
  if (sessionData.status !== 'pending') {
    throw new Error("Sessão HTTP do QR Code expirada ou inválida.");
  }
  
  const normalizedWallet = trimString(walletAddress);
  const normalizedKey = trimString(publicKey);
  const normalizedSignature = trimString(signature);
  const expiresAtIso = new Date(sessionData.expires_at).toISOString();

  if (!normalizedWallet) {
    throw new Error("walletAddress é obrigatório no webhook QR.");
  }

  let proofLevel = "qr_dev_unverified";

  if (normalizedKey && normalizedSignature) {
    const walletProof = await getAccountPublicKey(normalizedWallet);
    if (!walletProof.isDeployed) {
      throw new Error("Carteira informada no QR não está ativa na blockchain.");
    }

    if (!walletProof.publicKey) {
      throw new Error(
        "Não foi possível extrair a public key on-chain para validar o login por QR.",
      );
    }

    if (String(walletProof.publicKey).toLowerCase() !== normalizedKey.toLowerCase()) {
      throw new Error("Public key do webhook QR não corresponde à carteira on-chain.");
    }

    const qrMessage = encodeQrSessionMessage({
      sessionId,
      walletAddress: normalizedWallet,
      expiresAt: expiresAtIso,
    });

    const signatureValid = verifyDetachedSignature({
      message: qrMessage,
      signature: normalizedSignature,
      publicKey: normalizedKey,
    });

    if (!signatureValid) {
      throw new Error("Assinatura inválida no login por QR.");
    }

    proofLevel = "strong_tvm_contract_binding";
  } else if (config.isProduction) {
    throw new Error(
      "QR login em produção exige publicKey + signature para comprovar posse da carteira.",
    );
  }

  const realSessionId = crypto.randomUUID();
  const tokenVal = crypto.randomBytes(32).toString("hex");

  const session = {
    id: realSessionId,
    token: tokenVal,
    walletAddress: normalizedWallet,
    publicKey: normalizedKey || "qr_scan_no_key",
    proofLevel,
    telegramBinding: {
      status: "unbound",
      userId: "",
      username: "",
      firstName: "",
    },
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(
      Date.now() + config.sessionTtlHours * 60 * 60 * 1000,
    ).toISOString(),
    lastSeenAt: new Date().toISOString(),
  };

  await createSessionOnly({
    session,
    auditEvent: {
      id: crypto.randomUUID(),
      type: "auth.session.created_via_qr",
      createdAt: new Date().toISOString(),
      walletAddress: session.walletAddress,
      sessionId: session.id,
      payload: { qrSessionId: sessionId },
    },
  });

  // Mark as done so the frontend polling can pick it up
  await query(`UPDATE qr_sessions SET status='done', session_token=$1 WHERE id=$2`, [session.token, sessionId]);

  return { success: true };
}

async function getSessionFromToken(token) {
  return getSessionByToken(trimString(token));
}

module.exports = {
  createWalletChallenge,
  getSessionFromToken,
  revokeSession,
  touchSession,
  verifyWalletChallenge,
  generateQrSession,
  getQrSessionStatus,
  processQrWebhook,
};
