# Constituency Intelligence Engine — Design Spec
*(working title — final product name TBD)*

**Hackathon:** Build with AI: Code for Communities (Google Cloud) · **Track 1 — People's Priorities (AI for Constituency Development Planning)**
**Demo constituency:** Dharmapuri (Lok Sabha), Tamil Nadu
**Date:** 2026-06-23 · **Submission deadline:** 8 July 2026 · **Demo Day:** 23 July 2026, New Delhi

---

## 1. Context — why this exists

An MP gets a small, fixed local-development fund (**MPLADS ≈ ₹5 crore/year**) and hundreds of competing citizen demands. Today, money tends to go to whoever **complains loudest**, decisions are ad-hoc and politically exposed, and **silent, poor, remote areas get ignored**.

But the deeper, real problem most teams miss: an MP's ₹5 cr is tiny next to the **hundreds of crores of existing government schemes** (PMAY-G, Jal Jeevan, MGNREGA, pensions, etc.) already meant for their constituents. **Most citizen problems aren't "we need new money" — they're "we're entitled to a scheme but not receiving it."** The failure is *delivery and convergence*, not budget.

**Outcome we want:** an MP's office that (a) routes each need to the scheme that should already cover it, (b) sees village-by-village where scheme money is failing to land, and (c) spends its own ₹5 cr only on the genuine gaps nothing else covers — fairly, defensibly, and with the silent majority included.

---

## 2. The product in one line

> **"We don't help an MP spend ₹5 crore. We help them unlock the ₹500 crore of schemes already meant for their people — and spend their own ₹5 crore only on the gaps nothing else covers."**

**Working name:** TBD — to be decided. (Referred to here as the "Constituency Intelligence Engine".)

### What makes it defensible (not just unique)
The differentiator is **domain insight + hard data integration**, not a copyable feature:
- Understands India's **entitlement/scheme system**, not just "complaints."
- Joins **real scheme-coverage data at village level** to find unfilled entitlements + true gaps — work most teams won't know to do or can't assemble in time.
- A policy judge / MP instantly recognises that the team *understands how governance actually works*.

Tamil voice intake and silent-area detection are **supporting features**, not the headline.

---

## 3. Users

| User | Goal |
|---|---|
| **Citizen** 🧑‍🌾 | Raise a need easily (Tamil voice/text), get acknowledged. |
| **MP's staff** 🧑‍💼 | Stop hand-sorting petitions; see consolidated needs + scheme gaps; push officials. |
| **The MP** 👔 | Decide where political pressure (Track A) and ₹5 cr (Track B) go; show results publicly. |
| **The silent citizen** 🔇 | Represented *by the data* even though they never petition. |

---

## 4. The engine — a two-floor model

We deliberately build **both floors**. Floor 1 is exactly what the problem statement asks for (and what most teams build) — we do it solidly so we score full marks on Problem-Solution Fit. Floor 2 is our differentiator, built **on top of** Floor 1, not instead of it.

### 🏢 Floor 1 — The required basics (consolidate → theme → map → rank)
*Directly answers the four things the problem statement asks for.*

1. **Analyze submissions** — transcribe/translate Tamil voice, text & photos → structured *demand record* `{need, sector, village→LGD code, urgency, beneficiaries}` (Gemini + Speech-to-Text + Translation). Each is auto-categorised (water / road / school / health …).
2. **Detect recurring themes** — embeddings cluster thousands of submissions into recurring needs per ward, with volume + recency. *Output the MP sees:* "Drinking water = biggest recurring issue — 400 requests across 3 weeks."
3. **Map demand hotspots** — a Google Maps view showing **where complaints concentrate** (e.g. Ward 3 = red, 250 road complaints). The straightforward "where is the noise" map.
4. **Combine with public data + rank** — fuse citizen demand with Census/NFHS/UDISE, infrastructure gaps and the **local development plan** (RAG over the real plan document, so recommendations map to real proposed projects — not invented ones). Produce a **transparent ranked project list** (e.g. School upgrade 95 · Drinking water 90 · Road 75 · Vocational centre 50), each with its "why this rank" reasoning shown.

> **Design rule:** ranking is a **transparent weighted formula** (`Demand × Need × Feasibility + Equity-boost`), NOT a black-box model — government only deploys what it can explain and audit.

### 🏢 Floor 2 — Our differentiator (built on top of Floor 1)
*Why we beat the "smart suggestion box" crowd.*

5. **Match to scheme — "whose money is this?"** 🔗 — for every ranked need, classify the responsible scheme/fund (e.g. housing → PMAY-G) vs. "no scheme covers this → MPLADS candidate."
6. **Reconcile with ground truth (gap math)** — `gap = eligible/needy population − population already covered (scheme dashboards)`. Surfaces entitlements owed-but-undelivered.
7. **Two-track recommendation** — **Track A** (unlock existing entitlements, ₹0 of MPLADS — push the official) + **Track B** (budget-constrained best use of ₹5 cr on true gaps), each with an auto-generated justification (Gemini).
8. **Silent-village detection** 🔇 — flag villages with **high measured need but zero petitions**.
9. **Anti-lobbying / astroturfing guard** 🛡️ — detect coordinated near-identical message floods and down-weight them, so vocal groups can't game the ranking.
10. **Close the loop** — citizen gets a status update when their issue is actioned → trust + repeat usage.

---

## 5. Screens & flows

**Floor 1 screens (the required basics):**
1. **Citizen intake** — Tamil voice/text/photo → instant acknowledgement → AI shows the category it matched.
2. **Priorities** 📊 — recurring-theme list (top recurring needs by volume) + **demand hotspot map** (where complaints concentrate) + the **ranked project list** with "why this rank" reasoning.

**Floor 2 screens (the differentiator):**
3. **Constituency X-Ray** 🩻 (hero) — village heatmap of *scheme coverage* + ranked scheme-gap list (PMAY-G, Jal Jeevan, MGNREGA …), expandable to village/family lists.
4. **Act — Unlock / Spend** ⚖️ — **Track A** (generate official letters, push departments) | **Track B** (live ₹5 cr allocation cart on true gaps, approve → PDF plan).
5. **Forgotten villages** 🔇 — alert card for silent + high-need villages, with proof, "add to ₹5 cr plan."

*(Clickable prototype: `prototype/index.html` — bilingual; Floor 2 screens built, Floor 1 screens to be added during the build.)*

---

## 6. Data plan (real Tamil Nadu sources)

| Layer | Source | Resolution |
|---|---|---|
| Geographic join key | **LGD (Local Government Directory)** | village/ward |
| Demographics & amenities | **Census 2011** (TN village directory) | village |
| Education need | **UDISE+** (TN) | school/village |
| Health need | **NFHS-5** (TN) + PHC data | district |
| Housing coverage | **PMAY-G MIS / AwaasSoft** | village/block |
| Water coverage | **Jal Jeevan "Har Ghar Jal" dashboard** | village |
| Jobs/assets | **MGNREGA MIS** | panchayat |
| Already-funded works (anti-duplication) | **MPLADS portal** (filter TN MP) | work-level |
| Satellite proof (2–3 hero examples) | **Google Earth Engine / Bhuvan** | image |
| **Citizen petitions** | **Synthesized** (200–500, realistic Tamil, mapped to real villages) | — |

**Honesty notes (state these in the pitch):**
- Real petition feeds (CM Helpline 1100, e-Sevai) are not openly downloadable → petitions are synthesized. Legitimate and expected for a hackathon.
- Some scheme data is only block/district level → use best-available resolution and say so.
- Satellite verification is done deep for **2–3 hero villages**, simulated for breadth.

---

## 7. Intake approach (confirmed: Tier 1 **and** Tier 2)

Both feed the **same backend pipeline**, so no duplicate work.

- **Tier 1 — own web + voice intake (reliable backbone):** a citizen web page with Tamil mic/upload; database pre-loaded with synthesized petitions so the dashboard looks alive. 100% in our control.
- **Tier 2 — Telegram bot (live wow):** free, no approval, accepts Tamil voice notes; a judge can message it live and watch the demand appear on the dashboard in seconds.
- **WhatsApp:** out of scope (approval too slow). Pitch line: *"intake is channel-agnostic; built to plug into WhatsApp/CM Helpline in production."*

---

## 8. Architecture (GCP-native)

```
Citizen (Tier 1 web voice / Tier 2 Telegram voice)
        │
        ▼
Cloud Function / Cloud Run webhook (intake)
        │
   Speech-to-Text (Tamil) → Translation API
        │
   Gemini (Vertex AI): extract need + sector + scheme match  → structured JSON
        │
        ▼
BigQuery  ── demand records  +  public datasets (Census/UDISE/NFHS/PMAY/JJM/MGNREGA, joined on LGD codes)
        │            │
        │     BigQuery GIS joins + transparent Need/Gap scoring + OR-Tools budget optimisation
        │            │
        ▼            ▼
Cloud Run API (FastAPI)  →  React web dashboard (Maps Platform) + Gemini-drafted letters/memos
                          →  React Native citizen mobile app
                              Earth Engine imagery for hero villages
```

**Stack:** React (web dashboard) · React Native (citizen mobile app) · FastAPI on Cloud Run (backend) · Cloud Functions (Telegram/SMS webhooks) · Vertex AI / Gemini · Cloud Speech-to-Text + Text-to-Speech · Translation API · BigQuery + BigQuery GIS · Firestore (real-time UI) · Cloud Storage · OR-Tools · Google Maps Platform · Earth Engine (light) · Firebase (auth/hosting). All serverless, all on Google Cloud credits.

---

## 9. Scope for the hackathon (depth over breadth)

**In:**
- One constituency (Dharmapuri), real Census + UDISE + 3–4 scheme datasets (PMAY-G, Jal Jeevan, MGNREGA, + one pension/PM-Kisan).
- Tamil voice/text intake (Tier 1 + Tier 2), scheme-matching, X-Ray, two-track recommendations, transparent Need/Gap score, auto-letters, ₹5 cr optimiser, silent-village detection.
- 2–3 satellite "proof" hero villages.

**Out (say so honestly):**
- All 30+ schemes; live WhatsApp; statewide rollout; causal outcome prediction (we do diagnosis + gap, not prediction).

---

## 10. Demo script (5 minutes)

1. **Hook (30s):** "Tamil Nadu MPs sit on hundreds of crores their people are owed but not getting. Watch." 
2. **Citizen (45s):** judge sends a Tamil voice note (Tier 2) → appears, auto-matched to PMAY-G.
3. **X-Ray (90s):** the constituency heatmap; ₹148 Cr owed-but-undelivered; scheme gaps.
4. **Forgotten village (60s):** Vellampatti — 0 petitions, worst indicators. *Mic-drop.*
5. **Two tracks (75s):** unlock 17,900 people for ₹0; spend ₹5 cr only on true gaps; auto-letter + PDF plan.
6. **Close (20s):** deployable for any of TN's 39 MPs + 234 MLAs.

---

## 11. Evaluation alignment

| Criterion | Weight | How we score |
|---|---|---|
| Problem–Solution Fit | 20% | Solves the real convergence/entitlement problem, not a complaint inbox |
| AI/Technical Execution | 25% | Real pipeline: Tamil STT → Gemini scheme-matching → BigQuery joins → optimisation |
| Deployability & Scalability | 25% | Real TN data, GCP-serverless, one MP → 39 MPs + 234 MLAs |
| Inclusivity & Accessibility | 15% | Tamil voice, low-literacy, silent-majority detection |
| Impact Potential | 10% | Unlocks ₹100s of Cr of existing entitlements |
| Presentation & Clarity | 5% | Auto-justification memos a non-technical office reads in 30s |

---

## 12. Honest risks
- **Idea is graspable once spoken** → protect with execution depth (real data). Don't over-explain the concept publicly before submission.
- **"This is just convergence/DPC planning"** rebuttal: *"Yes — and it fails because nobody joins the data at village level. We did."*
- **Hardest work = data joins** (messy Tamil → LGD codes → scheme coverage). Budget time here, not on UI.
- "Unique" is not the goal — **"an MP would use this Monday morning"** is.
