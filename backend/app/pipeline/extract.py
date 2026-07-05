"""
Pipeline Step 1 — Gemini extraction.

Takes raw complaint text (Tamil or English) and returns a structured dict
with the fields the rest of the pipeline expects. Categories are constrained
to the controlled vocabulary defined in backend/app/schema.py.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from google import genai

# ── Config ───────────────────────────────────────────────────────────────────
# Load .env from the repo root (…/Build with AI/.env). extract.py lives at
# backend/app/pipeline/extract.py → parents[3] is the repo root.
_REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(_REPO_ROOT / ".env")

_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

# Allowed categories — keep in sync with schema.Category.
ALLOWED_CATEGORIES = {
    "water", "road", "housing", "education",
    "health", "jobs", "pension", "sanitation", "other",
}
ALLOWED_URGENCY = {"critical", "high", "medium", "low"}

# One module-level client, reused across calls. Created lazily so importing
# the module never crashes even if the key is momentarily absent.
_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


def _safe_default() -> dict:
    """Returned whenever the model or parsing fails — never raises upstream."""
    return {
        "category": "other",
        "need_detail": "",
        "urgency": "medium",
        "urgency_reason": "",
        "beneficiary_estimate": None,
        "location_clues": [],
    }


_PROMPT = """You are a civic-complaint analyst for an Indian MP's constituency office.
Read the citizen complaint below (it may be in Tamil, English, or mixed) and extract a
structured record. Respond with a SINGLE JSON object and nothing else.

Fields:
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

Complaint:
\"\"\"{text}\"\"\"
"""


def extract(text: str, language: str = "ta") -> dict:
    """Extract a structured demand record from raw complaint text.

    Always returns a dict with exactly these keys:
        category, need_detail, urgency, urgency_reason,
        beneficiary_estimate, location_clues

    On any API/parse error, returns a safe default with category "other".
    """
    prompt = _PROMPT.format(language=language, text=text)

    try:
        client = _get_client()
        resp = client.models.generate_content(
            model=_MODEL,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        data = json.loads(resp.text)
    except Exception as exc:  # noqa: BLE001 — pipeline must never crash here
        print(f"[extract] falling back to default: {type(exc).__name__}: {exc}")
        return _safe_default()

    if not isinstance(data, dict):
        return _safe_default()

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
        out["location_clues"] = [str(c) for c in clues if isinstance(c, (str, int, float))]

    return out


if __name__ == "__main__":
    # 6 sample complaints (Tamil + English) with known expected categories.
    samples = [
        (
            "எங்கள் தெரு குடிநீர் குழாய் மூன்று வாரமாக உடைந்து கிடக்கிறது, "
            "தண்ணீர் வரவே இல்லை. அண்ணா நகர் 4வது தெரு.",
            "ta", "water",
        ),
        (
            "The main road in Gandhi Nagar has huge potholes and two accidents "
            "happened last week. Please repair urgently.",
            "en", "road",
        ),
        (
            "எங்கள் கிராமத்தில் அரசு பள்ளியில் ஆசிரியர்கள் இல்லை, "
            "குழந்தைகள் படிக்க முடியவில்லை.",
            "ta", "education",
        ),
        (
            "My old-age pension has not been credited for the last six months. "
            "I am 72 years old and have no other income.",
            "en", "pension",
        ),
        (
            "எங்கள் பகுதியில் சாக்கடை வழிந்தோடி நோய் பரவும் அபாயம் உள்ளது, "
            "கொசு தொல்லை அதிகம்.",
            "ta", "sanitation",
        ),
        (
            "The primary health centre near our village has no doctor and no "
            "medicines. Around 300 families depend on it.",
            "en", "health",
        ),
    ]

    correct = 0
    for i, (text, lang, expected) in enumerate(samples, 1):
        result = extract(text, language=lang)
        got = result["category"]
        ok = got == expected
        correct += ok
        mark = "OK " if ok else "XX "
        print(f"{mark}[{i}] expected={expected:<10} got={got:<10} "
              f"urgency={result['urgency']:<8} "
              f"benef={result['beneficiary_estimate']} "
              f"clues={result['location_clues']}")
        print(f"      need: {result['need_detail']}")

    print(f"\nAccuracy: {correct}/{len(samples)} "
          f"({100 * correct / len(samples):.0f}%)")
