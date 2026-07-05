"""
Step 8 — MPLADS budget optimiser (0/1 knapsack).

Track B projects each have a priority score (value) and an estimated cost. The
MP has a fixed annual MPLADS envelope (₹5 crore). Pick the subset of projects
that maximises total priority subject to total cost <= budget.

Solved exactly with OR-Tools' KnapsackSolver. Pure: candidates in -> selection
out, no I/O.
"""
from __future__ import annotations

from typing import Dict, List, Tuple

from ortools.algorithms.python import knapsack_solver

# ₹5 crore annual MPLADS allocation.
DEFAULT_BUDGET = 50_000_000

# OR-Tools works in integers; scale float priority scores to preserve precision.
_VALUE_SCALE = 1_000_000


def knapsack_select(
    candidates: List[Dict],
    budget: int = DEFAULT_BUDGET,
) -> Tuple[List[Dict], float, int]:
    """
    Select Track B projects maximising Σ priority_score s.t. Σ cost <= budget.

    Each candidate needs `priority_score` (float) and `estimated_cost` (₹). Items
    that individually exceed the budget are simply never selected.

    Returns (selected_candidates, total_priority, total_cost).
    """
    if not candidates:
        return [], 0.0, 0

    values = [max(0, round(float(c.get("priority_score", 0.0)) * _VALUE_SCALE)) for c in candidates]
    costs = [max(0, int(round(float(c.get("estimated_cost", 0.0) or 0.0)))) for c in candidates]

    solver = knapsack_solver.KnapsackSolver(
        knapsack_solver.KnapsackSolver.KNAPSACK_MULTIDIMENSION_BRANCH_AND_BOUND_SOLVER
        if hasattr(knapsack_solver.KnapsackSolver, "KNAPSACK_MULTIDIMENSION_BRANCH_AND_BOUND_SOLVER")
        else knapsack_solver.KNAPSACK_MULTIDIMENSION_BRANCH_AND_BOUND_SOLVER,
        "mplads_knapsack",
    )
    solver.init(values, [costs], [int(budget)])
    solver.solve()

    selected: List[Dict] = []
    total_priority = 0.0
    total_cost = 0
    for i, cand in enumerate(candidates):
        if solver.best_solution_contains(i):
            selected.append(cand)
            total_priority += float(cand.get("priority_score", 0.0))
            total_cost += costs[i]

    return selected, total_priority, total_cost
