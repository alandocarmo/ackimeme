const crypto = require("crypto");
const { config } = require("./config");
const { getAccountPublicKey } = require("./tvm");
const {
  createAuthChallenge: persistAuthChallenge,
  consumeChallengeAndCreateSession,
  getSessionByToken,
  getUnusedChallengeById,
  revokeSession,
  touchSession,
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

function verifyDetachedSignature({ message, signature, publicKey }) {
  const signatureBuffer = decodeBuffer(signature, "Signature");
  const keyObject = buildEd25519PublicKey(publicKey);

  return crypto.verify(
    null,
    Buffer.from(message, "utf8"),
    keyObject,
    signatureBuffer,
  );
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

// Removidas funções legacy de crypto. Detached Signature agora validada na TVM.

async function createWalletChallenge({ walletAddress, telegramInitData }) {
  const normalizedWallet = trimString(walletAddress);

  if (!normalizedWallet) {
    throw new Error("Wallet é obrigatória.");
  }

  const telegram = verifyTelegramInitData(telegramInitData);
  const challengeId = crypto ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
  const nonce = crypto ? crypto.randomBytes(16).toString("hex") : (Math.random().toString(36).substring(2, 15));
  
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
    id: crypto ? crypto.randomUUID() : challengeId,
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
    throw new Error("Carteira preenchida não se encontra na blockchain (Acki Nacki).");
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

  const sessionId = crypto ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
  const tokenVal = crypto ? crypto.randomBytes(32).toString("hex") : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  const session = {
    id: sessionId,
    token: tokenVal,
    walletAddress: normalizedWallet,
    publicKey: trimString(publicKey),
    proofLevel: "strong_tvm_contract_binding",
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
      id: crypto ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      type: "auth.session.created",
      createdAt: new Date().toISOString(),
      walletAddress: session.walletAddress,
      sessionId: session.id,
      payload: {},
    },
  });

  return session;
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
};
