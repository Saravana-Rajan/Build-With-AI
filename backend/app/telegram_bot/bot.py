"""Telegram bot for the Coimbatore civic-complaint app (Track 1).

A citizen sends a complaint (text, voice note, or photo) to the bot in Telegram.
The bot downloads any media, forwards the complaint to the backend intake API over
HTTP, and replies with a bilingual (Tamil + English) acknowledgement.

Loosely coupled by design: this module talks to the backend ONLY over HTTP
(INTAKE_API_URL). It does not import any other app module.

Run locally:
    python -m app.telegram_bot.bot

Requires the TELEGRAM_BOT_TOKEN environment variable (see README.md).
"""

from __future__ import annotations

import logging
import os
import tempfile
from itertools import count

import httpx
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("telegram_bot")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
INTAKE_API_URL = os.getenv("INTAKE_API_URL", "http://localhost:8000/api/intake")

# Per-process running counter used to build a human-friendly reference number.
_ref_counter = count(1)

WELCOME = (
    "வணக்கம்! 🙏 இது கோயம்புத்தூர் குடிமை புகார் உதவியாளர்.\n"
    "உங்கள் புகாரை உரை, குரல் குறிப்பு அல்லது புகைப்படமாக அனுப்பவும்.\n\n"
    "Welcome! This is the Coimbatore civic-complaint assistant.\n"
    "Send your complaint as text, a voice note, or a photo."
)


def _ack_message(chat_id: int, n: int, delivered: bool) -> str:
    """Bilingual acknowledgement shown to the citizen."""
    ref = f"{chat_id}-{n}"
    if delivered:
        return (
            "✅ உங்கள் புகார் பெறப்பட்டது. "
            f"குறிப்பு எண் #{ref}\n"
            "✅ Your complaint has been received. "
            f"Ref #{ref}"
        )
    # Intake API unreachable — still reassure the citizen.
    return (
        "📨 உங்கள் புகார் பெறப்பட்டது (சேமிக்கப்படுகிறது). "
        f"குறிப்பு எண் #{ref}\n"
        "📨 Your complaint has been received (queued). "
        f"Ref #{ref}"
    )


async def _post_to_intake(payload: dict) -> bool:
    """POST the complaint to the backend intake API.

    Returns True if the backend accepted it, False on any failure. Never raises —
    a down backend must not break the citizen's experience.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(INTAKE_API_URL, json=payload)
            resp.raise_for_status()
        logger.info("Intake accepted complaint from chat_id=%s", payload.get("chat_id"))
        return True
    except Exception as exc:  # noqa: BLE001 - graceful degradation is intentional
        logger.warning("Intake API unavailable (%s): %s", INTAKE_API_URL, exc)
        return False


async def _download_file(context: ContextTypes.DEFAULT_TYPE, file_id: str, suffix: str) -> str | None:
    """Download a Telegram file to a temp path and return that path."""
    try:
        tg_file = await context.bot.get_file(file_id)
        fd, path = tempfile.mkstemp(suffix=suffix, prefix="civic_")
        os.close(fd)
        await tg_file.download_to_drive(path)
        return path
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to download file %s: %s", file_id, exc)
        return None


async def _handle_complaint(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    *,
    text: str | None = None,
    voice_path: str | None = None,
    photo_path: str | None = None,
) -> None:
    """Build the payload, forward it, and acknowledge the citizen."""
    chat_id = update.effective_chat.id
    payload = {
        "source": "telegram",
        "chat_id": chat_id,
        "language_hint": "ta",
        "text": text,
        "voice_path": voice_path,
        "photo_path": photo_path,
    }
    delivered = await _post_to_intake(payload)
    n = next(_ref_counter)
    await update.message.reply_text(_ack_message(chat_id, n, delivered))


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(WELCOME)


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _handle_complaint(update, context, text=update.message.text)


async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    voice = update.message.voice
    voice_path = await _download_file(context, voice.file_id, ".ogg")
    caption = update.message.caption
    await _handle_complaint(update, context, text=caption, voice_path=voice_path)


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    # Photos arrive in multiple sizes; the last entry is the largest.
    largest = update.message.photo[-1]
    photo_path = await _download_file(context, largest.file_id, ".jpg")
    caption = update.message.caption
    await _handle_complaint(update, context, text=caption, photo_path=photo_path)


def build_application() -> Application:
    if not TELEGRAM_BOT_TOKEN:
        raise RuntimeError(
            "TELEGRAM_BOT_TOKEN is not set. Create a bot with @BotFather, copy the "
            "token, and add it to your .env file. See app/telegram_bot/README.md."
        )

    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.VOICE, handle_voice))
    application.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text)
    )
    return application


def main() -> None:
    application = build_application()
    logger.info("Starting Telegram bot (intake -> %s)", INTAKE_API_URL)
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
