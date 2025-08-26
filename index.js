const { Telegraf } = require('telegraf');
require('dotenv').config();

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  console.log('BOT_TOKEN belum disetel. Salin .env.example ke .env lalu isi token Anda.');
  process.exit(0);
}

const bot = new Telegraf(botToken);

bot.start((ctx) => ctx.reply('Halo! Bot siap. Kirim pesan apa saja dan aku akan echo.'));
bot.help((ctx) => ctx.reply('Perintah: /start, /help'));
bot.on('text', (ctx) => ctx.reply(`Kamu mengirim: ${ctx.message.text}`));

bot.catch((err) => {
  console.error('Terjadi kesalahan pada bot:', err);
});

bot.launch().then(() => {
  console.log('Bot berjalan. Tekan Ctrl+C untuk berhenti.');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
