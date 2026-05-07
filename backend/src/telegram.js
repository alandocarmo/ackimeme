const crypto = require("crypto");
const { config } = require("./config");

function parseTelegramInitData(initData) {
  if (typeof initData !== "string" || !initData.trim()) {
    return null;
  }

  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");

  // M-08: Wrap JSON.parse in try/catch for malformed Telegram user data
  let user = null;
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

function buildDataCheckString(params) {
  return [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function getTelegramSecretKey(botToken) {
  return crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
}

function verifyTelegramInitData(initData) {
  const parsed = parseTelegramInitData(initData);

  if (!parsed) {
    if (config.telegramBotToken) {
      throw new Error("Telegram init data é obrigatório para autenticação.");
    }

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

  if (calculatedHash !== parsed.hash) {
    throw new Error("Falha ao validar o Telegram Mini App.");
  }

  return {
    isVerified: true,
    status: "verified",
    user: parsed.user,
    authDate: parsed.authDate,
  };
}

module.exports = {
  verifyTelegramInitData,
};
