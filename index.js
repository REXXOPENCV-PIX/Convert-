require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { setTimeout: delay } = require('timers/promises');

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

// Admins (daftar ID, dipisahkan koma). Gunakan chat id numerik, bukan username.
const adminIdsEnv = process.env.ADMIN_IDS || '';
const adminIdsSet = new Set(
  adminIdsEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((x) => (x.startsWith('@') ? x.slice(1) : x))
);

function isAdminId(id) {
  return adminIdsSet.has(String(id));
}

// Penyimpanan pengguna sederhana (JSON file)
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const fsp = fs.promises;

async function ensureDataStore() {
  await fsp.mkdir(dataDir, { recursive: true });
  try {
    await fsp.access(usersFile, fs.constants.F_OK);
  } catch (_) {
    const initial = { users: [], updatedAt: new Date().toISOString(), lastBroadcastAt: null };
    await fsp.writeFile(usersFile, JSON.stringify(initial, null, 2));
  }
}

async function loadDb() {
  try {
    const raw = await fsp.readFile(usersFile, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: [], updatedAt: new Date().toISOString(), lastBroadcastAt: null };
  }
}

async function saveDb(db) {
  db.updatedAt = new Date().toISOString();
  await fsp.writeFile(usersFile, JSON.stringify(db, null, 2));
}

function findUser(db, userId) {
  const idStr = String(userId);
  return db.users.find((u) => String(u.id) === idStr);
}

async function recordUserSeen(ctx) {
  const from = ctx.from;
  if (!from) return;
  await ensureDataStore();
  const db = await loadDb();
  const existing = findUser(db, from.id);
  if (existing) {
    existing.username = from.username || existing.username || null;
    existing.first_name = from.first_name || existing.first_name || null;
    existing.last_name = from.last_name || existing.last_name || null;
    existing.language_code = from.language_code || existing.language_code || null;
    existing.lastSeenAt = new Date().toISOString();
  } else {
    db.users.push({
      id: String(from.id),
      username: from.username || null,
      first_name: from.first_name || null,
      last_name: from.last_name || null,
      language_code: from.language_code || null,
      subscribed: false,
      lastSeenAt: new Date().toISOString()
    });
  }
  await saveDb(db);
}

async function subscribeUser(ctx) {
  await ensureDataStore();
  const db = await loadDb();
  const u = findUser(db, ctx.from.id);
  if (u) {
    u.subscribed = true;
    u.unsubscribedAt = null;
  } else {
    db.users.push({ id: String(ctx.from.id), username: ctx.from.username || null, first_name: ctx.from.first_name || null, last_name: ctx.from.last_name || null, language_code: ctx.from.language_code || null, subscribed: true, lastSeenAt: new Date().toISOString(), unsubscribedAt: null });
  }
  await saveDb(db);
}

async function unsubscribeUser(ctx) {
  await ensureDataStore();
  const db = await loadDb();
  const u = findUser(db, ctx.from.id);
  if (u) {
    u.subscribed = false;
    u.unsubscribedAt = new Date().toISOString();
    await saveDb(db);
  }
}

async function getSubscribers() {
  await ensureDataStore();
  const db = await loadDb();
  return db.users.filter((u) => u.subscribed);
}

function isPrivateChat(ctx) {
  return ctx.chat && ctx.chat.type === 'private';
}

// State sederhana untuk alur admin (broadcast)
const adminState = new Map(); // key: adminId (string) -> { mode: 'await_message' | 'confirm', payload?: {...} }

const bot = new Telegraf(botToken);

// Daftar perintah yang terlihat di menu Telegram
bot.telegram.setMyCommands([
  { command: 'start', description: 'Mulai bot' },
  { command: 'help', description: 'Bantuan dan daftar perintah' },
  { command: 'ping', description: 'Cek respons bot' },
  { command: 'about', description: 'Tentang bot ini' },
  { command: 'subscribe', description: 'Berlangganan siaran' },
  { command: 'unsubscribe', description: 'Berhenti langganan' },
  { command: 'admin', description: 'Panel admin (khusus admin)'}
]).catch(() => {});

// Handler perintah
bot.start(async (ctx) => {
  await recordUserSeen(ctx);
  await subscribeUser(ctx);
  return ctx.reply('Halo! Bot siap. Kirim pesan apa saja dan aku akan meng-echo kembali.');
});
bot.help((ctx) => ctx.reply('Perintah tersedia:\n/start - Mulai bot\n/help - Bantuan\n/ping - Cek respons\n/about - Info bot\n/subscribe - Berlangganan\n/unsubscribe - Berhenti langganan\n/admin - Panel Admin'));
bot.command('ping', (ctx) => ctx.reply('pong'));
bot.command('about', (ctx) => ctx.reply('Bot contoh berbasis Telegraf.'));
bot.command('subscribe', async (ctx) => {
  await subscribeUser(ctx);
  return ctx.reply('Berhasil berlangganan. Anda akan menerima siaran.');
});
bot.command('unsubscribe', async (ctx) => {
  await unsubscribeUser(ctx);
  return ctx.reply('Anda telah berhenti berlangganan.');
});

// Panel Admin
bot.command('admin', async (ctx) => {
  if (!isAdminId(ctx.from.id)) return;
  if (!isPrivateChat(ctx)) return ctx.reply('Panel admin hanya untuk chat privat.');
  adminState.set(String(ctx.from.id), { mode: 'idle' });
  return ctx.reply('Panel Admin', Markup.inlineKeyboard([
    [Markup.button.callback('📣 Broadcast', 'admin_broadcast')],
    [Markup.button.callback('👥 Stats', 'admin_stats')],
    [Markup.button.callback('❌ Tutup', 'admin_close')]
  ]));
});

bot.action('admin_close', async (ctx) => {
  if (!isAdminId(ctx.from.id)) return;
  adminState.delete(String(ctx.from.id));
  try { await ctx.editMessageText('Panel ditutup.'); } catch (_) {}
});

bot.action('admin_stats', async (ctx) => {
  if (!isAdminId(ctx.from.id)) return;
  await ensureDataStore();
  const db = await loadDb();
  const total = db.users.length;
  const subs = db.users.filter(u => u.subscribed).length;
  const lastAt = db.lastBroadcastAt || '-';
  return ctx.reply(`Statistik:\nTotal users: ${total}\nSubscriber: ${subs}\nLast broadcast: ${lastAt}`);
});

bot.action('admin_broadcast', async (ctx) => {
  if (!isAdminId(ctx.from.id)) return;
  adminState.set(String(ctx.from.id), { mode: 'await_message' });
  return ctx.reply('Kirim pesan yang ingin di-broadcast. (Teks, foto, dsb)');
});

// Tangkap pesan dari admin saat menunggu broadcast
bot.on('message', async (ctx, next) => {
  const adminKey = String(ctx.from && ctx.from.id);
  const state = adminState.get(adminKey);
  if (!state || state.mode !== 'await_message') return next();
  if (!isAdminId(ctx.from.id)) return next();
  if (!isPrivateChat(ctx)) return ctx.reply('Broadcast hanya dapat dikirim lewat chat privat admin.');

  // Simpan payload untuk konfirmasi
  const payload = { chat_id: ctx.chat.id, message_id: ctx.message.message_id }; // akan disalin ke subscriber
  adminState.set(adminKey, { mode: 'confirm', payload });

  return ctx.reply('Konfirmasi broadcast?', Markup.inlineKeyboard([
    [Markup.button.callback('✅ Kirim', 'bc_confirm'), Markup.button.callback('❌ Batal', 'bc_cancel')]
  ]));
});

bot.action('bc_cancel', async (ctx) => {
  if (!isAdminId(ctx.from.id)) return;
  adminState.delete(String(ctx.from.id));
  try { await ctx.editMessageText('Broadcast dibatalkan.'); } catch (_) {}
});

bot.action('bc_confirm', async (ctx) => {
  if (!isAdminId(ctx.from.id)) return;
  const adminKey = String(ctx.from.id);
  const state = adminState.get(adminKey);
  if (!state || state.mode !== 'confirm' || !state.payload) {
    return ctx.reply('Tidak ada broadcast yang menunggu.');
  }
  adminState.delete(adminKey);

  const subscribers = await getSubscribers();
  const total = subscribers.length;
  let success = 0;
  let failed = 0;

  // Batasi laju agar tidak memicu flood (contoh: 20 msg/detik)
  const rateLimitPerSecond = Number(process.env.BC_RATE || 20);
  const intervalMs = Math.ceil(1000 / Math.max(1, rateLimitPerSecond));

  for (const sub of subscribers) {
    try {
      await bot.telegram.copyMessage(sub.id, state.payload.chat_id, state.payload.message_id);
      success += 1;
    } catch (e) {
      failed += 1;
      // Jika pengguna memblokir bot atau chat tidak ditemukan, tandai unsub
      if (String(e.message || '').match(/forbidden|bot was blocked by the user|chat not found/i)) {
        const db = await loadDb();
        const u = findUser(db, sub.id);
        if (u) { u.subscribed = false; u.unsubscribedAt = new Date().toISOString(); await saveDb(db); }
      }
    }
    await delay(intervalMs);
  }

  const db = await loadDb();
  db.lastBroadcastAt = new Date().toISOString();
  await saveDb(db);

  return ctx.reply(`Broadcast selesai. Berhasil: ${success}, Gagal: ${failed}, Total: ${total}`);
});

// Handler teks umum (echo)
bot.on('text', async (ctx) => {
  await recordUserSeen(ctx);
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
  app.get('/healthz', async (req, res) => {
    try {
      await ensureDataStore();
      const db = await loadDb();
      res.json({ ok: true, users: db.users.length, updatedAt: db.updatedAt });
    } catch (e) {
      res.status(500).json({ ok: false });
    }
  });

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
