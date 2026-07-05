"""
Step 6 — silent villages.

Areas that clearly *need* help but almost nobody is petitioning for. High need +
low petition volume = a place being drowned out by louder, better-organised
areas. We surface these so they are not ignored.

silent_score = need_score / log(petition_count + 2)

The +2 guarantees the denominator is log(2) > 0 even at petition_count == 0, so
we NEVER divide by zero. More petitions -> larger denominator -> lower silence.
"""
from __future__ import annotations

from math import log
from typing import Dict

# Need threshold above which a zero-petition area is a red flag.
FLAG_NEED_THRESHOLD = 0.6


def silent_score(need_score: float, petition_count: int) -> Dict[str, object]:
    """
    Return the SilentVillage numeric fields for one area.

    - silent_score = need_score / log(petition_count + 2)  (safe: denom >= log(2))
    - flagged      = True when nobody has petitioned (petition_count == 0) yet
                     the need is high (need_score > 0.6).

    Returns a dict with keys: need_score, petition_count, silent_score, flagged.
    """
    need_score = float(need_score)
    petition_count = int(petition_count)
    if petition_count < 0:
        petition_count = 0

    denom = log(petition_count + 2)  # petition_count >= 0 => denom >= log(2) > 0
    score = need_score / denom

    flagged = petition_count == 0 and need_score > FLAG_NEED_THRESHOLD

    return {
        "need_score": need_score,
        "petition_count": petition_count,
        "silent_score": score,
        "flagged": flagged,
    }
