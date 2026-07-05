"""
Step 9 — Auto-letter / memo generator.

Turns analytics outputs (SchemeGap, RankedProject) into ready-to-send government
documents: Track A entitlement-unlock letters, Track B dev-plan summaries, and
short plain-language justification memos.

Gemini (via Vertex AI) is used to polish the prose when GCP credentials are
available; otherwise a deterministic template is used. Either way, text is
always returned.
"""
from .letters import draft_track_a_letter, render_pdf, generate_memo
from .templates import (
    track_a_letter_template,
    track_b_plan_template,
    justification_memo_template,
)

__all__ = [
    "draft_track_a_letter",
    "render_pdf",
    "generate_memo",
    "track_a_letter_template",
    "track_b_plan_template",
    "justification_memo_template",
]
