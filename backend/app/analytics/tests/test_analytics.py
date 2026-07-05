"""
Tests for the analytics engine (pipeline Steps 4–8).

Covers the required cases: divide-by-zero safety, gap floor, knapsack budget
respected, and weights summing to 1 — plus routing urban/rural and the
schema-compatibility of every output shape.
"""
from __future__ import annotations

import math

from backend.app.schema import SchemeGap, SilentVillage
from backend.app.analytics import (
    route,
    compute_gap,
    silent_score,
    WEIGHTS,
    priority,
    rank_candidates,
    knapsack_select,
)
from backend.app.analytics.scoring import validate_weights
from backend.app.analytics.optimizer import DEFAULT_BUDGET


# ── scheme_routing ───────────────────────────────────────────────────────────
def test_route_urban_vs_rural_housing():
    assert route("housing", urban=True) == ("PMAY-U", "A")
    assert route("housing", urban=False) == ("PMAY-G", "A")


def test_route_rural_water_and_jobs():
    assert route("water", urban=False) == ("JJM", "A")
    assert route("jobs", urban=False) == ("MGNREGA", "A")
    assert route("sanitation", urban=False) == ("SBM-G", "A")


def test_route_no_scheme_is_mplads_candidate():
    scheme, track = route("road", urban=True)
    assert scheme is None
    assert track == "B"


def test_route_unknown_category_defaults_to_track_b():
    assert route("spaceport", urban=True) == (None, "B")


# ── gap_math ─────────────────────────────────────────────────────────────────
def test_gap_basic():
    g = compute_gap(eligible=100, covered=40, per_unit_value=120000)
    assert g["gap"] == 60
    assert g["gap_value"] == 60 * 120000


def test_gap_floored_at_zero():
    # covered exceeds eligible -> gap must not go negative
    g = compute_gap(eligible=10, covered=25, per_unit_value=18000)
    assert g["gap"] == 0
    assert g["gap_value"] == 0


def test_gap_fields_build_schemegap():
    g = compute_gap(eligible=50, covered=20, per_unit_value=12000)
    model = SchemeGap(
        area_id="V-3",
        place_name="Somewhere",
        urban=False,
        scheme="SBM-G",
        **g,
    )
    assert model.gap == 30
    assert model.gap_value == 30 * 12000


# ── silent ───────────────────────────────────────────────────────────────────
def test_silent_no_divide_by_zero_at_zero_petitions():
    s = silent_score(need_score=0.8, petition_count=0)
    assert math.isfinite(s["silent_score"])
    assert s["silent_score"] == 0.8 / math.log(2)


def test_silent_flag_high_need_zero_petitions():
    assert silent_score(0.9, 0)["flagged"] is True
    # high need but people ARE petitioning -> not silent
    assert silent_score(0.9, 5)["flagged"] is False
    # zero petitions but low need -> not flagged
    assert silent_score(0.3, 0)["flagged"] is False


def test_silent_more_petitions_lower_score():
    quiet = silent_score(0.7, 0)["silent_score"]
    loud = silent_score(0.7, 50)["silent_score"]
    assert quiet > loud


def test_silent_fields_build_silentvillage():
    s = silent_score(0.75, 0)
    model = SilentVillage(area_id="V-9", place_name="Faraway", **s)
    assert model.flagged is True


# ── scoring ──────────────────────────────────────────────────────────────────
def test_weights_sum_to_one():
    assert validate_weights(WEIGHTS)
    assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9


def test_priority_additive_and_why_breakdown():
    cand = {"demand": 1.0, "need": 1.0, "feasibility": 1.0, "equity": 1.0}
    result = priority(cand)
    assert abs(result["priority_score"] - 1.0) < 1e-9  # all-1 factors -> score 1
    assert result["why"]["need"] == 0.35
    assert abs(sum(result["why"].values()) - result["priority_score"]) < 1e-9


def test_rank_orders_highest_first():
    cands = [
        {"id": "low", "demand": 0.1, "need": 0.1, "feasibility": 0.1, "equity": 0.1},
        {"id": "high", "demand": 0.9, "need": 0.9, "feasibility": 0.9, "equity": 0.9},
    ]
    ranked = rank_candidates(cands)
    assert ranked[0]["id"] == "high"
    assert ranked[0]["rank"] == 1
    assert ranked[1]["rank"] == 2


# ── optimizer ────────────────────────────────────────────────────────────────
def _mk(id_, score, cost):
    return {"id": id_, "priority_score": score, "estimated_cost": cost}


def test_knapsack_respects_budget():
    cands = [
        _mk("a", 0.9, 30_000_000),
        _mk("b", 0.8, 30_000_000),
        _mk("c", 0.5, 20_000_000),
    ]
    selected, total_priority, total_cost = knapsack_select(cands, budget=DEFAULT_BUDGET)
    assert total_cost <= DEFAULT_BUDGET
    ids = {c["id"] for c in selected}
    # can't fit a+b (60M > 50M); best within budget is a + c (0.9+0.5, 50M)
    assert ids == {"a", "c"}
    assert total_cost == 50_000_000


def test_knapsack_maximises_priority():
    cands = [
        _mk("cheap_low", 0.2, 10_000_000),
        _mk("expensive_high", 0.95, 50_000_000),
    ]
    selected, total_priority, total_cost = knapsack_select(cands)
    assert {c["id"] for c in selected} == {"expensive_high"}
    assert total_cost <= DEFAULT_BUDGET


def test_knapsack_empty():
    selected, total_priority, total_cost = knapsack_select([])
    assert selected == []
    assert total_priority == 0.0
    assert total_cost == 0


def test_knapsack_skips_item_over_budget():
    cands = [_mk("toobig", 1.0, 60_000_000), _mk("ok", 0.4, 10_000_000)]
    selected, _, total_cost = knapsack_select(cands)
    assert {c["id"] for c in selected} == {"ok"}
    assert total_cost <= DEFAULT_BUDGET
