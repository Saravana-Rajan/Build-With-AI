# Architecture — Sarvik

Track 1 · Build with AI: Code for Communities · Demo constituency: **Coimbatore, Tamil Nadu**.

This document describes what is actually built: a FastAPI service on Cloud Run, a Gemini-based
multimodal pipeline, an analytics engine, a batch job, and a React dashboard — all reading and
writing a single BigQuery dataset.

- **GCP project:** `gemini-enterprise-475109`
- **BigQuery dataset:** `constituency` (`asia-south1`)
- **Model:** Gemini 2.5-flash (multimodal extract + embeddings + letter drafting via Vertex AI)

---

## Two paths through the system

The engine runs in two distinct flows that meet in BigQuery:

1. **Live intake path** (per-citizen, synchronous): a submission comes in, Gemini extracts a
   structured record, it is geo-resolved and scheme-routed, and it is persisted to
   `demand_records`. Steps 0–3, plus close-loop (11).
2. **Batch analytics path** (periodic, offline): reads real Census + synthetic petitions,
   deduplicates, computes gaps / silence / ranking / budget selection, and replaces the
   dashboard tables. Steps 4–8. The dashboard (10) then serves those tables to the UI.

```
                          LIVE INTAKE PATH
 Citizen                                                        BigQuery
 (web upload,        POST /api/intake                          demand_records
  Telegram:      ┌───────────────────────┐    geo    scheme        ▲
  text/voice/ ──▶│ 0 intake  1 extract/  │──▶ 2 ──▶ 3 route ───────┘
  photo/PDF)     │           multimodal  │  resolve
                 └───────────────────────┘
                                                        11 close-loop ──▶ Telegram

                          BATCH ANALYTICS PATH
 census_coimbatore_villages (237 real) ┐
 complaints_synthetic (300)            ├─▶  jobs/build_analytics.py + analytics/dedup.py
 urban_wards (42), fringe_villages(16) ┘        │
                                                ▼
      4 dedup/route → 5 gap math → 6 silent → 7 scoring → 8 knapsack
                                                │
                                                ▼
        BigQuery:  scheme_gaps · ranked_projects · silent_villages · unified_issues
                                                │
                          10 dashboard API  ────┴────▶  React (Vite) — 6 screens
                          9 letters/memos  ──────────▶  PDF
```

---

## The 12-step pipeline → files

| Step | Stage | File(s) | What it does |
|------|-------|---------|--------------|
| 0 | Intake / orchestration | `backend/app/pipeline/intake.py` | FastAPI `POST /api/intake`; `process_text` / `process_media` glue the whole chain and persist a `DemandRecord`. |
| 1 | Extract (text) | `backend/app/pipeline/extract.py` | Gemini extracts category, need, urgency, beneficiaries, location clues from Tamil/English text. Safe default on any failure. |
| 1 | Extract (media) | `backend/app/pipeline/multimodal.py` | Gemini **native multimodal**: reads photo/PDF petitions and hears voice notes; returns the same record shape **plus a verbatim transcript** for human audit. |
| 2 | Geo-resolve | `backend/app/pipeline/geo.py` | Fuzzy-matches location clues to the ward/village gazetteers (`data/coimbatore/*.json`); returns place, area_id, urban flag, confidence. No network. |
| 3 | Scheme match | `backend/app/analytics/scheme_routing.py` (`route`) | `(category, urban) → (scheme, track)` lookup from `data/schemes.json`. Called at intake to tag `matched_scheme` / `track`. |
| 4 | Dedup & cluster | `backend/app/analytics/dedup.py` | Embeds petitions (Gemini `gemini-embedding-001`, TF-IDF fallback), clusters by `(category, place)` + cosine ≥ 0.85, flags coordinated bursts. **300 → ~245 unified issues** → `unified_issues`. |
| 5 | Gap math | `backend/app/analytics/gap_math.py` (`compute_gap`) | `gap = max(eligible − covered, 0)`; `gap_value = gap × per_unit_value`. Per-unit ₹ from `schemes.json`. |
| 6 | Silent villages | `backend/app/analytics/silent.py` | `silent_score = need / log(petitions + 2)`; flags need > 0.6 with zero petitions. |
| 7 | Scoring | `backend/app/analytics/scoring.py` | Transparent additive rank: `0.30·demand + 0.35·need + 0.20·feasibility + 0.15·equity`, with per-factor `why` contributions. |
| 8 | Budget optimiser | `backend/app/analytics/optimizer.py` | OR-Tools 0/1 knapsack: pick Track-B works maximising priority within the ₹5 cr (`50,000,000`) MPLADS envelope. |
| 9 | Letters & memos | `backend/app/letters/letters.py`, `templates.py` | Gemini (Vertex AI) drafts a Track-A entitlement letter and a justification memo; deterministic template fallback; `render_pdf` via reportlab. |
| 10 | Dashboard API | `backend/app/api.py` | Read-only endpoints (`/api/stats`, `/demands`, `/scheme-gaps`, `/ranked-projects`, `/silent-villages`, `/unified-issues`) served from BigQuery to the 6 React screens. |
| 11 | Close-the-loop | `backend/app/pipeline/closeloop.py` | `POST /api/close-loop`; notifies the citizen on Telegram (ta/hi/en) that their actioned issue was raised with the department. |

**Orchestrators.** `backend/app/jobs/build_analytics.py` runs steps 5–8 end to end: it derives
`need_score` from **real Census 2011** amenity deficits, counts petitions per area, and writes
`scheme_gaps` / `ranked_projects` / `silent_villages` (printing the ~₹463 cr total owed and the
Track-B knapsack selection). `dedup.py`'s `__main__` runs step 4 into `unified_issues`.

**Support layers.** `store/bq.py` (BigQuery access: `query` / `insert_rows` / `replace_table`,
ADC auth), `schema.py` (the canonical pydantic data contract every module imports),
`config.py` (env-driven settings), `ingestion/` (data.gov.in client + `bq_setup.py` table
bootstrap), `telegram_bot/bot.py` (citizen channel → `/api/intake`).

---

## BigQuery tables (dataset `constituency`)

| Table | Rows | Source | Written by | Read by |
|-------|------|--------|-----------|---------|
| `census_coimbatore_villages` | 237 (real) | Census 2011 amenities | ingestion | `build_analytics.py` |
| `complaints_synthetic` | 300 (synthetic) | `data/generators/` | ingestion | `api.py`, `dedup.py`, `build_analytics.py` |
| `urban_wards` | 42 | `data/coimbatore/` | ingestion | `build_analytics.py`, geo |
| `fringe_villages` | 16 | `data/coimbatore/` | ingestion | `build_analytics.py`, geo |
| `demand_records` | live | intake path | `pipeline/intake.py` | (audit) |
| `scheme_gaps` | derived | steps 4–5 | `build_analytics.py` | `/api/scheme-gaps`, `/api/stats` |
| `ranked_projects` | derived | steps 7–8 | `build_analytics.py` | `/api/ranked-projects` |
| `silent_villages` | derived | step 6 | `build_analytics.py` | `/api/silent-villages`, `/api/stats` |
| `unified_issues` | ~245 | step 4 | `dedup.py` | `/api/unified-issues` |

Table schemas mirror `backend/app/schema.py`; `ingestion/bq_setup.py` creates them from
`data/schemas/*.json`.

---

## Request flow (live intake)

1. Telegram bot or web client `POST`s to `/api/intake` (multipart: `text` or a media `file`,
   plus `language`, `source`).
2. `intake.py` routes text → `extract.py`, media → `multimodal.py` (Gemini).
3. `geo.py` resolves location clues to a ward/village; `scheme_routing.route()` assigns the
   owning scheme and Track A/B.
4. A `DemandRecord` is assembled and best-effort persisted to `demand_records` (a write hiccup
   never blocks the citizen acknowledgement).
5. The citizen gets a bilingual ack with a reference id. Later, when the office actions the
   issue, `/api/close-loop` sends the Telegram confirmation.

## Request flow (dashboard)

The 6 Vite/React screens (`ConstituencyXRay` — the hero — plus `ScanPetition`, `IntakeFeed`,
`Priorities`, `Act`, `ForgottenVillages`) call the `/api/*` read endpoints, which query the
pre-built BigQuery analytics tables. The map is currently a coverage-shaded grid placeholder
(`MapPlaceholder.tsx`); real Maps rendering is wired but not keyed.

## Design notes
- **Every AI step degrades gracefully** — extract, multimodal, dedup embeddings, and letter
  drafting all fall back (safe default / TF-IDF / template) so the pipeline never crashes on a
  missing key or API error.
- **`data_source` honesty** — rows carry `real` (Census-derived) vs `modelled` so the demo
  never overstates its data.
- **Explainability by construction** — the priority score, the scheme routing table, and the
  gap arithmetic are all inspectable, not black boxes.
