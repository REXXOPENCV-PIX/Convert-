import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from bot.config import BOT_TOKEN

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text('Bot is running. Access control coming soon.')

async def main():
    if not BOT_TOKEN:
        raise RuntimeError('BOT_TOKEN is not set')
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler('start', start))
    await app.initialize()
    await app.start()
    await app.updater.start_polling()
    await app.updater.idle()

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
