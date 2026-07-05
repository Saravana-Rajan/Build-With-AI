"""Pipeline Step 2: Geo-resolution.

Resolves free-text location clues (and optional lat/lng) to a known
Coimbatore urban ward or fringe village by fuzzy name matching against
local JSON gazetteers. No network / external credentials required.

Result schema (exact keys):
    {
        "place_name": str | None,
        "area_id": str | None,
        "urban": bool,
        "lgd_or_ward_code": str | None,
        "location_confidence": float,
    }
"""

from __future__ import annotations

import json
from difflib import SequenceMatcher
from pathlib import Path

# --- Load gazetteers once at module level ------------------------------------

# geo.py -> pipeline -> app -> backend -> <repo root>
_REPO_ROOT = Path(__file__).resolve().parents[3]
_DATA_DIR = _REPO_ROOT / "data" / "coimbatore"

_CONFIDENT = 0.8
_TENTATIVE = 0.6


def _load(path: Path) -> list[dict]:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


_WARDS = _load(_DATA_DIR / "urban_wards.json")
_VILLAGES = _load(_DATA_DIR / "fringe_villages.json")

# Flat name index: list of (normalized_name, record) tuples.
_INDEX: list[tuple[str, dict]] = [
    (str(rec.get("name", "")).strip().lower(), rec)
    for rec in (_WARDS + _VILLAGES)
]


# --- Helpers -----------------------------------------------------------------

def _norm(text: str) -> str:
    return text.strip().lower()


def _ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _code_for(rec: dict) -> str | None:
    """Ward id for urban records, lgd_code (or id fallback) for rural."""
    if rec.get("urban"):
        return rec.get("id")
    return rec.get("lgd_code") or rec.get("id")


def _best_match(clue: str) -> tuple[float, dict | None]:
    """Return (best_ratio, record) for a single clue across all names."""
    norm_clue = _norm(clue)
    if not norm_clue:
        return 0.0, None

    best_ratio = 0.0
    best_rec: dict | None = None
    for name, rec in _INDEX:
        if not name:
            continue
        r = _ratio(norm_clue, name)
        # Boost: reward clues that contain a known name as a substring
        # (e.g. "Gandhipuram near temple").
        if name in norm_clue:
            r = max(r, 0.9)
        if r > best_ratio:
            best_ratio, best_rec = r, rec
    return best_ratio, best_rec


# --- Public API --------------------------------------------------------------

def resolve(
    location_clues: list[str],
    lat: float | None = None,
    lng: float | None = None,
) -> dict:
    """Resolve location clues to a known ward/village.

    lat/lng: if provided, a point-in-polygon lookup would refine the match.
    TODO: add point-in-polygon resolution once ward/village boundary
    polygons are available; for now coordinates are unused (nearest-by-
    approx-coord is an optional future enhancement).
    """
    result = {
        "place_name": None,
        "area_id": None,
        "urban": True,  # default assumption: urban
        "lgd_or_ward_code": None,
        "location_confidence": 0.0,
    }

    if not location_clues:
        return result

    # Find the single best match across every clue.
    best_ratio = 0.0
    best_rec: dict | None = None
    best_clue: str | None = None
    for clue in location_clues:
        if not clue or not clue.strip():
            continue
        ratio, rec = _best_match(clue)
        if ratio > best_ratio:
            best_ratio, best_rec, best_clue = ratio, rec, clue

    first_clue = next(
        (c for c in location_clues if c and c.strip()), None
    )

    # Confident or tentative: >= 0.6 with a matched record.
    if best_rec is not None and best_ratio >= _TENTATIVE:
        result["place_name"] = best_rec.get("name")
        result["area_id"] = best_rec.get("id")
        result["urban"] = bool(best_rec.get("urban", True))
        result["lgd_or_ward_code"] = _code_for(best_rec)
        result["location_confidence"] = round(best_ratio, 3)
        return result

    # Low confidence / no usable match: keep raw clue, defaults elsewhere.
    result["place_name"] = first_clue
    result["location_confidence"] = 0.0
    return result


# --- Manual test -------------------------------------------------------------

if __name__ == "__main__":
    import sys

    # Ensure non-ASCII (e.g. Tamil) clues print on any console.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:  # pragma: no cover
        pass

    tests = [
        ["Peelamedu"],
        ["Sulur"],
        ["Gandhipuram near temple"],
        ["unknownplace"],
        ["ஸ்ரீ ராமபுரம்"],  # ஸ்ரீ ராமபுரம்
    ]
    for clues in tests:
        print(f"{clues!r:<40} -> {resolve(clues)}")
