"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const telegraf_1 = require("telegraf");
const redis_1 = require("redis");
if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN não definido no .env");
}
const webAppUrl = process.env.WEB_APP_URL || "https://ackimeme.fun";
const welcomeText = process.env.BOT_WELCOME_TEXT ||
    "Configure sua memecoin na Acki Nacki sem sair do Telegram.";
const bot = new telegraf_1.Telegraf(process.env.BOT_TOKEN);
// ─── M-05: Rate limiting middleware to prevent spam (Redis-backed) ─────────────
let redisClient = null;
if (process.env.REDIS_URL) {
    redisClient = (0, redis_1.createClient)({ url: process.env.REDIS_URL });
    redisClient.on("error", (err) => console.error("[Redis] Client error:", err.message));
    redisClient.connect()
        .then(() => console.log("[Redis] Conectado para rate limiting no Bot"))
        .catch((err) => console.error("[Redis] Falha na conexão inicial:", err.message));
}
const RATE_LIMIT_SEC = 3; // 3 seconds between interactions per user
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId)
        return next();
    if (redisClient) {
        try {
            const key = `bot_rate_limit:${userId}`;
            const setSuccess = await redisClient.set(key, "1", {
                NX: true,
                EX: RATE_LIMIT_SEC
            });
            if (!setSuccess) {
                return; // Silently ignore rapid-fire messages
            }
        }
        catch (err) {
            console.error("[Redis] Rate limit falhou, ignorando:", err);
        }
    }
    return next();
});
bot.start((ctx) => {
    ctx.reply(`🚀 AckiMeme\n\n${welcomeText}`, {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "Abrir Mini App",
                        web_app: { url: webAppUrl },
                    },
                ],
            ],
        },
    });
});
bot.launch();
console.log("🤖 Bot rodando...");
// Enable graceful stop
process.once('SIGINT', () => {
    console.log("Parando bot graciosamente (SIGINT)...");
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    console.log("Parando bot graciosamente (SIGTERM)...");
    bot.stop('SIGTERM');
});
