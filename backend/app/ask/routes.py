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
    "You are Sarvik, a senior policy & data analyst advising an Indian MP on their "
    "Coimbatore constituency. Answer ONLY from the provided data. Give a THOROUGH, "
    "STRUCTURED answer: cite exact numbers, name specific areas/schemes/departments, "
    "explain the WHY, compare options where relevant, and END with a concrete "
    "recommended next action for the MP. Never give a shallow one-liner — be the "
    "MP's expert advisor. Format with markdown (bold, bullet/numbered lists).\n\n"
    "BUDGET / ₹5-crore rule: Track A items cost the MP ₹0 — they are existing "
    "entitlements unlocked simply by the MP writing official letters to the relevant "
    "department. So the ₹5 crore MPLADS fund applies to Track B (no-scheme) works. "
    "For any budget question, explain this split first, then list the Track B "
    "candidates with their estimated costs and recommend a concrete funding mix that "
    "fits the ₹5 crore envelope."
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
    """Assemble a rich, aggregate-only snapshot of the constituency data."""
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
        f"SELECT place_name, scheme, department, eligible, covered, gap, gap_value, "
        f"data_source FROM `{DS}.scheme_gaps` ORDER BY gap_value DESC LIMIT 20"
    )
    projects = _q(
        f"SELECT rank, place_name, category, track, matched_scheme, priority_score, "
        f"verdict, justification, estimated_cost FROM `{DS}.ranked_projects` "
        f"ORDER BY priority_score DESC LIMIT 20"
    )
    silent_villages = _q(
        f"SELECT place_name, need_score, petition_count "
        f"FROM `{DS}.silent_villages` WHERE flagged = true "
        f"ORDER BY need_score DESC LIMIT 15"
    )
    complaint_cats = _q(
        f"SELECT true_category, COUNT(*) AS n FROM `{DS}.complaints_synthetic` "
        f"GROUP BY true_category ORDER BY n DESC"
    )
    unified = _q(
        f"SELECT category, place_name, report_count FROM `{DS}.unified_issues` "
        f"ORDER BY report_count DESC LIMIT 10"
    )

    lines: list[str] = []
    lines.append("=== COIMBATORE CONSTITUENCY DATA CONTEXT ===")
    lines.append("")
    lines.append("HEADLINE:")
    lines.append(f"- Total entitlements owed (Σ scheme gap value): {_rupees(total_owed)}")
    lines.append(f"- Complaints / demands recorded: {int(complaints)}")
    lines.append(f"- Flagged silent (under-petitioning) villages: {int(silent)}")
    lines.append("")

    lines.append("DEPARTMENT SUMMARY (all departments — ₹ owed, open issues, schemes, top areas):")
    if departments:
        for d in departments:
            schemes = ", ".join((d.get("schemes") or [])[:8]) or "—"
            areas = ", ".join((d.get("top_areas") or [])[:6]) or "—"
            lines.append(
                f"- {d.get('department', '—')}: {_rupees(d.get('total_gap_value'))} owed, "
                f"{int(d.get('issue_count') or 0)} issues | schemes: {schemes} | "
                f"top areas: {areas}"
            )
    else:
        lines.append("- (no department summary available)")
    lines.append("")

    lines.append("TOP 20 SCHEME GAPS (largest ₹ first):")
    if scheme_gaps:
        for g in scheme_gaps:
            lines.append(
                f"- {g.get('place_name', '—')} · {g.get('scheme', '—')} "
                f"({g.get('department') or 'dept —'}): eligible {int(g.get('eligible') or 0)}, "
                f"covered {int(g.get('covered') or 0)}, gap {int(g.get('gap') or 0)} = "
                f"{_rupees(g.get('gap_value'))} [source: {g.get('data_source') or '—'}]"
            )
    else:
        lines.append("- (no scheme gaps available)")
    lines.append("")

    lines.append("TOP 20 RANKED PROJECTS (highest priority first):")
    if projects:
        for p in projects:
            track = p.get("track") or "—"
            cost = _rupees(p.get("estimated_cost")) if p.get("estimated_cost") else "₹0 (Track A — unlock via dept letter)"
            just = (p.get("justification") or "").strip().replace("\n", " ")
            if len(just) > 160:
                just = just[:157] + "…"
            lines.append(
                f"- #{int(p.get('rank') or 0)} {p.get('place_name', '—')} "
                f"[{p.get('category', '—')}, Track {track}] score "
                f"{round(float(p.get('priority_score') or 0), 2)} · "
                f"scheme: {p.get('matched_scheme') or '—'} · verdict: {p.get('verdict') or '—'} · "
                f"cost: {cost} · why: {just or '—'}"
            )
    else:
        lines.append("- (no ranked projects available)")
    lines.append("")

    lines.append("TOP 15 SILENT / FORGOTTEN VILLAGES (highest need first):")
    if silent_villages:
        for s in silent_villages:
            lines.append(
                f"- {s.get('place_name', '—')}: need_score "
                f"{round(float(s.get('need_score') or 0), 2)}, "
                f"{int(s.get('petition_count') or 0)} petitions"
            )
    else:
        lines.append("- (no silent villages available)")
    lines.append("")

    lines.append("COMPLAINTS BY CATEGORY:")
    if complaint_cats:
        for c in complaint_cats:
            lines.append(f"- {c.get('true_category') or '—'}: {int(c.get('n') or 0)}")
    else:
        lines.append("- (no complaint categories available)")
    lines.append("")

    lines.append("TOP 10 UNIFIED ISSUES (most-reported first):")
    if unified:
        for u in unified:
            lines.append(
                f"- {u.get('category', '—')} @ {u.get('place_name', '—')}: "
                f"{int(u.get('report_count') or 0)} reports"
            )
    else:
        lines.append("- (no unified issues available)")

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
            "Answer using ONLY the data above. Give a thorough, structured markdown "
            "answer: cite the exact numbers, name the specific areas / schemes / "
            "departments involved, explain the WHY behind the situation, compare the "
            "options where relevant, and finish with a concrete recommended next "
            "action for the MP. If the question is about budget or the ₹5-crore fund, "
            "remember Track A items cost the MP ₹0 (unlocked via department letters) "
            "so the ₹5 crore MPLADS applies to Track B works — list those Track B "
            "candidates with costs and recommend a mix. Do not give a shallow "
            "one-liner. If the data genuinely doesn't cover the question, say so plainly."
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
