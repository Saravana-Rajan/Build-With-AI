"""
Intake router — the pipeline glue (Steps 0-3).

Chains: submission -> extract (text) or multimodal (voice/photo/pdf)
        -> geo-resolve -> scheme-match -> DemandRecord -> BigQuery.

Exposes process_* functions (unit-testable without a server) and a FastAPI router.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.schema import DemandRecord
from app.pipeline import extract as extract_mod
from app.pipeline import geo as geo_mod
from app.pipeline import multimodal as mm
from app.analytics.scheme_routing import route
from app.store import bq

router = APIRouter()


def _assemble(extracted: dict, source: str, language: str, raw_text: str) -> DemandRecord:
    """Turn an extraction dict + geo + scheme-match into a DemandRecord."""
    geo = geo_mod.resolve(extracted.get("location_clues", []) or [])
    scheme, track = route(extracted.get("category", "other"), geo.get("urban", True))
    match_type = None
    if scheme:
        # Real delivery_failure vs coverage_gap needs coverage data (analytics job);
        # at intake we mark it a candidate coverage_gap; the batch job refines it.
        match_type = "coverage_gap"
    else:
        match_type = "mplads_candidate"

    return DemandRecord(
        id=f"REC-{uuid.uuid4().hex[:10]}",
        source=source,
        language=language,
        raw_text=raw_text,
        translated_text=extracted.get("transcript") or None,
        category=extracted.get("category", "other"),
        need_detail=extracted.get("need_detail", ""),
        urgency=extracted.get("urgency", "medium"),
        urgency_reason=extracted.get("urgency_reason"),
        beneficiary_estimate=extracted.get("beneficiary_estimate"),
        place_name=geo.get("place_name"),
        area_id=geo.get("area_id"),
        urban=geo.get("urban", True),
        lgd_or_ward_code=geo.get("lgd_or_ward_code"),
        location_confidence=geo.get("location_confidence", 0.0),
        matched_scheme=scheme,
        match_type=match_type,
        track=track,
        created_at=datetime.now(timezone.utc),
    )


def _persist(rec: DemandRecord) -> None:
    """Best-effort write to BigQuery; never blocks the citizen ack."""
    try:
        row = rec.model_dump()
        row["created_at"] = rec.created_at.isoformat()
        bq.insert_rows("demand_records", [row])
    except Exception as exc:  # noqa: BLE001 — intake must not fail on a write hiccup
        print(f"[intake] persist skipped: {exc}")


def process_text(text: str, language: str = "ta", source: str = "web") -> DemandRecord:
    extracted = extract_mod.extract(text, language)
    rec = _assemble(extracted, source, language, text)
    _persist(rec)
    return rec


def process_media(file_path: str, mime_type: Optional[str] = None,
                  language: str = "ta", source: str = "telegram") -> DemandRecord:
    extracted = mm.extract_from_media(file_path, mime_type, language)
    raw = extracted.get("transcript", "") or "[media submission]"
    rec = _assemble(extracted, source, language, raw)
    _persist(rec)
    return rec


# ── HTTP ──────────────────────────────────────────────────────────────────────
@router.post("/intake")
async def intake(
    text: Optional[str] = Form(None),
    language: str = Form("ta"),
    source: str = Form("web"),
    file: Optional[UploadFile] = File(None),
):
    """Accept a text complaint or an uploaded media file (voice/photo/pdf)."""
    if not text and not file:
        raise HTTPException(400, "Provide 'text' or a 'file'.")
    if file:
        import tempfile, os
        suffix = os.path.splitext(file.filename or "")[1] or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        rec = process_media(tmp_path, file.content_type, language, source)
    else:
        rec = process_text(text, language, source)

    return {
        "reference": rec.id,
        "ack": "உங்கள் புகார் பெறப்பட்டது / आपकी शिकायत मिल गई / Your complaint has been received.",
        "record": rec.model_dump(),
    }
