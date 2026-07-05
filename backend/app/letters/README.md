# Letters — Step 9: Auto-letter / Memo Generator

Turns analytics outputs (`SchemeGap`, `RankedProject` from `backend/app/schema.py`)
into ready-to-send government documents:

- **Track A** — official letter to a department to unlock an existing entitlement
  (references the scheme, village/ward, eligible-but-uncovered count, and gap value).
- **Track B** — constituency development-plan summary listing ranked priority works.
- **Justification memo** — a 2-3 line plain-language brief for a single project.

## Files

| File | Purpose |
|------|---------|
| `templates.py` | Dependency-free formal templates (the offline fallback). |
| `letters.py`   | Public API + Gemini polishing + PDF rendering. |

## Usage

```python
from backend.app.schema import SchemeGap, RankedProject
from backend.app.letters import draft_track_a_letter, render_pdf, generate_memo

gap = SchemeGap(
    area_id="V-3", place_name="Thondamuthur", urban=False, scheme="JJM",
    eligible=1200, covered=760, gap=440,
    per_unit_value=12000.0, gap_value=440 * 12000.0, data_source="modelled",
)

letter = draft_track_a_letter(gap, mp_name="Hon'ble MP",
                              department="Department of Drinking Water and Sanitation")
render_pdf(letter, "data/generated/track_a.pdf")

memo = generate_memo(ranked_project)   # 2-3 line justification
```

Track B summaries: `from backend.app.letters import track_b_plan_template`.

## Gemini is optional

`draft_track_a_letter` and `generate_memo` try **Gemini via Vertex AI**
(`google-cloud-aiplatform`) to polish tone. The model id comes from the
`GEMINI_MODEL` environment variable (falling back to `config.settings.gemini_model`).

If GCP credentials or the Vertex libraries are unavailable, they **silently fall
back to the deterministic templates** in `templates.py` — so the module always
returns text, with **no credentials required**.

Relevant env vars: `GEMINI_MODEL`, `GOOGLE_CLOUD_PROJECT`,
`GOOGLE_APPLICATION_CREDENTIALS`, `VERTEX_LOCATION`.

## Smoke test

```bash
python -m backend.app.letters.letters
```

Generates a sample Track A letter PDF into `data/generated/` (no credentials
needed) and prints the path.

## Dependencies

- `reportlab` (required — PDF rendering)
- `google-cloud-aiplatform` (optional — Gemini polishing)
