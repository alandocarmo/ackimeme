import * as crypto from "crypto";
import { config } from "./config";
import { getAccountPublicKey } from "./services/graphql.service";
import { query } from "./db";
import {
  createAuthChallenge as persistAuthChallenge,
  consumeChallengeAndCreateSession,
  getUnusedChallengeById,
  revokeSession,
  touchSession,
  createSessionOnly,
  getSessionByToken,
} from "./storage";
import { verifyTelegramInitData } from "./telegram";

const ED25519_SPKI_PREFIX = Buffer.from(
  "302a300506032b6570032100",
  "hex",
);

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function decodeBuffer(value: unknown, fieldName: string): Buffer {
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

interface BuildPublicKeyResult {
  key: Buffer;
  format: "der";
  type: "spki";
}

function buildEd25519PublicKey(publicKeyInput: unknown): BuildPublicKeyResult {
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

interface VerifyDetachedSignatureParams {
  message: string;
  signature: string;
  publicKey: string;
}

function verifyDetachedSignature({ message, signature, publicKey }: VerifyDetachedSignatureParams): boolean {
  try {
    const signatureBuffer = decodeBuffer(signature, "Signature");
    const keyObject = buildEd25519PublicKey(publicKey);

    const rawValid = crypto.verify(
      null,
      Buffer.from(message, "utf8"),
      keyObject,
      signatureBuffer,
    );
    if (rawValid) return true;

    const hashedMessage = crypto.createHash("sha256").update(Buffer.from(message, "utf8")).digest();
    const hashedValid = crypto.verify(
      null,
      hashedMessage,
      keyObject,
      signatureBuffer,
    );
    return hashedValid;
  } catch (err) {
    return false;
  }
}

interface EncodeChallengeMessageParams {
  challengeId: string;
  nonce: string;
  walletAddress: string;
  expiresAt: string;
  telegramUserId?: string;
}

function encodeChallengeMessage({
  challengeId,
  nonce,
  walletAddress,
  expiresAt,
  telegramUserId,
}: EncodeChallengeMessageParams): string {
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

interface EncodeQrSessionMessageParams {
  sessionId: string;
  walletAddress: string;
  expiresAt: string;
}

function encodeQrSessionMessage({ sessionId, walletAddress, expiresAt }: EncodeQrSessionMessageParams): string {
  return [
    "AckiMeme Wallet Login",
    "Action: qr_login",
    `Network: ${config.network}`,
    `Session ID: ${sessionId}`,
    `Wallet: ${walletAddress}`,
    `Expires At: ${expiresAt}`,
  ].join("\n");
}

interface CreateWalletChallengeParams {
  walletAddress: string;
  telegramInitData: string;
}

export async function createWalletChallenge({ walletAddress, telegramInitData }: CreateWalletChallengeParams): Promise<Record<string, unknown>> {
  const normalizedWallet = trimString(walletAddress);

  if (!normalizedWallet) {
    throw new Error("Wallet é obrigatória.");
  }

  const telegram = verifyTelegramInitData(telegramInitData);
  
  if ((config as any).telegramBindingRequired && !telegram.user?.id) {
    throw new Error("A vinculação com o Telegram é obrigatória para usar este aplicativo.");
  }
  const challengeId = crypto.randomUUID();
  const nonce = crypto.randomBytes(16).toString("hex");
  
  const challenge: Record<string, unknown> = {
    id: challengeId,
    nonce: nonce,
    walletAddress: normalizedWallet,
    telegramBinding: telegram.user?.id ? {
      telegramId: Number(telegram.user.id),
      username: telegram.user?.username || "",
      firstName: telegram.user?.first_name || "",
    } : undefined,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(
      Date.now() + config.authChallengeTtlSeconds * 1000,
    ).toISOString(),
  };

  challenge.message = encodeChallengeMessage({
    challengeId: String(challenge.id),
    nonce: String(challenge.nonce),
    walletAddress: String(challenge.walletAddress),
    expiresAt: String(challenge.expiresAt),
    telegramUserId: challenge.telegramBinding ? String((challenge.telegramBinding as Record<string, unknown>).telegramId) : "",
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

interface VerifyWalletChallengeParams {
  challengeId: string;
  walletAddress: string;
  publicKey: string;
  signature: string;
  telegramInitData?: string;
}

export async function verifyWalletChallenge({
  challengeId,
  walletAddress,
  publicKey,
  signature,
  telegramInitData,
}: VerifyWalletChallengeParams): Promise<import("./types").Session> {
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
    challenge.telegramBinding &&
    (challenge.telegramBinding as Record<string, unknown>).telegramId &&
    String((challenge.telegramBinding as Record<string, unknown>).telegramId) !== String(telegram.user?.id || "")
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
    message: String(challenge.message),
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

    telegramBinding: telegram.user?.id ? {
      telegramId: Number(telegram.user.id),
      username: telegram.user?.username || "",
      firstName: telegram.user?.first_name || "",
    } : undefined,
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

export async function generateQrSession(): Promise<{ sessionId: string, authUrl: string, expiresAt: string }> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  
  // Padrão Acki Nacki para Telegram Bot
  const deepLink = `https://t.me/${config.telegramBotUsername}?start=${sessionId}`;

  await query(`INSERT INTO qr_sessions (id, status, deep_link, expires_at) VALUES ($1, 'pending', $2, $3)`, [sessionId, deepLink, expiresAt]);

  return { sessionId, authUrl: deepLink, expiresAt };
}

export async function getQrSessionStatus(sessionId: string): Promise<{ status: string, sessionToken?: string }> {
  // N6 FIX: Filter expired sessions in SQL so they return 'expired' immediately
  // instead of waiting for the cleanup cron (runs every 10 min)
  const res = await query(`SELECT * FROM qr_sessions WHERE id=$1 AND expires_at > NOW()`, [sessionId]);
  if ((res.rowCount ?? 0) === 0) {
    return { status: 'expired' };
  }
  const session = res.rows[0];
  
  if (session.status === 'done') {
    // Return the token atomically and remove from DB to prevent replay
    const delRes = await query(`DELETE FROM qr_sessions WHERE id=$1 AND status='done' RETURNING session_token`, [sessionId]);
    if ((delRes.rowCount ?? 0) === 0) {
      return { status: 'expired' };
    }
    return { status: 'done', sessionToken: delRes.rows[0].session_token };
  }
  
  return { status: session.status };
}

interface ProcessQrWebhookParams {
  sessionId: string;
  walletAddress: string;
  publicKey: string;
  signature: string;
}

export async function processQrWebhook({ sessionId, walletAddress, publicKey, signature }: ProcessQrWebhookParams): Promise<{ success: boolean }> {
  // N7 FIX: Atomic claim — prevents race condition on webhook retries.
  // Uses UPDATE ... WHERE status='pending' as optimistic lock instead of SELECT + UPDATE.
  const claimRes = await query(
    `UPDATE qr_sessions SET status='processing' WHERE id=$1 AND status='pending' AND expires_at > NOW() RETURNING *`,
    [sessionId]
  );
  if ((claimRes.rowCount ?? 0) === 0) {
    throw new Error("Sessão HTTP do QR Code expirada, já processada, ou inválida.");
  }
  const sessionData = claimRes.rows[0];

  try {
    const normalizedWallet = trimString(walletAddress);
    const normalizedKey = trimString(publicKey);
    const normalizedSignature = trimString(signature);
    const expiresAtIso = new Date(sessionData.expires_at).toISOString();

    if (!normalizedWallet) {
      throw new Error("walletAddress é obrigatório no webhook QR.");
    }

    let proofLevel = "qr_dev_unverified";
    
    if (config.isProduction && !normalizedKey) {
        // H-35: Block unverified sessions in production to prevent address spoofing
        throw new Error("Login por QR sem assinatura é bloqueado em ambiente de produção.");
    }

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
  } catch (error: unknown) {
    // Rollback processing lock so a retry can happen before expiration.
    await query(
      `UPDATE qr_sessions
       SET status='pending'
       WHERE id=$1 AND status='processing' AND expires_at > NOW()`,
      [sessionId],
    ).catch(() => {});
    throw error;
  }
}

export { touchSession, revokeSession, getSessionByToken };
