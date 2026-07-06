"""Telegram WEBHOOK integration for the Sarvik intake pipeline.

Unlike bot.py (long-polling, run locally), this router lets Telegram PUSH updates
to the FastAPI service over HTTPS. That is what we deploy on Cloud Run: it is
always-on and Cloud Run can reach api.telegram.org even when a dev's network can't.

Endpoints (mounted with NO /api prefix — Telegram posts to /telegram/webhook):
    POST /telegram/webhook      receive a Telegram Update, run intake, reply
    GET  /telegram/set-webhook  register this service's URL with Telegram
    GET  /telegram/webhook-info  getWebhookInfo (debugging)

The intake pipeline is called IN-PROCESS via app.pipeline.intake — no HTTP hop.
Requires TELEGRAM_BOT_TOKEN (Cloud Run env or local .env). The token is never
printed or logged.
"""
from __future__ import annotations

import logging
import os
import tempfile

import httpx
from fastapi import APIRouter, Request

from app.config import settings
from app.pipeline.intake import process_text, process_media
from app.schema import DemandRecord

logger = logging.getLogger("telegram_webhook")

router = APIRouter()

# Prefer the pydantic-settings value; fall back to a raw env read.
BOT_TOKEN = settings.telegram_bot_token or os.getenv("TELEGRAM_BOT_TOKEN", "")
_API_BASE = "https://api.telegram.org"


def _bot_url(method: str) -> str:
    """Build a Telegram Bot API URL. Never log/return this — it embeds the token."""
    return f"{_API_BASE}/bot{BOT_TOKEN}/{method}"


def _file_url(file_path: str) -> str:
    """Build a Telegram file-download URL (also embeds the token)."""
    return f"{_API_BASE}/file/bot{BOT_TOKEN}/{file_path}"


async def _get_file_path(client: httpx.AsyncClient, file_id: str) -> str | None:
    """Resolve a Telegram file_id to its downloadable file_path via getFile."""
    resp = await client.get(_bot_url("getFile"), params={"file_id": file_id})
    resp.raise_for_status()
    data = resp.json()
    if not data.get("ok"):
        logger.warning("getFile not ok: %s", data.get("description"))
        return None
    return data["result"].get("file_path")


async def _download_to_temp(client: httpx.AsyncClient, file_id: str, suffix: str) -> str | None:
    """getFile + download the bytes to a temp file. Returns the local path."""
    file_path = await _get_file_path(client, file_id)
    if not file_path:
        return None
    resp = await client.get(_file_url(file_path))
    resp.raise_for_status()
    fd, path = tempfile.mkstemp(suffix=suffix, prefix="tg_")
    with os.fdopen(fd, "wb") as fh:
        fh.write(resp.content)
    return path


async def _send_message(client: httpx.AsyncClient, chat_id: int, text: str) -> None:
    """Best-effort reply to the citizen; failures are logged, never raised."""
    try:
        resp = await client.post(
            _bot_url("sendMessage"),
            json={"chat_id": chat_id, "text": text},
        )
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001 — a failed ack must not 500 the webhook
        logger.warning("sendMessage failed for chat_id=%s: %s", chat_id, exc)


_WELCOME = (
    "🙏 வணக்கம்! இது கோயம்புத்தூர் தொகுதி புகார் உதவியாளர்.\n"
    "உங்கள் புகாரை உரை, குரல் பதிவு அல்லது புகைப்படமாக அனுப்பவும்.\n"
    'எ.கா: "சரவணம்பட்டியில் ஒரு வாரமாக குடிநீர் வரவில்லை"\n\n'
    "🙏 Welcome to the Coimbatore Constituency complaint assistant.\n"
    "Send your complaint as text, a voice note, or a photo of a petition.\n"
    'E.g. "No drinking water in Saravanampatti for a week"'
)

_ASK_REAL = (
    "உங்கள் புகாரை விவரமாக எழுதவும் — இடம் மற்றும் பிரச்சனை.\n"
    'எ.கா: "பீளமேட்டில் தெரு விளக்குகள் ஒரு மாதமாக எரியவில்லை"\n\n'
    "Please describe your complaint with a place and the problem.\n"
    'E.g. "Street lights not working in Peelamedu for a month"'
)

# Greetings / test pings that must NOT be filed as complaints.
_GREETINGS = {
    "hi", "hello", "hey", "start", "test", "ok", "okay", "thanks",
    "thank you", "hai", "vanakkam", "வணக்கம்", "ஹாய்", "hii", "yo",
}


def _is_command(text: str) -> bool:
    """Telegram bot command, e.g. /start, /help."""
    return text.strip().startswith("/")


def _looks_trivial(text: str) -> bool:
    """A greeting or a one-word ping with no substance — don't file it."""
    s = text.strip().lower()
    if s in _GREETINGS:
        return True
    # single word and no digits (real short complaints usually name a place/number)
    words = s.split()
    return len(words) < 2 and not any(ch.isdigit() for ch in s)


def _reply_text(rec: DemandRecord) -> str:
    """Bilingual (Tamil / English) acknowledgement with reference id, scheme, place."""
    scheme = rec.matched_scheme or "MPLADS / பொது"
    place = rec.place_name or "—"
    category = rec.category or "—"
    return (
        f"✅ உங்கள் புகார் பெறப்பட்டது.\n"
        f"குறிப்பு எண்: {rec.id}\n"
        f"வகை: {category}\n"
        f"திட்டம்: {scheme}\n"
        f"இடம்: {place}\n\n"
        f"✅ Your complaint has been received.\n"
        f"Reference: {rec.id}\n"
        f"Category: {category}\n"
        f"Scheme: {scheme}\n"
        f"Place: {place}"
    )


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request) -> dict:
    """Receive a Telegram Update, run intake in-process, reply to the chat.

    ALWAYS returns HTTP 200 {"ok": true} — even on internal error — so Telegram
    does not retry-storm the endpoint. All work is wrapped in try/except.
    """
    try:
        update = await request.json()
        message = update.get("message") or update.get("edited_message")
        if not message:
            return {"ok": True}

        chat_id = message.get("chat", {}).get("id")

        async with httpx.AsyncClient(timeout=30.0) as client:
            rec: DemandRecord | None = None
            tmp_path: str | None = None
            try:
                if message.get("text"):
                    text = message["text"]
                    # Commands and greetings must not be filed as complaints.
                    if _is_command(text):
                        if chat_id is not None:
                            await _send_message(client, chat_id, _WELCOME)
                        return {"ok": True}
                    if _looks_trivial(text):
                        if chat_id is not None:
                            await _send_message(client, chat_id, _ASK_REAL)
                        return {"ok": True}
                    rec = process_text(text, "ta", "telegram")

                elif message.get("voice") or message.get("audio"):
                    media = message.get("voice") or message.get("audio")
                    tmp_path = await _download_to_temp(client, media["file_id"], ".ogg")
                    if tmp_path:
                        rec = process_media(tmp_path, "audio/ogg", "ta", "telegram")

                elif message.get("photo"):
                    # Photos come in ascending sizes; the last is the largest.
                    largest = message["photo"][-1]
                    tmp_path = await _download_to_temp(client, largest["file_id"], ".jpg")
                    if tmp_path:
                        rec = process_media(tmp_path, "image/jpeg", "ta", "telegram")

                elif message.get("document"):
                    # A file attachment — PDF petition, or an image/audio sent as a
                    # file rather than a photo/voice. Use its name for the suffix
                    # and its declared MIME (Gemini handles image/*, pdf, audio/*).
                    doc = message["document"]
                    fname = doc.get("file_name") or ""
                    suffix = os.path.splitext(fname)[1] or ".bin"
                    tmp_path = await _download_to_temp(client, doc["file_id"], suffix)
                    if tmp_path:
                        mime = doc.get("mime_type") or None
                        rec = process_media(tmp_path, mime, "ta", "telegram")
            finally:
                if tmp_path:
                    try:
                        os.remove(tmp_path)
                    except OSError:
                        pass

            if chat_id is not None:
                if rec is not None:
                    await _send_message(client, chat_id, _reply_text(rec))
                else:
                    await _send_message(
                        client,
                        chat_id,
                        "உரை, குரல் அல்லது புகைப்படமாக உங்கள் புகாரை அனுப்பவும்.\n"
                        "Please send your complaint as text, voice, or photo.",
                    )
    except Exception as exc:  # noqa: BLE001 — never let Telegram see a non-200
        logger.exception("telegram webhook error: %s", exc)

    return {"ok": True}


@router.get("/telegram/set-webhook")
async def set_webhook(request: Request) -> dict:
    """Register this service's /telegram/webhook URL with Telegram (setWebhook).

    The webhook URL is derived from the incoming request's base_url, so simply
    curling this endpoint on the deployed service activates the webhook — and the
    call to Telegram originates from Cloud Run/GCP, not the dev's network.
    """
    if not BOT_TOKEN:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN not configured"}

    # Cloud Run terminates TLS at its proxy, so request.base_url reports http://.
    # Telegram requires https, so force the scheme.
    base = str(request.base_url).rstrip("/").replace("http://", "https://", 1)
    webhook_url = f"{base}/telegram/webhook"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            _bot_url("setWebhook"),
            json={
                "url": webhook_url,
                "allowed_updates": ["message", "edited_message"],
            },
        )
    return {"webhook_url": webhook_url, "telegram": resp.json()}


@router.get("/telegram/webhook-info")
async def webhook_info() -> dict:
    """Return Telegram getWebhookInfo (debugging)."""
    if not BOT_TOKEN:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN not configured"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(_bot_url("getWebhookInfo"))
    return resp.json()
