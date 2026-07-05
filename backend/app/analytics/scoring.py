"""
Step 7 — transparent priority scoring.

A single, explainable additive weighted score so a citizen (or an auditor) can
see *exactly* why one project outranks another:

  score = 0.30*demand + 0.35*need + 0.20*feasibility + 0.15*equity

All four factors are expected in [0, 1]; the score is therefore in [0, 1] too.
Weights live in a tunable config dict (they sum to 1.0). Every ranking carries a
`why` dict giving each factor's contribution (weight * value).
"""
from __future__ import annotations

from typing import Dict, List

# Tunable weights. MUST sum to 1.0 (enforced by tests / validate_weights()).
WEIGHTS: Dict[str, float] = {
    "demand": 0.30,       # how many people are asking / affected
    "need": 0.35,         # severity / urgency of the need
    "feasibility": 0.20,  # how deliverable it is
    "equity": 0.15,       # fairness boost for under-served areas
}

_FACTORS = ("demand", "need", "feasibility", "equity")


def validate_weights(weights: Dict[str, float] = WEIGHTS, tol: float = 1e-9) -> bool:
    """True iff the weights sum to 1.0 (within tolerance)."""
    return abs(sum(weights.values()) - 1.0) <= tol


def priority(candidate: Dict[str, float], weights: Dict[str, float] = WEIGHTS) -> Dict:
    """
    Score one candidate. Pure: dict in -> dict out.

    `candidate` provides the four factors (missing factors default to 0.0).
    Returns {"priority_score": float, "why": {factor: contribution, ...}} where
    each contribution = weights[factor] * candidate[factor].
    """
    why: Dict[str, float] = {}
    score = 0.0
    for factor in _FACTORS:
        value = float(candidate.get(factor, 0.0) or 0.0)
        contribution = weights[factor] * value
        why[factor] = contribution
        score += contribution
    return {"priority_score": score, "why": why}


def rank_candidates(
    candidates: List[Dict], weights: Dict[str, float] = WEIGHTS
) -> List[Dict]:
    """
    Score and rank candidates, highest priority first.

    Returns new dicts (inputs untouched), each augmented with `priority_score`,
    `why`, and a 1-based `rank`.
    """
    scored = []
    for cand in candidates:
        result = priority(cand, weights)
        merged = dict(cand)
        merged["priority_score"] = result["priority_score"]
        merged["why"] = result["why"]
        scored.append(merged)

    scored.sort(key=lambda c: c["priority_score"], reverse=True)
    for i, cand in enumerate(scored, start=1):
        cand["rank"] = i
    return scored
