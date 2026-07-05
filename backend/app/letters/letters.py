"""
Step 9 — auto-letter / memo generation.

``draft_track_a_letter`` tries Gemini (via Vertex AI) to produce polished prose,
and transparently falls back to the offline template in ``templates.py`` when
GCP credentials or the Vertex libraries are unavailable. It therefore ALWAYS
returns text, even with no cloud credentials configured.
"""
from __future__ import annotations

import os
from pathlib import Path

from ..schema import SchemeGap, RankedProject
from .templates import (
    track_a_letter_template,
    justification_memo_template,
)

# GEMINI_MODEL env var takes precedence; otherwise fall back to app settings.
try:  # settings import is best-effort — templates must work standalone.
    from ..config import settings as _settings

    _DEFAULT_MODEL = _settings.gemini_model
    _DEFAULT_PROJECT = _settings.gcp_project_id
    _DEFAULT_LOCATION = _settings.vertex_location
except Exception:  # pragma: no cover - config optional
    _DEFAULT_MODEL = "gemini-2.0-flash"
    _DEFAULT_PROJECT = None
    _DEFAULT_LOCATION = "asia-south1"


def _gemini_polish(prompt: str, system: str) -> str | None:
    """
    Attempt to generate text with Gemini via Vertex AI.

    Returns the generated text, or ``None`` if Vertex is unavailable for any
    reason (missing library, missing credentials, or an API error) so callers
    can fall back to the template.
    """
    # No credentials configured -> don't even try.
    has_creds = bool(
        os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        or os.environ.get("GOOGLE_CLOUD_PROJECT")
        or _DEFAULT_PROJECT
    )
    if not has_creds:
        return None

    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel

        model_name = os.environ.get("GEMINI_MODEL", _DEFAULT_MODEL)
        project = os.environ.get("GOOGLE_CLOUD_PROJECT", _DEFAULT_PROJECT)
        location = os.environ.get("VERTEX_LOCATION", _DEFAULT_LOCATION)

        vertexai.init(project=project, location=location)
        model = GenerativeModel(model_name, system_instruction=system)
        resp = model.generate_content(prompt)
        text = (getattr(resp, "text", "") or "").strip()
        return text or None
    except Exception:
        # Any failure (import, auth, quota, network) -> silent template fallback.
        return None


def draft_track_a_letter(gap: SchemeGap, mp_name: str, department: str) -> str:
    """
    Draft a Track A official letter requesting that an existing entitlement be
    unlocked for eligible-but-uncovered residents.

    Uses Gemini (Vertex AI) to refine tone when credentials exist; otherwise
    returns the deterministic template. Always returns text.
    """
    template = track_a_letter_template(gap, mp_name, department)

    system = (
        "You are a parliamentary correspondence officer in India. You write "
        "concise, formal, respectful official letters in English. Preserve every "
        "factual figure exactly and do not invent new facts."
    )
    prompt = (
        "Polish the following official letter for tone and clarity while keeping "
        "all numbers, names, the reference number, and the date unchanged. Return "
        "only the finished letter.\n\n"
        f"{template}"
    )

    polished = _gemini_polish(prompt, system)
    return polished or template


def generate_memo(project: RankedProject) -> str:
    """Generate a 2-3 line plain-language justification memo for a project."""
    template = justification_memo_template(project)

    system = (
        "You write brief, plain-language justification memos for constituency "
        "projects in India. Keep to 2-3 sentences and preserve all facts and "
        "figures exactly."
    )
    prompt = (
        "Rewrite the following justification memo in clear plain language, in at "
        "most 3 sentences, preserving all facts. Return only the memo.\n\n"
        f"{template}"
    )

    polished = _gemini_polish(prompt, system)
    return polished or template


def render_pdf(text: str, out_path: str) -> str:
    """
    Render plain text to a simple, clean A4 PDF using reportlab.

    Returns the output path.
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.enums import TA_LEFT

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(out),
        pagesize=A4,
        leftMargin=2.5 * cm,
        rightMargin=2.5 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2.5 * cm,
        title="Sarvik — Document",
    )

    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=11,
        leading=16,
        alignment=TA_LEFT,
    )

    story = []
    for block in text.split("\n"):
        if block.strip() == "":
            story.append(Spacer(1, 0.3 * cm))
            continue
        # Escape XML-significant characters, then preserve leading indentation.
        safe = block.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        indent = len(block) - len(block.lstrip(" "))
        if indent:
            safe = "&nbsp;" * indent + safe.lstrip(" ")
        story.append(Paragraph(safe, body))

    doc.build(story)
    return str(out)


# ── Smoke test ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    sample_gap = SchemeGap(
        area_id="V-3",
        place_name="Thondamuthur",
        urban=False,
        scheme="JJM",
        eligible=1200,
        covered=760,
        gap=440,
        per_unit_value=12000.0,
        gap_value=440 * 12000.0,
        data_source="modelled",
    )

    letter = draft_track_a_letter(
        sample_gap,
        mp_name="Hon'ble Member of Parliament",
        department="Department of Drinking Water and Sanitation",
    )

    out_dir = Path("data/generated")
    pdf_path = render_pdf(letter, str(out_dir / "track_a_sample_letter.pdf"))
    print("Track A letter PDF generated at:", Path(pdf_path).resolve())
