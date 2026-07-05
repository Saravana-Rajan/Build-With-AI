# Constituency Intelligence Engine
*(working title — final product name TBD)*

**Build with AI: Code for Communities (Google Cloud) · Track 1 — People's Priorities**
Demo constituency: **Coimbatore, Tamil Nadu** (urban wards + rural fringe)

A multilingual civic-AI platform that turns scattered citizen demands and fragmented public
data into a clear, defensible, ward/village-level action plan for a Member of Parliament.

> **The one-line idea:** We don't help an MP spend ₹5 crore. We help them unlock the hundreds
> of crores of schemes already meant for their people — and spend their own ₹5 crore only on
> the gaps nothing else covers.

---

## What it does

**Floor 1 — the required basics:** consolidate multilingual citizen submissions (voice/text/photo)
→ detect recurring themes → map demand hotspots → rank projects transparently.

**Floor 2 — the differentiator:** route each need to the scheme that should already cover it
(urban → PMAY-U / AMRUT / NULM; rural fringe → PMAY-G / Jal Jeevan / MGNREGA), compute the
entitlement gap `eligible − already-covered`, surface silent villages with high need and zero
petitions, and recommend two tracks: **(A)** unlock existing entitlements for ₹0, **(B)** spend
the ₹5 cr only on true gaps.

---

## Architecture (Google Cloud native)

```
Citizen (web voice / Telegram voice / photo)
   → Cloud Run (FastAPI) intake
   → Speech-to-Text (ta/en) → Translation → Gemini (Vertex AI) extract + scheme-match
   → Firestore (live feed) + BigQuery (analytics + public datasets, joined on ward/LGD codes)
   → React dashboard (Google Maps) + Gemini-drafted letters/memos
```

## Stack
- **Backend:** FastAPI on Cloud Run · Cloud Functions (webhooks)
- **AI/Data:** Vertex AI / Gemini · Speech-to-Text · Translation · BigQuery (+GIS) · Firestore · OR-Tools
- **Frontend:** React · Google Maps Platform · Firebase Hosting
- **Data ingestion:** data.gov.in (`datagovindia`), API Setu, NeGD Open API → BigQuery

## Repo layout
```
backend/     FastAPI service + the 12-step pipeline
frontend/    React MP dashboard (5 screens)
data/        synthetic complaint generator · public-data ingestion · BigQuery schemas
docs/        proposal, design spec, risk checklist, event brief
```

## Setup
```bash
cp .env.example .env        # fill in keys — NEVER commit .env
# backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
# frontend
cd frontend && npm install && npm run dev
```

## Data & privacy
Citizen petitions in the demo are **synthesised** (real grievance feeds aren't openly
downloadable) and mapped onto real Coimbatore geography. Public datasets (Census, scheme MIS)
are cited in `data/ingestion/`. No Aadhaar or mandatory PII. This is a hackathon prototype.

## Deliverables
Source code (this repo) · demo video (3–5 min) · pitch deck (10–12 slides) · deployed Cloud Run link.
