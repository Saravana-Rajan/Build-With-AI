"""Close-the-loop notifier (pipeline Step 11).

When the MP office marks a citizen's issue as *actioned*, this module notifies
the citizen back on Telegram in their own language, confirming that the issue
(referencing the place + need and a reference id) has been raised with the
concerned department.

Loosely coupled by design: it talks to Telegram ONLY over the Bot HTTP API and
reads the bot token from the environment (.env via python-dotenv). It never
prints or logs the token.

The route (``POST /close-loop``) delegates to a pure, testable ``notify(...)``
helper. Run ``python -m app.pipeline.closeloop`` to preview the ta/hi/en
messages without sending anything.
"""

from __future__ import annotations

import os
from typing import Union

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter
from pydantic import BaseModel

load_dotenv()

router = APIRouter()

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"

# Lang-aware confirmation templates. Placeholders: {place}, {need}, {reference}.
_TEMPLATES = {
    "ta": (
        "✅ உங்கள் புகார் ({place} — {need}) சம்பந்தப்பட்ட துறையிடம் "
        "பதிவு செய்யப்பட்டது.\n"
        "குறிப்பு எண்: {reference}\n"
        "விரைவில் நடவடிக்கை எடுக்கப்படும். நன்றி! 🙏"
    ),
    "hi": (
        "✅ आपकी शिकायत ({place} — {need}) संबंधित विभाग को भेज दी गई है।\n"
        "संदर्भ संख्या: {reference}\n"
        "जल्द ही कार्रवाई की जाएगी। धन्यवाद! 🙏"
    ),
    "en": (
        "✅ Your issue ({place} — {need}) has been raised with the concerned "
        "department.\n"
        "Reference: {reference}\n"
        "Action will follow shortly. Thank you! 🙏"
    ),
}

_DEFAULT_LANG = "ta"


class CloseLoopRequest(BaseModel):
    chat_id: Union[str, int]
    reference: str
    place_name: Union[str, None] = None
    need: Union[str, None] = None
    lang: str = _DEFAULT_LANG


def compose_message(
    reference: str,
    place_name: str | None,
    need: str | None,
    lang: str = _DEFAULT_LANG,
) -> str:
    """Render the lang-aware confirmation message (pure, no I/O)."""
    template = _TEMPLATES.get(lang, _TEMPLATES[_DEFAULT_LANG])
    place = (place_name or "").strip() or {
        "ta": "உங்கள் பகுதி",
        "hi": "आपका क्षेत्र",
        "en": "your area",
    }.get(lang, "your area")
    what = (need or "").strip() or {
        "ta": "பிரச்சினை",
        "hi": "समस्या",
        "en": "issue",
    }.get(lang, "issue")
    return template.format(place=place, need=what, reference=reference)


def notify(
    chat_id: Union[str, int],
    reference: str,
    place_name: str | None = None,
    need: str | None = None,
    lang: str = _DEFAULT_LANG,
) -> dict:
    """Send the close-the-loop Telegram message.

    Pure orchestration: composes the text, POSTs to the Bot API, and returns a
    plain dict. Never raises — a missing token or a Telegram error yields
    ``{"ok": False, "reason": ...}`` so the caller can respond HTTP 200.
    """
    text = compose_message(reference, place_name, need, lang)

    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        return {"ok": False, "reason": "TELEGRAM_BOT_TOKEN not configured", "text": text}

    try:
        resp = httpx.post(
            TELEGRAM_API.format(token=token),
            json={"chat_id": chat_id, "text": text},
            timeout=10.0,
        )
        data = resp.json()
    except Exception as exc:  # noqa: BLE001 - graceful degradation is intentional
        return {"ok": False, "reason": f"telegram request failed: {exc}", "text": text}

    if not data.get("ok"):
        # Surface Telegram's own error without leaking the token.
        reason = data.get("description", "telegram returned an error")
        return {"ok": False, "reason": reason, "text": text}

    return {"ok": True, "reference": reference, "lang": lang, "text": text}


@router.post("/close-loop")
def close_loop(req: CloseLoopRequest) -> dict:
    """Notify a citizen that their actioned issue was raised with the department."""
    return notify(
        chat_id=req.chat_id,
        reference=req.reference,
        place_name=req.place_name,
        need=req.need,
        lang=req.lang,
    )


if __name__ == "__main__":
    # Verifiable without a real chat: print the composed message per language.
    sample = {
        "reference": "CBE-2026-0142",
        "place_name": "Gandhipuram",
        "need": "streetlight repair",
    }
    for lang in ("ta", "hi", "en"):
        print(f"--- {lang} ---")
        print(compose_message(sample["reference"], sample["place_name"], sample["need"], lang))
        print()
