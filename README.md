# Sarvik

**Build with AI: Code for Communities (Google Cloud) · Track 1 — People's Priorities**
Demo constituency: **Coimbatore, Tamil Nadu** (urban wards + rural fringe)

A multilingual civic-AI prototype that turns scattered citizen demands and fragmented
public data into a clear, defensible, ward/village-level action plan for a Member of
Parliament.

> **The idea in one line:** don't just help an MP spend their ₹5 crore local fund — first
> show them the entitlements already owed to their people under existing government schemes,
> and reserve the ₹5 cr for the gaps nothing else covers.

---

## What it actually does

The demo is built end to end and runs against a live BigQuery dataset. Concretely:

- **Multimodal intake.** Citizens submit by text, voice note, photo of a paper petition, or
  a PDF letter. Gemini 2.5-flash (native multimodal) reads/hears the media, transcribes it
  verbatim, and extracts a structured record (category, urgency, beneficiaries, location
  clues) in Tamil / English / mixed. A Telegram bot is the citizen-facing channel.
- **Geo-resolution.** Location clues are fuzzy-matched to a real Coimbatore gazetteer of
  **42 urban wards** and **16 fringe villages**.
- **Deduplication & clustering.** 300 synthetic petitions are embedded and collapsed into
  ~**245 unified issues** (Gemini embeddings, TF-IDF fallback), with a coordinated /
  astroturf-campaign flag for bursts of near-identical text.
- **Urban vs rural scheme routing.** Each need is routed to the scheme that should already
  own it — urban → PMAY-U / AMRUT / NULM / SBM-U; rural → PMAY-G / Jal Jeevan / MGNREGA /
  SBM-G — or marked an MPLADS candidate when no scheme applies.
- **Entitlement-gap math from real Census.** Need is derived from **237 real Census 2011
  villages** (deficits in treated tap water, PHC, govt school, all-weather road). The gap
  `eligible − covered × per-unit value` totals roughly **₹463 crore** owed to citizens
  across the constituency.
- **Silent villages.** High-need areas with zero petitions are surfaced (`silent_score`) so
  well-organised areas don't drown out the voiceless.
- **Transparent, two-track prioritisation.** Projects are ranked by four explainable factors
  (demand / need / feasibility / equity, each contribution shown). **Track A** = unlock an
  existing entitlement (~₹0 MPLADS); **Track B** = an OR-Tools knapsack picks the best set of
  works that fit the ₹5 cr MPLADS envelope.
- **Auto-drafted letters & memos.** Gemini drafts a Track-A entitlement-request letter and a
  plain-language justification memo, rendered to PDF (deterministic template fallback when no
  cloud creds).
- **Close-the-loop.** When the office actions an issue, the citizen is notified back on
  Telegram in their own language (ta / hi / en).

> Honest scope: the map view is a shaded grid stand-in (real Maps rendering is wired but not
> keyed), and Firestore/Speech-to-Text/Translation are not used — Gemini's native multimodal
> handles voice/photo/PDF directly, and BigQuery is the single datastore.

---

## Architecture (Google Cloud native)

```
Citizen (web upload / Telegram: text · voice · photo · PDF)
   -> Cloud Run (FastAPI)  POST /api/intake
   -> Gemini 2.5-flash  (multimodal extract + transcript)
   -> geo-resolve (ward/village gazetteer) -> scheme-route (urban/rural)
   -> BigQuery  (demand_records)                       [live intake path]

Batch analytics job (real Census + synthetic petitions)
   -> dedup/cluster -> gap math -> silent score -> rank -> knapsack
   -> BigQuery  (scheme_gaps, ranked_projects, silent_villages, unified_issues)

React dashboard (Vite, 6 screens)  <- GET /api/*  <- BigQuery
Gemini-drafted letters/memos -> PDF        Close-loop -> Telegram
```

See **[docs/architecture.md](docs/architecture.md)** for the full 12-step pipeline, the
file-by-file mapping, and the BigQuery table list.

## Stack
- **Backend:** FastAPI on Cloud Run (`backend/Dockerfile`)
- **AI:** Vertex AI / Gemini 2.5-flash (multimodal extract, embeddings, letter drafting)
- **Data:** BigQuery — project `gemini-enterprise-475109`, dataset `constituency`
  (`asia-south1`)
- **Optimisation:** Google OR-Tools (0/1 knapsack for the MPLADS budget)
- **Frontend:** React + TypeScript (Vite) · Firebase Hosting
- **Channels:** Telegram bot (`python-telegram-bot`)
- **Ingestion:** data.gov.in (`datagovindia`) client for public datasets

## Repo layout
```
backend/
  Dockerfile             Cloud Run image
  app/
    main.py  api.py      FastAPI app + dashboard read-API
    schema.py config.py  canonical data contract + settings
    pipeline/            intake, extract, multimodal, geo, closeloop
    analytics/           scheme_routing, dedup, gap_math, silent, scoring, optimizer (+ tests)
    jobs/                build_analytics.py (batch: builds the analytics tables)
    letters/             Gemini letter/memo drafting -> PDF
    store/bq.py          BigQuery data-access layer
    ingestion/           data.gov.in client + BigQuery bootstrap
    telegram_bot/        citizen-facing Telegram bot
frontend/                Vite React TS dashboard — 6 screens
data/                    Coimbatore gazetteers, scheme routing table, synthetic
                         complaint generator, BigQuery schemas, ingestion catalog
docs/                    proposal, design spec, architecture, risk checklist
```

## Local run

Prerequisites: Python 3.12, Node 18+, a Gemini API key, and (for BigQuery) gcloud
Application Default Credentials.

```bash
cp .env.example .env        # fill in keys — NEVER commit .env
gcloud auth application-default login   # for BigQuery reads/writes

# backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload           # http://localhost:8000  (/health, /docs)

# frontend  (new terminal)
cd frontend
cp .env.example .env                     # set VITE_API_URL, VITE_MAPS_API_KEY
npm install
npm run dev                              # http://localhost:5173
```

Build/refresh the analytics tables (reads Census + synthetic petitions, writes
`scheme_gaps` / `ranked_projects` / `silent_villages`):

```bash
cd backend && python -m app.jobs.build_analytics
python -m app.analytics.dedup            # rebuilds unified_issues (300 -> ~245)
```

Individual modules are runnable/testable standalone (e.g. `python -m app.pipeline.extract`,
`python -m app.pipeline.closeloop`); unit tests live in `backend/app/analytics/tests/`.

## Deploy
- **Backend -> Cloud Run:** build `backend/Dockerfile` and deploy; the container listens on
  `$PORT` and serves the same FastAPI app.
- **Frontend -> Firebase Hosting:** `npm run build` in `frontend/`, then deploy the `dist/`
  output; point `VITE_API_URL` at the Cloud Run URL.

## Data & privacy
Citizen petitions in the demo are **synthesised** (real grievance feeds aren't openly
downloadable) and mapped onto real Coimbatore geography. The need signal and the ₹463 cr gap
are derived from **real Census 2011** village amenity data. Public-data sources are cited in
`data/ingestion/`. No Aadhaar or mandatory PII is collected. This is a hackathon prototype:
CORS is open and auth is not yet enforced — both must be tightened before any real
deployment.
