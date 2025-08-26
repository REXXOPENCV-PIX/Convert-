require('dotenv').config();
const { Telegraf } = require('telegraf');

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  console.log('BOT_TOKEN belum disetel. Salin .env.example ke .env lalu isi token Anda.');
  process.exit(0);
}

const mode = (process.env.MODE || 'polling').toLowerCase() === 'webhook' ? 'webhook' : 'polling';
const port = parseInt(process.env.PORT || '3000', 10);
const webhookSecret = process.env.WEBHOOK_SECRET || 'secret';
const webhookPath = process.env.WEBHOOK_PATH || `/telegraf/${webhookSecret}`;
const webhookDomain = process.env.WEBHOOK_DOMAIN; // contoh: https://contoh-domain.com

const bot = new Telegraf(botToken);

// Daftar perintah yang terlihat di menu Telegram
bot.telegram.setMyCommands([
  { command: 'start', description: 'Mulai bot' },
  { command: 'help', description: 'Bantuan dan daftar perintah' },
  { command: 'ping', description: 'Cek respons bot' },
  { command: 'about', description: 'Tentang bot ini' }
]).catch(() => {});

// Handler perintah
bot.start((ctx) => ctx.reply('Halo! Bot siap. Kirim pesan apa saja dan aku akan meng-echo kembali.'));
bot.help((ctx) => ctx.reply('Perintah tersedia:\n/start - Mulai bot\n/help - Bantuan\n/ping - Cek respons\n/about - Info bot'));
bot.command('ping', (ctx) => ctx.reply('pong'));
bot.command('about', (ctx) => ctx.reply('Bot contoh berbasis Telegraf.'));

// Handler teks umum (echo)
bot.on('text', (ctx) => {
  const text = ctx.message.text || '';
  if (text.startsWith('/')) {
    return ctx.reply('Perintah tidak dikenali. Coba /help.');
  }
  return ctx.reply(`Kamu mengirim: ${text}`);
});

// Handler tipe pesan lain
bot.on('message', (ctx, next) => {
  if (!ctx.message.text) {
    return ctx.reply('Saat ini aku hanya mendukung pesan teks.');
  }
  return next();
});

// Error boundary
bot.catch((err, ctx) => {
  console.error('Terjadi kesalahan pada bot:', err);
  try { ctx.reply('Maaf, terjadi kesalahan. Coba lagi nanti.'); } catch (_) {}
});

function isUnauthorizedTelegramError(err) {
  const code = (err && err.response && err.response.error_code) || err && err.code;
  const description = (err && err.response && err.response.description) || err && err.message || '';
  return code === 401 || code === 404 || /401|404|unauthorized|not\s*found/i.test(String(description));
}

async function main() {
  try {
    const me = await bot.telegram.getMe();
    console.log(`Login sebagai @${me.username || me.first_name}`);
  } catch (err) {
    if (isUnauthorizedTelegramError(err)) {
      console.error('BOT_TOKEN tidak valid (Unauthorized/Not Found). Periksa token Anda dari @BotFather.');
      process.exit(1);
    }
    console.error('Gagal memverifikasi BOT_TOKEN:', err);
    process.exit(1);
  }

  const express = require('express');
  const morgan = require('morgan');
  const app = express();
  app.disable('x-powered-by');
  app.use(morgan('tiny'));
  app.get('/healthz', (req, res) => res.json({ ok: true }));

  if (mode === 'webhook') {
    if (!webhookDomain) {
      console.error('MODE=webhook tetapi WEBHOOK_DOMAIN belum disetel. Setel misal https://domain-anda.com');
      process.exit(1);
    }
    const fullWebhookUrl = `${webhookDomain}${webhookPath}`;
    app.use(webhookPath, express.json(), bot.webhookCallback(webhookPath));
    await bot.telegram.setWebhook(fullWebhookUrl);
    app.listen(port, () => {
      console.log(`Webhook aktif di ${fullWebhookUrl} (port ${port}). /healthz untuk cek kesehatan.`);
    });
  } else {
    // Long polling + health server
    app.listen(port, () => {
      console.log(`Health server berjalan di http://localhost:${port}/healthz`);
    });
    await bot.launch({ dropPendingUpdates: true });
    console.log('Bot berjalan dengan mode long polling. Tekan Ctrl+C untuk berhenti.');
  }
}

main().catch((e) => {
  console.error('Gagal memulai aplikasi:', e);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
