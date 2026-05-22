import "dotenv/config";
import { Telegraf, Context } from "telegraf";

if (!process.env.BOT_TOKEN) {
  throw new Error("BOT_TOKEN não definido no .env");
}

const webAppUrl = process.env.WEB_APP_URL || "https://ackimeme.fun";
const welcomeText =
  process.env.BOT_WELCOME_TEXT ||
  "Configure sua memecoin na Acki Nacki sem sair do Telegram.";

const bot = new Telegraf(process.env.BOT_TOKEN);

// ─── M-05: Rate limiting middleware to prevent spam ──────────────────────────
const rateLimitMap = new Map<number, number>();
const RATE_LIMIT_MS = 3000; // 3 seconds between interactions per user

bot.use((ctx: Context, next: () => Promise<void>) => {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const now = Date.now();
  const lastSeen = rateLimitMap.get(userId);

  if (lastSeen && now - lastSeen < RATE_LIMIT_MS) {
    return; // Silently ignore rapid-fire messages
  }

  rateLimitMap.set(userId, now);
  return next();
});

// Clean up rate limit map every 5 minutes to prevent memory leak
setInterval(() => {
  const threshold = Date.now() - 60_000;
  for (const [userId, timestamp] of rateLimitMap) {
    if (timestamp < threshold) {
      rateLimitMap.delete(userId);
    }
  }
}, 5 * 60 * 1000);

bot.start((ctx: Context) => {
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
