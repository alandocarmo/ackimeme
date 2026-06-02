import * as crypto from "crypto";
import { config } from "./config";

interface ParsedTelegramInitData {
  authDate: number;
  hash: string;
  user: any;
  params: URLSearchParams;
}

function parseTelegramInitData(initData: any): ParsedTelegramInitData | null {
  if (typeof initData !== "string" || !initData.trim()) {
    return null;
  }

  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");

  // M-08: Wrap JSON.parse in try/catch for malformed Telegram user data
  let user: any = null;
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      user = null;
    }
  }

  return {
    authDate: Number(params.get("auth_date") || 0),
    hash: params.get("hash") || "",
    user,
    params,
  };
}

function buildDataCheckString(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function getTelegramSecretKey(botToken: string): Buffer {
  return crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
}

interface TelegramVerificationResult {
  isVerified: boolean;
  status: string;
  user: any;
  authDate?: number;
}

export function verifyTelegramInitData(initData: any): TelegramVerificationResult {
  const parsed = parseTelegramInitData(initData);

  if (!parsed) {
    return {
      isVerified: false,
      status: "missing",
      user: null,
    };
  }

  if (!config.telegramBotToken) {
    return {
      isVerified: false,
      status: "bot_token_not_configured",
      user: parsed.user,
    };
  }

  if (!parsed.hash || !parsed.authDate) {
    throw new Error("Telegram init data inválido.");
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - parsed.authDate;

  if (ageSeconds > config.telegramAuthMaxAgeSeconds) {
    throw new Error("Telegram init data expirado.");
  }

  const dataCheckString = buildDataCheckString(parsed.params);
  const secretKey = getTelegramSecretKey(config.telegramBotToken);
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const calculatedBuffer = Buffer.from(calculatedHash, "hex");
  const providedBuffer = Buffer.from(parsed.hash, "hex");
  if (
    calculatedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(calculatedBuffer, providedBuffer)
  ) {
    throw new Error("Falha ao validar o Telegram Mini App.");
  }

  return {
    isVerified: true,
    status: "verified",
    user: parsed.user,
    authDate: parsed.authDate,
  };
}
