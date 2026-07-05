"""
Ask Sarvik — a grounded Q&A endpoint for the MP.

``POST /ask`` takes a free-text ``{question}`` about the Coimbatore constituency,
pulls a *compact* data context straight from BigQuery (aggregates only, never raw
rows), and asks Gemini to answer using ONLY that context. Returns ``{answer}``.

Mounted by the owner in ``app/main.py``::

    from app.ask import routes as ask_routes
    app.include_router(ask_routes.router, prefix="/api")

No secrets are printed. If Gemini credentials are missing, the endpoint returns a
graceful, data-derived fallback answer instead of raising.
"""
from __future__ import annotations

import os

from fastapi import APIRouter
from pydantic import BaseModel

from ..store import bq

router = APIRouter()

DS = bq.DATASET


class AskRequest(BaseModel):
    question: str


SYSTEM_INSTRUCTION = (
    "You are Sarvik, answering an Indian MP about their Coimbatore constituency "
    "using ONLY the provided data; be concise, cite the numbers, say if data "
    "doesn't cover it."
)


# ── Data context (compact aggregates from BigQuery) ──────────────────────────
def _q(sql: str, default=None):
    """Run a query, returning rows (list of dicts) or ``default`` on any error."""
    try:
        return bq.query(sql)
    except Exception:  # noqa: BLE001 — context must degrade, never crash /ask
        return default if default is not None else []


def _scalar(sql, default=0):
    rows = _q(sql)
    if rows:
        vals = list(rows[0].values())
        if vals and vals[0] is not None:
            return vals[0]
    return default


def _rupees(value) -> str:
    """Format ₹ as a compact crore string for the prompt."""
    try:
        return f"₹{float(value) / 1e7:.2f} crore"
    except Exception:  # noqa: BLE001
        return "₹—"


def build_data_context() -> str:
    """Assemble a small, aggregate-only snapshot of the constituency data."""
    total_owed = _scalar(f"SELECT SUM(gap_value) FROM `{DS}.scheme_gaps`", 0) or 0
    complaints = _scalar(f"SELECT COUNT(*) FROM `{DS}.complaints_synthetic`", 0) or 0
    silent = _scalar(
        f"SELECT COUNT(*) FROM `{DS}.silent_villages` WHERE flagged = true", 0
    ) or 0

    departments = _q(
        f"SELECT department, total_gap_value, issue_count, schemes, top_areas "
        f"FROM `{DS}.department_summary` ORDER BY total_gap_value DESC LIMIT 20"
    )
    scheme_gaps = _q(
        f"SELECT place_name, scheme, department, gap, gap_value "
        f"FROM `{DS}.scheme_gaps` ORDER BY gap_value DESC LIMIT 10"
    )
    projects = _q(
        f"SELECT rank, place_name, title, category, track, priority_score, "
        f"estimated_cost, beneficiaries FROM `{DS}.ranked_projects` "
        f"ORDER BY priority_score DESC LIMIT 10"
    )
    silent_villages = _q(
        f"SELECT place_name, silent_score, petition_count "
        f"FROM `{DS}.silent_villages` WHERE flagged = true "
        f"ORDER BY silent_score DESC LIMIT 10"
    )

    lines: list[str] = []
    lines.append("=== COIMBATORE CONSTITUENCY DATA CONTEXT ===")
    lines.append("")
    lines.append("OVERALL:")
    lines.append(f"- Total entitlements owed (Σ scheme gap value): {_rupees(total_owed)}")
    lines.append(f"- Complaints / demands recorded: {int(complaints)}")
    lines.append(f"- Flagged silent (under-petitioning) villages: {int(silent)}")
    lines.append("")

    lines.append("DEPARTMENTS (₹ owed, open issues, schemes, top areas):")
    if departments:
        for d in departments:
            schemes = ", ".join((d.get("schemes") or [])[:6]) or "—"
            areas = ", ".join((d.get("top_areas") or [])[:5]) or "—"
            lines.append(
                f"- {d.get('department', '—')}: {_rupees(d.get('total_gap_value'))} owed, "
                f"{int(d.get('issue_count') or 0)} issues | schemes: {schemes} | "
                f"top areas: {areas}"
            )
    else:
        lines.append("- (no department summary available)")
    lines.append("")

    lines.append("TOP 10 SCHEME GAPS (largest ₹ first):")
    if scheme_gaps:
        for g in scheme_gaps:
            lines.append(
                f"- {g.get('place_name', '—')} · {g.get('scheme', '—')} "
                f"({g.get('department') or 'dept —'}): gap of "
                f"{int(g.get('gap') or 0)} = {_rupees(g.get('gap_value'))}"
            )
    else:
        lines.append("- (no scheme gaps available)")
    lines.append("")

    lines.append("TOP 10 RANKED PROJECTS (highest priority first):")
    if projects:
        for p in projects:
            cost = _rupees(p.get("estimated_cost")) if p.get("estimated_cost") else "Track A / ₹0 MPLADS"
            lines.append(
                f"- #{int(p.get('rank') or 0)} {p.get('title', '—')} "
                f"@ {p.get('place_name', '—')} [{p.get('category', '—')}, "
                f"Track {p.get('track', '—')}] score {round(float(p.get('priority_score') or 0), 2)} · "
                f"{cost} · {int(p.get('beneficiaries') or 0)} beneficiaries"
            )
    else:
        lines.append("- (no ranked projects available)")
    lines.append("")

    lines.append("TOP SILENT / FORGOTTEN VILLAGES (highest silence first):")
    if silent_villages:
        for s in silent_villages:
            lines.append(
                f"- {s.get('place_name', '—')}: silent_score "
                f"{round(float(s.get('silent_score') or 0), 2)}, "
                f"{int(s.get('petition_count') or 0)} petitions"
            )
    else:
        lines.append("- (no silent villages available)")

    return "\n".join(lines)


# ── Gemini call ──────────────────────────────────────────────────────────────
def _ask_gemini(question: str, context: str) -> str | None:
    """Call Gemini with the data context + question. Returns None on failure."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return None

    try:
        from google import genai
        from google.genai import types

        model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        client = genai.Client(api_key=api_key)

        prompt = (
            f"{context}\n\n"
            f"=== QUESTION FROM THE MP ===\n{question}\n\n"
            "Answer using ONLY the data above. Cite the specific numbers. If the "
            "data doesn't cover the question, say so plainly."
        )
        resp = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.2,
            ),
        )
        text = (getattr(resp, "text", "") or "").strip()
        return text or None
    except Exception:  # noqa: BLE001 — never leak errors/keys; fall back instead
        return None


# ── Endpoint ─────────────────────────────────────────────────────────────────
@router.post("/ask")
def ask(req: AskRequest):
    """Answer an MP's question, grounded in the constituency data."""
    question = (req.question or "").strip()
    if not question:
        return {"answer": "Please ask a question about the constituency data."}

    context = build_data_context()
    answer = _ask_gemini(question, context)

    if not answer:
        # Graceful, data-derived fallback when Gemini is unavailable.
        answer = (
            "I couldn't reach the language model just now, but here is the current "
            "constituency data snapshot to work from:\n\n" + context
        )

    return {"answer": answer}
