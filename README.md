# Convert - Bot Telegram

Untuk menjalankan bot Telegram sederhana menggunakan Node.js (Telegraf):

## Prasyarat
- Node.js >= 18

## Langkah Menjalankan
1. Salin file contoh env lalu isi token bot Anda
   - `cp .env.example .env`
   - Edit `.env` dan isi `BOT_TOKEN` dengan token dari @BotFather
2. Instal dependensi
   - `npm install`
3. Jalankan bot
   - `npm start`

Jika `BOT_TOKEN` belum diisi, aplikasi akan menampilkan pesan dan keluar tanpa error.

## Catatan
- Untuk menguji, kirim pesan ke bot Anda di Telegram. Bot akan meng-echo kembali teks yang Anda kirim dan mendukung perintah `/start` dan `/help`.
