# Convert - Bot Telegram

Untuk menjalankan bot Telegram sederhana menggunakan Node.js (Telegraf):

## Prasyarat
- Node.js >= 18

## Konfigurasi Lingkungan
Salin file contoh env lalu isi token bot Anda:
- `cp .env.example .env`
- Edit `.env` dan isi `BOT_TOKEN` dengan token dari @BotFather

Mode yang didukung:
- `MODE=polling` (default): lebih mudah untuk lokal
- `MODE=webhook`: untuk deployment publik (butuh `WEBHOOK_DOMAIN` HTTPS)

Variabel lain:
- `PORT`: port untuk health server (polling) atau server webhook
- `WEBHOOK_DOMAIN`: domain publik lengkap, misal `https://example.com`
- `WEBHOOK_PATH`: path endpoint webhook, default `/telegraf/<WEBHOOK_SECRET>`
- `WEBHOOK_SECRET`: secret untuk membentuk path default jika `WEBHOOK_PATH` tidak disetel
 - `ADMIN_IDS`: daftar ID admin (dipisahkan koma), gunakan chat id numerik
 - `BC_RATE`: batas laju broadcast (pesan/detik), default 20

## Langkah Menjalankan (Polling)
1. `npm install`
2. `npm start`
3. Buka `http://localhost:3000/healthz` untuk cek kesehatan

## Langkah Menjalankan (Webhook)
1. Setel di `.env`:
   - `MODE=webhook`
   - `WEBHOOK_DOMAIN=https://domain-anda.com` (harus dapat diakses publik)
   - Opsional: `WEBHOOK_PATH` dan/atau `WEBHOOK_SECRET`
2. `npm install`
3. `npm start`
4. Bot akan mendaftarkan webhook ke `WEBHOOK_DOMAIN + WEBHOOK_PATH`

Jika `BOT_TOKEN` belum diisi, aplikasi akan menampilkan pesan dan keluar tanpa error.

## Catatan
- Untuk menguji, kirim pesan ke bot Anda di Telegram. Bot akan meng-echo kembali teks yang Anda kirim dan mendukung perintah `/start`, `/help`, `/ping`, dan `/about`.

## Fitur & Logika
- Perintah dasar: `/start`, `/help`, `/ping`, `/about`
- Berlangganan: `/subscribe` untuk opt-in, `/unsubscribe` untuk opt-out
- Pencatatan pengguna: setiap interaksi menyimpan/ memperbarui `data/users.json`
- Admin Panel (`/admin`, private chat, admin saja):
  - Broadcast: admin pilih "📣 Broadcast", lalu kirim pesan apa pun (teks/foto/dll). Bot akan minta konfirmasi sebelum siaran ke semua subscriber menggunakan `copyMessage`.
  - Stats: melihat total user, jumlah subscriber, dan waktu broadcast terakhir
  - Close: menutup panel admin
- Broadcast: dibatasi laju kirim (`BC_RATE`, default 20 msg/detik), kegagalan karena blokir/Chat tidak ditemukan akan menandai user sebagai `unsubscribed`.
- Health endpoint: `GET /healthz` menampilkan status ok dan jumlah user yang tersimpan.
