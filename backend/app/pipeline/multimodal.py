"""
Pipeline Step 1 (multimodal variant) — Gemini native multimodal extraction.

Citizens don't only type. They send voice notes, photos of paper petitions,
and multi-page PDF letters. Gemini 2.5-flash is natively multimodal, so we hand
the raw media straight to the model and ask for the SAME structured record the
text extractor produces — plus a verbatim `transcript` of what the model
read/heard, so a human can audit the extraction.

Do NOT import from extract.py here; this module is self-contained on purpose
(another agent owns the text path). The output shape is kept in sync manually.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from google import genai

# ── Config ───────────────────────────────────────────────────────────────────
# multimodal.py lives at backend/app/pipeline/multimodal.py → parents[3] is root.
_REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(_REPO_ROOT / ".env")

_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

# Allowed categories — keep in sync with schema.Category.
ALLOWED_CATEGORIES = {
    "water", "road", "housing", "education",
    "health", "jobs", "pension", "sanitation", "other",
}
ALLOWED_URGENCY = {"critical", "high", "medium", "low"}

# Extension → MIME. Covers the modalities we accept: images, PDF letters, audio.
_EXT_TO_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".mpeg": "audio/mpeg",
    ".mpga": "audio/mpeg",
    ".wav": "audio/wav",
}

# One module-level client, reused across calls. Created lazily so importing the
# module never crashes even if the key is momentarily absent.
_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


def detect_mime(path: str) -> Optional[str]:
    """Best-effort MIME sniff from a file's extension.

    Returns a MIME string for the modalities we accept (image/jpeg, image/png,
    application/pdf, audio/ogg, audio/mpeg, audio/wav) or None if unrecognised.
    """
    return _EXT_TO_MIME.get(Path(path).suffix.lower())


def _safe_default() -> dict:
    """Returned whenever the model or parsing fails — never raises upstream."""
    return {
        "category": "other",
        "need_detail": "",
        "urgency": "medium",
        "urgency_reason": "",
        "beneficiary_estimate": None,
        "location_clues": [],
        "transcript": "",
    }


_PROMPT = """You are a civic-complaint analyst for an Indian MP's constituency office.
You are given a citizen complaint as MEDIA — it may be a photo of a handwritten or
printed paper petition, a scanned/multi-page PDF letter, or an audio voice note.
The content may be in Tamil, English, or mixed.

First READ or LISTEN to the media carefully, then extract a structured record.
Respond with a SINGLE JSON object and nothing else.

Fields:
- "transcript": the full text you read (for images/PDF) or heard (for audio),
    transcribed VERBATIM in the original language(s). Do not translate here. For
    multi-page documents, concatenate the pages in order.
- "category": exactly one of ["water","road","housing","education","health","jobs","pension","sanitation","other"].
    Pick the single best fit. Use "other" only if none clearly apply.
- "need_detail": one concise English sentence describing the concrete need.
- "urgency": one of ["critical","high","medium","low"].
    critical = life/safety at immediate risk; high = serious harm soon;
    medium = important but not time-critical; low = minor/quality-of-life.
- "urgency_reason": one short English clause justifying the urgency.
- "beneficiary_estimate": integer number of people affected if stated or reasonably
    inferable (e.g. "200 families" -> 200), else null.
- "location_clues": array of place-name strings mentioned (streets, wards, villages,
    landmarks). Empty array if none.

Complaint language hint: {language}
"""


def _coerce(data: dict) -> dict:
    """Validate/normalise a raw model dict into the canonical output shape."""
    out = _safe_default()

    # category — validate against controlled vocab.
    cat = data.get("category")
    out["category"] = cat if cat in ALLOWED_CATEGORIES else "other"

    # urgency — validate; default to medium.
    urg = data.get("urgency")
    out["urgency"] = urg if urg in ALLOWED_URGENCY else "medium"

    # free-text fields.
    if isinstance(data.get("need_detail"), str):
        out["need_detail"] = data["need_detail"]
    if isinstance(data.get("urgency_reason"), str):
        out["urgency_reason"] = data["urgency_reason"]
    if isinstance(data.get("transcript"), str):
        out["transcript"] = data["transcript"]

    # beneficiary_estimate — coerce to int or None.
    ben = data.get("beneficiary_estimate")
    if isinstance(ben, bool):
        ben = None
    if isinstance(ben, (int, float)):
        out["beneficiary_estimate"] = int(ben)
    elif isinstance(ben, str) and ben.strip().isdigit():
        out["beneficiary_estimate"] = int(ben.strip())
    else:
        out["beneficiary_estimate"] = None

    # location_clues — list of strings.
    clues = data.get("location_clues")
    if isinstance(clues, list):
        out["location_clues"] = [
            str(c) for c in clues if isinstance(c, (str, int, float))
        ]

    return out


def extract_from_media(
    file_path: str,
    mime_type: str | None = None,
    language: str = "ta",
) -> dict:
    """Extract a structured demand record directly from a media file.

    Handles photos of paper petitions (image/*), multi-page letters (PDF), and
    voice notes (audio/*) using Gemini's native multimodal understanding.

    Always returns a dict with exactly these keys:
        category, need_detail, urgency, urgency_reason,
        beneficiary_estimate, location_clues, transcript

    `transcript` is the verbatim text the model read/heard. On any error
    (missing file, unknown MIME, API/parse failure) returns a safe default with
    category "other" and an empty transcript — never raises upstream.
    """
    path = Path(file_path)
    if not path.is_file():
        print(f"[multimodal] file not found: {file_path}")
        return _safe_default()

    mime = mime_type or detect_mime(file_path)
    if not mime:
        print(f"[multimodal] unknown/unsupported MIME for: {file_path}")
        return _safe_default()

    prompt = _PROMPT.format(language=language)

    try:
        client = _get_client()
        # Upload the file and reference the returned handle in `contents`. This
        # is the robust path for PDFs/audio and larger images.
        uploaded = client.files.upload(file=str(path))
        resp = client.models.generate_content(
            model=_MODEL,
            contents=[uploaded, prompt],
            config={"response_mime_type": "application/json"},
        )
        data = json.loads(resp.text)
    except Exception as exc:  # noqa: BLE001 — pipeline must never crash here
        print(f"[multimodal] falling back to default: {type(exc).__name__}: {exc}")
        return _safe_default()

    if not isinstance(data, dict):
        return _safe_default()

    return _coerce(data)


# ── Manual test harness ──────────────────────────────────────────────────────
def _make_test_png(dest: Path) -> Optional[Path]:
    """Render a small Tamil/English complaint image, if Pillow is available."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception as exc:  # noqa: BLE001
        print(f"[test] Pillow unavailable, skipping image test: {exc}")
        return None

    lines = [
        "PETITION / மனு",
        "Anna Nagar 4th Street, Ward 12.",
        "Drinking water pipe broken 3 weeks.",
        "kudineer varavillai. ~150 families affected.",
    ]
    img = Image.new("RGB", (800, 300), "white")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 26)
    except Exception:  # noqa: BLE001
        font = ImageFont.load_default()
    y = 30
    for ln in lines:
        draw.text((30, y), ln, fill="black", font=font)
        y += 55
    img.save(dest)
    return dest


if __name__ == "__main__":
    import sys

    def _p(s: str) -> None:
        # Windows consoles default to cp1252 and choke on Tamil glyphs; encode
        # defensively so the harness never dies on non-Latin transcripts.
        enc = sys.stdout.encoding or "utf-8"
        sys.stdout.buffer.write((s + "\n").encode(enc, errors="replace"))

    def _show(label: str, r: dict) -> None:
        _p(f"\n=== {label} ===")
        _p(f"  category={r['category']}  urgency={r['urgency']}  "
           f"benef={r['beneficiary_estimate']}")
        _p(f"  need: {r['need_detail']}")
        _p(f"  clues: {r['location_clues']}")
        t = r["transcript"].replace("\n", " ")
        _p(f"  transcript: {t[:220]}{'...' if len(t) > 220 else ''}")

    # 1) PDF letter (existing sample).
    pdf_path = _REPO_ROOT / "data" / "generated" / "track_a_sample_letter.pdf"
    print(f"detect_mime(pdf) = {detect_mime(str(pdf_path))}")
    _show("PDF letter", extract_from_media(str(pdf_path), language="en"))

    # 2) Image path (generated on the fly if Pillow is present).
    png_path = _REPO_ROOT / "data" / "generated" / "_multimodal_test.png"
    made = _make_test_png(png_path)
    if made:
        print(f"\ndetect_mime(png) = {detect_mime(str(png_path))}")
        _show("Image petition", extract_from_media(str(png_path), language="ta"))
