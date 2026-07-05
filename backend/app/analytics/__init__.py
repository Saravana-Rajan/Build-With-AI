"""
Analytics engine — pipeline Steps 4–8.

Pure, testable functions built against the canonical data contract in
`backend/app/schema.py`. No I/O in the compute functions (the routing table
is loaded once from data/schemes.json by scheme_routing).
"""
from .scheme_routing import route
from .gap_math import compute_gap
from .silent import silent_score
from .scoring import WEIGHTS, priority, rank_candidates
from .optimizer import knapsack_select

__all__ = [
    "route",
    "compute_gap",
    "silent_score",
    "WEIGHTS",
    "priority",
    "rank_candidates",
    "knapsack_select",
]
