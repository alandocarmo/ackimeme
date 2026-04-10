require("dotenv").config();
const { Telegraf } = require("telegraf");

if (!process.env.BOT_TOKEN) {
  throw new Error("BOT_TOKEN não definido no .env");
}

const webAppUrl = process.env.WEB_APP_URL || "https://ackimeme.fun";
const welcomeText =
  process.env.BOT_WELCOME_TEXT ||
  "Configure sua memecoin na Acki Nacki sem sair do Telegram.";

const bot = new Telegraf(process.env.BOT_TOKEN);

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
