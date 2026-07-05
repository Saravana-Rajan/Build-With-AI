"""
Step 5 — scheme gap math.

Given how many people are *eligible* for a scheme in an area and how many are
already *covered*, compute the coverage gap and its rupee value. Pure arithmetic.
"""
from __future__ import annotations

from typing import Dict


def compute_gap(eligible: int, covered: int, per_unit_value: float) -> Dict[str, float]:
    """
    Return the SchemeGap numeric fields for one (area, scheme) pair.

    gap        = max(eligible - covered, 0)   # floored at 0; never negative
    gap_value  = gap * per_unit_value          # ₹ needed to close the gap

    Returns a dict with keys: eligible, covered, gap, per_unit_value, gap_value.
    These map directly onto `schema.SchemeGap` fields.
    """
    eligible = int(eligible)
    covered = int(covered)
    per_unit_value = float(per_unit_value)

    gap = eligible - covered
    if gap < 0:
        gap = 0

    return {
        "eligible": eligible,
        "covered": covered,
        "gap": gap,
        "per_unit_value": per_unit_value,
        "gap_value": gap * per_unit_value,
    }
