"""
Canonical data contract for Sarvik.

EVERY module (pipeline, analytics, letters, ingestion, frontend types) builds
against these shapes. Do not redefine these fields elsewhere — import from here.
"""
from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

# ── Controlled vocabularies ──────────────────────────────────────────────────
Category = Literal[
    "water", "road", "housing", "education",
    "health", "jobs", "pension", "sanitation", "other",
]
Urgency = Literal["critical", "high", "medium", "low"]
# Track A = unlock an existing entitlement (₹0 of MPLADS); Track B = spend MPLADS.
Track = Literal["A", "B"]
MatchType = Literal["delivery_failure", "coverage_gap", "mplads_candidate"]
Source = Literal["web", "telegram", "phone", "meeting", "import"]


# ── Step 0: raw intake ───────────────────────────────────────────────────────
class Submission(BaseModel):
    id: str
    source: Source = "web"
    language_hint: Optional[str] = None          # "ta" | "en" | "hi"
    raw_text: Optional[str] = None               # text, or STT output
    voice_path: Optional[str] = None
    photo_path: Optional[str] = None
    created_at: datetime
    synthetic: bool = False


# ── Steps 1–3: structured, geo-resolved, scheme-matched ──────────────────────
class DemandRecord(BaseModel):
    id: str
    source: Source = "web"
    language: str = "ta"
    raw_text: str
    translated_text: Optional[str] = None        # English, for the pipeline

    # Step 1 — extraction
    category: Category = "other"
    need_detail: str = ""
    urgency: Urgency = "medium"
    urgency_reason: Optional[str] = None
    beneficiary_estimate: Optional[int] = None

    # Step 2 — geo resolution (mixed key: ward for urban, village for rural)
    place_name: Optional[str] = None
    area_id: Optional[str] = None                # "W-12" (urban) | "V-3" (rural)
    urban: bool = True
    lgd_or_ward_code: Optional[str] = None
    location_confidence: float = 0.0

    # Step 3 — scheme matching
    matched_scheme: Optional[str] = None         # e.g. "JJM", "PMAY-U", None→MPLADS
    match_type: Optional[MatchType] = None
    track: Optional[Track] = None

    created_at: datetime
    synthetic: bool = False


# ── Steps 5–8: analytics outputs ─────────────────────────────────────────────
class SchemeGap(BaseModel):
    area_id: str
    place_name: str
    urban: bool
    scheme: str
    eligible: int
    covered: int
    gap: int = Field(..., description="eligible - covered")
    per_unit_value: float
    gap_value: float = Field(..., description="gap * per_unit_value (₹)")
    data_source: Literal["real", "modelled"] = "modelled"


class RankedProject(BaseModel):
    rank: int
    area_id: str
    place_name: str
    title: str
    category: Category
    track: Track
    priority_score: float
    why: dict                                    # factor -> contribution, for the UI
    estimated_cost: Optional[float] = None       # ₹, Track B only
    beneficiaries: Optional[int] = None
    matched_scheme: Optional[str] = None


class SilentVillage(BaseModel):
    area_id: str
    place_name: str
    need_score: float
    petition_count: int
    silent_score: float
    flagged: bool
