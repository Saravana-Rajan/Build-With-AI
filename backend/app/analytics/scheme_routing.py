"""
Step 4 — scheme routing.

Maps a demand `category` to the government scheme responsible for it, split by
urban vs rural, and decides the funding track:

  Track A = an existing scheme owns the need -> unlock the entitlement (~0 MPLADS).
  Track B = no scheme owns it -> MPLADS candidate (spend the MP's local fund).

The routing table lives in `data/schemes.json` (loaded once at import time).
`route()` itself is a pure lookup: (category, urban) -> (scheme|None, track).
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Optional, Tuple

from ..schema import Track

# data/schemes.json, relative to repo root (…/backend/app/analytics/ -> repo root)
_REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
_SCHEMES_PATH = os.path.join(_REPO_ROOT, "data", "schemes.json")


@lru_cache(maxsize=1)
def _load_table() -> dict:
    with open(_SCHEMES_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def per_unit_value(category: str, urban: bool) -> float:
    """Realistic per-unit ₹ value for a category (0.0 if no scheme / unknown)."""
    table = _load_table()
    bucket = table["urban" if urban else "rural"]
    entry = bucket.get(category)
    if not entry:
        return 0.0
    return float(entry.get("per_unit_value") or 0.0)


def route(category: str, urban: bool) -> Tuple[Optional[str], Track]:
    """
    Pure lookup. Returns (scheme, track).

    - Known category with a scheme -> (scheme_name, "A").
    - Known category with no scheme (e.g. road/other) -> (None, "B"), i.e. an
      MPLADS candidate.
    - Unknown category -> (None, "B") as a safe default.
    """
    table = _load_table()
    bucket = table["urban" if urban else "rural"]
    entry = bucket.get(category)
    if entry is None:
        return None, "B"
    scheme = entry.get("scheme")
    if scheme is None:
        return None, "B"
    track: Track = entry.get("track", "A")  # type: ignore[assignment]
    return scheme, track
