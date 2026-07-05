# Sarvik — Detailed Per-Step Build Plan

**Companion to:** [track1-proposal.md](track1-proposal.md) · [track1-design-spec.md](track1-design-spec.md)
**Window:** 29 Jun → 8 Jul 2026 (~9 days) · **Demo:** 23 Jul, New Delhi
**Demo constituency:** Dharmapuri (Lok Sabha), Tamil Nadu
**Languages:** English · Tamil (`ta-IN`) · Hindi (`hi-IN`)

---

## 0. Build philosophy — what runs LIVE vs PRECOMPUTED

This is the single most important decision for a 9-day build. We split the 11-step pipeline:

| Steps | Mode | Why |
|---|---|---|
| **0–3** Intake → Extract → Geo-resolve → Scheme-match | **LIVE** (real-time, on each submission) | This is the on-stage "wow": judge sends a Tamil voice note, it lands on the dashboard auto-matched to a scheme in ~5s. |
| **4–8** Cluster → Gap math → Silent → Rank → Optimise | **PRECOMPUTED** (batch job, cached in BigQuery) | Heavy joins over static public data. Re-running live adds latency + failure points for zero demo benefit. Run once nightly / on-demand via a button. |
| **9** Auto-letters/memos | **LIVE on click** (Gemini call when MP hits "generate") | Fast single Gemini call; feels live, low risk. |
| **10** Dashboard | **LIVE** (reads Firestore + BigQuery) | — |
| **11** Close-the-loop | **LIVE on click** (Firestore trigger → notify) | One Telegram/SMS send; cheap and impressive. |

**Consequence:** the live critical path is only **Steps 0–3 + 10**. Everything else can be a cached table the dashboard reads. Budget effort accordingly.

### Data stores (decided)
- **Firestore** — live submissions + real-time UI feed + status updates (Steps 0, 10, 11).
- **BigQuery** — all analytical tables + public datasets + GIS joins (Steps 2, 4–8).
- **Cloud Storage** — raw audio, photos, generated PDFs.
- **Vertex AI** — Gemini (extraction, letters), text-embeddings (clustering), Vertex AI Search (RAG over dev plan).

### Service map (one line)
`Telegram/Web → Cloud Run (FastAPI) → Speech-to-Text → Translation → Gemini → Firestore (live) + BigQuery (analytics) → React dashboard / React Native app`

---

## Step 0 — Citizen Submission (Intake) · **LIVE**

**Goal:** accept voice/text/photo in EN/TA/HI from web or Telegram, store raw, return a reference number instantly.

**Services:** Cloud Run (FastAPI) for web; Cloud Function for Telegram webhook; Cloud Speech-to-Text; Cloud Translation; Cloud Storage; Firestore.

**API contract — web intake**
```
POST /api/v1/submissions
Content-Type: multipart/form-data
  channel:   "web" | "telegram"
  lang:      "en" | "ta" | "hi"
  text:      string | null
  audio:     file  | null   (webm/ogg/wav)
  photo:     file  | null
  lat,lng:   float | null   (if consented)
→ 201 { "submission_id": "1042", "reference": "#1042", "status": "received" }
```

**Process**
1. If `audio`: upload to GCS → Speech-to-Text (`ta-IN`/`hi-IN`/`en-IN`, auto-punctuation) → `raw_text`.
2. If `photo`: upload to GCS → defer description to Step 1 (Gemini multimodal).
3. Translation API: `raw_text` (ta/hi) → `raw_text_english`. (en passes through.)
4. Write raw record to Firestore **immediately**, return reference before any AI extraction (don't make the citizen wait).
5. Fire async task (Cloud Tasks / background) → Steps 1–3.

**Firestore `submissions/{id}` (raw)**
```json
{
  "submission_id": "1042",
  "channel": "telegram",
  "lang": "ta",
  "raw_text_native": "எங்க ஊர்ல 3 மாசமா தண்ணி வரல",
  "raw_text_english": "No piped water in our village for 3 months",
  "audio_url": "gs://.../1042.ogg",
  "photo_url": null,
  "lat_lng": null,
  "timestamp": "2026-06-29T10:40:00+05:30",
  "status": "received",          // received → extracted → matched → actioned
  "extraction": null,             // filled by Step 1
  "geo": null,                    // Step 2
  "scheme": null                  // Step 3
}
```

**Telegram bot (Tier 2):** BotFather token → Cloud Function webhook. Handle `voice` (download file → same STT path) and `text`. Reply with reference number + "we'll update you."

**Demo shortcut:** pre-seed Firestore with the 200–500 synthesised petitions (see Appendix A) so the dashboard looks alive. Live submissions are the *delta* on top.

**Acceptance:** judge sends Tamil voice note via Telegram → reference returned < 3s → raw record visible in Firestore with English translation.

---

## Step 1 — Structured Extraction (Gemini) · **LIVE**

**Goal:** turn raw English text (+ photo) into a structured demand record.

**Service:** Gemini (Vertex AI), `gemini-2.x` flash-tier for latency. Force JSON output.

**Prompt (system + user)**
```
You extract structured data from Indian citizen grievances. Output ONLY valid JSON.

Categories (pick ONE): water, road, housing, education, health, jobs, pension, sanitation, other
Urgency: critical, high, medium, low

Input may include a translated complaint and/or an image description.

Return:
{
  "need_category": "<one of the categories>",
  "need_detail": "<one concise English line>",
  "urgency": "<level>",
  "urgency_reason": "<short reason or null>",
  "beneficiary_estimate": <integer or null>,
  "location_clues": ["<village/area names exactly as mentioned>"],
  "is_complaint": <true|false>   // false if spam/test/unparseable
}
```
For photos, prepend a multimodal call: *"Describe infrastructure issues visible in this image in one line"* → feed as image description.

**Output → Firestore `submissions/{id}.extraction`** (same JSON). Update `status: "extracted"`.

**Demo shortcut:** keep the top-8 categories tight (`water/road/housing/education/health/jobs/pension/sanitation`); everything else → `other` with free text preserved. Don't over-engineer the long tail (Appendix B has the full taxonomy for the pitch slide only).

**Acceptance:** 20 hand-written test complaints (mix of 3 languages) → ≥18 correct category + sensible `need_detail`. Build a tiny eval set (Appendix C).

---

## Step 2 — Geographic Resolution (LGD Matching) · **LIVE**

**Goal:** map `location_clues` (+ lat/lng) to an LGD village code with a confidence score.

**Services:** BigQuery (LGD master + fuzzy match), Maps Geocoding API (reverse geocode if lat/lng).

**Process**
1. If lat/lng present → reverse geocode → nearest LGD village (point-in-polygon via BigQuery GIS against village GeoJSON) → confidence 0.9.
2. Else fuzzy-match each `location_clue` against LGD village names (Tamil + transliterated). Use `SOUNDEX`/trigram + a small alias table for Dharmapuri villages. Take best score.
3. If no signal → `location_unresolved=true`, bucket to constituency level.

**BigQuery `lgd_villages` (reference, loaded day 1)**
```
lgd_village_code STRING, village_name_en STRING, village_name_ta STRING,
block STRING, district STRING, constituency STRING, lat FLOAT, lng FLOAT
```

**Output → Firestore `.geo`** + also written to BigQuery `demand_records`:
```json
{ "lgd_village_code":"TN-DH-0042","village_name":"Vellampatti",
  "block":"Palacode","district":"Dharmapuri","location_confidence":0.87 }
```

**Demo shortcut:** scope LGD + GeoJSON to **Dharmapuri district only** (~hundreds of villages, not all of India). Hand-curate an alias table for the ~10 villages used in the demo so they always resolve cleanly.

**Acceptance:** the 5 demo villages (incl. Vellampatti hero village) resolve at confidence > 0.8.

---

## Step 3 — Scheme Matching ("Whose money is this?") · **LIVE**

**Goal:** route each need to the responsible scheme and classify gap type.

**Services:** static routing table (BigQuery/JSON) + one Gemini eligibility check + scheme-coverage lookup.

**Routing table (curated, static)**
```
water→JJM | housing→PMAY-G | jobs/assets→MGNREGA | sanitation→SBM-G
health→NHM/Ayushman | education→Samagra Shiksha | pension→NSAP | (none)→MPLADS
```

**Process**
1. Rule-based primary match `need_category → scheme`.
2. Gemini secondary check: *"Does this need fit {scheme} eligibility? Answer Yes/No/Partial + one-line reason."*
3. Look up `scheme_coverage` for the village:
   - covered but failing → `match_type = delivery_failure`
   - not covered → `coverage_gap`
   - no scheme fits → `mplads_candidate = true` (Track B)

**Output → Firestore `.scheme`** + BigQuery `demand_records`:
```json
{ "matched_scheme":"Jal Jeevan Mission","scheme_code":"JJM",
  "match_type":"delivery_failure","village_jjm_status":"sanctioned_not_completed",
  "mplads_candidate":false,"track":"A" }
```
Set `status: "matched"`. **This completes the live path** — the submission now shows on the dashboard with its scheme tag.

**Acceptance:** water complaint from a JJM-sanctioned-but-incomplete village → `delivery_failure`, Track A. A need with no scheme → `mplads_candidate`, Track B.

---

## Step 4 — Demand Aggregation & Theme Detection · **PRECOMPUTED**

**Goal:** cluster all `need_detail` into recurring themes per ward/village with volume + recency, de-duped and anti-lobbying-guarded.

**Services:** Vertex AI text-embeddings → clustering (run in a Python batch job on Cloud Run job / notebook), write results to BigQuery.

**Process**
1. Embed every `need_detail` (`text-embedding-*`).
2. Cluster (DBSCAN by cosine, or k-means with chosen k) → theme per village.
3. `recency_score`: weight last 7 days × 2.
4. **Dedup:** same submitter + same issue → count once.
5. **Anti-lobbying:** >80% text similarity from different users within 24h → `coordinated_flag=true`, down-weight 0.3×.

**BigQuery `theme_clusters`**
```
theme_id STRING, theme_label STRING, need_category STRING,
village_count INT, submission_count INT, recency_score FLOAT, coordinated_flag BOOL
```

**Demo shortcut:** run once over the seeded dataset; cache. Provide a "Recompute" button that re-runs the job so you *can* show it live if asked, but don't depend on it on stage.

**Acceptance:** "drinking water" emerges as the top theme by volume across the seeded data (matches the demo narrative).

---

## Step 5 — Gap Math (Entitlement Engine) · **PRECOMPUTED**

**Goal:** per scheme per village, compute `gap = eligible − covered` and `gap_value_inr`.

**Service:** BigQuery SQL joining Census + scheme MIS tables on `lgd_village_code`.

**Per-unit values (curated constants):** PMAY-G ≈ ₹1.2L/house; JJM ≈ per-FHTC; MGNREGA ≈ per-jobcard-demand; NSAP ≈ per-pension/yr. Store in a `scheme_unit_value` table so they're auditable.

**BigQuery `scheme_gaps`**
```
village STRING, lgd_village_code STRING, scheme STRING,
eligible INT, covered INT, gap INT, gap_value_inr NUMERIC, gap_type STRING
```
Headline number = `SUM(gap_value_inr)` over the constituency → "₹148 Cr owed but undelivered."

**Demo shortcut:** use best-available resolution (block/district where village isn't published) and **state this honestly** in the pitch. Make sure the hero villages have clean, defensible numbers.

**Acceptance:** constituency headline ₹ figure renders; Vellampatti shows a large defensible PMAY-G/JJM gap.

---

## Step 6 — Silent Village Detection · **PRECOMPUTED**

**Goal:** flag high-need villages with zero/near-zero petitions (the equity hero feature).

**Service:** BigQuery, joins `demand_records` counts × `scheme_gaps` × Census deprivation.

```
silent_score = need_score × (1 / log(petition_count + 1))
silent_flag  = (petition_count = 0) AND (need_score > threshold)
```

**BigQuery `silent_villages`**: `village, petition_count, need_score, silent_score, silent_flag`.

**Demo shortcut:** ensure **Vellampatti = petition_count 0, need_score ~0.91, silent_flag TRUE** — this is the mic-drop moment in the script.

**Acceptance:** Forgotten-Villages screen surfaces Vellampatti as #1.

---

## Step 7 — Priority Scoring & Ranking (+ RAG) · **PRECOMPUTED**

**Goal:** a transparent ranked project list with "why this rank," cross-checked against the real local development plan (no invented projects).

**Service:** BigQuery (the formula) + Vertex AI Search / RAG over the district dev-plan PDF.

**Transparent formula (tunable weights)**
```
Priority = (W1·Demand + W2·Need + W3·Feasibility + W4·Equity) × Scheme_Deduction
W1=0.30 (volume+recency) · W2=0.35 (gap+deprivation) · W3=0.20 (cost vs MPLADS) · W4=0.15 (silent/remote)
Scheme_Deduction: reduce if Track A already covers it.
```
**RAG check:** does this need map to an existing proposed project in the dev plan? If yes → link to it; don't invent.

**BigQuery `ranked_projects`**
```
rank INT, project STRING, score FLOAT, track STRING("A"/"B"),
scheme STRING, village_count INT, beneficiaries INT, why_json STRING
```
`why_json` stores the per-factor breakdown so the UI can render the "why this rank" panel.

**Demo shortcut:** index just the Dharmapuri dev-plan PDF for RAG. Keep weights in a config so you can show the ranking change if a judge asks "what if equity mattered more?"

**Acceptance:** top-4 ranked list matches the proposal's narrative; each row expands to show factor contributions.

---

## Step 8 — Budget Optimiser (Track B) · **PRECOMPUTED**

**Goal:** pick the optimal MPLADS portfolio under the ₹5 cr cap.

**Service:** OR-Tools knapsack in a Python batch job; result cached for the dashboard's allocation cart.

```
maximise Σ Priority_Score(selected)
subject to Σ cost_estimate(selected) ≤ ₹5,00,00,000
input: ranked_projects WHERE track='B'; costs from standard PWD/CPWD rates
```

**Output (cached JSON / BigQuery `mplads_portfolio`):** selected projects, per-item cost+score, total used, remaining contingency.

**Demo shortcut:** precompute the optimal cart; the dashboard "approve" just renders it + generates the PDF. Optionally allow add/remove with a fast re-solve (knapsack on ~20 items is instant) for interactivity.

**Acceptance:** portfolio totals ≤ ₹5 cr, shows remaining contingency, matches proposal example.

---

## Step 9 — Auto-Generated Outputs (Gemini) · **LIVE on click**

**Goal:** one-click official letters (Track A) + justification memos + Track B PDF plan.

**Service:** Gemini (Vertex AI) on button click → render to PDF (e.g. WeasyPrint/ReportLab on Cloud Run) → GCS → signed URL.

**Letter prompt (Track A)**
```
Draft a formal official letter from MP {name}, {constituency}
to the {department head / District Collector}.
Subject: Unfulfilled {scheme} entitlements — {village list}
Body: cite eligible={X}, covered={Y}, gap={Z}, gap_value=₹{V};
request action within 30 days. Tone: formal, factual, no emotional language.
Output letter text only.
```
Also generate a **2–3 line plain-language justification memo** per item for non-technical MP staff.

**Acceptance:** clicking "generate letter" on a Track A item produces a downloadable, correctly-populated PDF in < 5s.

---

## Step 10 — MP Dashboard (5 screens) · **LIVE (reads)**

**Service:** React + Google Maps Platform (web), reads Firestore (live feed) + BigQuery (analytics via FastAPI). React Native app for the citizen side.

| Screen | Source | Key element |
|---|---|---|
| 1 — Citizen Intake (live feed) | Firestore | recent submissions, category + scheme tag, status |
| 2 — Priorities | `theme_clusters`, `ranked_projects` | top themes, hotspot choropleth, ranked list + "why" |
| 3 — Constituency X-Ray *(hero)* | `scheme_gaps` | village coverage heatmap, "₹148 Cr owed" headline |
| 4 — Act | `ranked_projects`, `mplads_portfolio` | Track A letters · Track B ₹5 cr cart → PDF |
| 5 — Forgotten Villages | `silent_villages` | silent + high-need alert cards, "add to plan" |

**FastAPI endpoints (read):** `/themes`, `/ranked-projects`, `/scheme-gaps`, `/silent-villages`, `/portfolio`, `/submissions/live` (or Firestore SDK direct for the live feed).

**Demo shortcut:** Screen 3 (X-Ray) is the hero — polish it most. Screen 1 live feed should visibly update when the judge's Telegram message lands (Firestore real-time listener).

**Acceptance:** all 5 screens render from cached/live data; new submission appears on Screen 1 within seconds.

---

## Step 11 — Close the Loop · **LIVE on click**

**Goal:** when staff marks an item "letter sent"/"approved," notify every citizen who submitted on that issue.

**Service:** Firestore update → Cloud Function trigger → look up linked submissions → Telegram/SMS send in the citizen's original language.

**Process**
1. Staff action sets `status: actioned` on a village/need.
2. Trigger queries `submissions` where `lgd_village_code` + `need_category` match.
3. Send: *"Your concern about {issue} in {village} has been raised with the {authority}. Reference #{id}"* — translated back to `lang`.

**Acceptance:** marking the demo water item actioned → the judge's Telegram chat receives a Tamil confirmation referencing their submission.

---

## Build sequence (mapped to the proposal's 15-day plan, compressed to 9)

| Days | Focus | Steps |
|---|---|---|
| 29 Jun–1 Jul | Data acquisition + BigQuery schema; **seed synthesised petitions** | Appendix A, Steps 2/5 tables |
| 1–3 Jul | Live intake pipeline (web + Telegram) → STT → Translation → Gemini → Firestore | **0–3** |
| 2–5 Jul | The hard data joins: scheme-match coverage, gap math, silent detection | **3,5,6** (most effort) |
| 4–6 Jul | Batch jobs: clustering, ranking + RAG, OR-Tools optimiser | **4,7,8** |
| 5–7 Jul | Dashboard 5 screens (X-Ray hero first) + citizen app | **10** |
| 6–7 Jul | Auto-letters/memos + PDF; close-the-loop notify | **9,11** |
| 7 Jul | Deploy to Cloud Run / Firebase; end-to-end rehearsal | all |
| 8 Jul | **Submit:** source code · demo video · pitch deck · live link | — |

**Critical path = Steps 0–3 live + Step 10 Screen 3.** If time slips, cut breadth (fewer schemes, fewer screens) — never cut the live intake moment or the X-Ray hero screen.

---

## Appendices (referenced above)

### Appendix A — Synthesised petition dataset (200–500 records)
Generate with Gemini: realistic Tamil/Hindi/English complaints across the top-8 categories, mapped to real Dharmapuri villages, with a recency spread (last 90 days, weighted recent) and a few deliberate coordinated-flood clusters (to demo the anti-lobbying guard) and **zero** petitions for the silent hero village. Fields match the Step 0 + Step 1 + Step 2 schemas so they flow straight into the analytics tables.

### Appendix B — Full complaint taxonomy (for pitch slide)
Infrastructure · Water & Sanitation · Housing · Education · Health · Livelihood/Jobs · Social Entitlements/Pensions · Agriculture · Environment/Safety · Governance/Process. **Build-time classification collapses to the top 8** (`water/road/housing/education/health/jobs/pension/sanitation`) + `other`.

### Appendix C — Extraction eval set
~20–30 labelled complaints (mixed EN/TA/HI, mixed categories, 2–3 spam/test) to validate Step 1 (category accuracy) and Step 3 (scheme routing) before the demo. Target ≥ 90% category accuracy on this set.

### Appendix D — Language handling (decided: EN/TA/HI)
- **STT:** `en-IN` / `ta-IN` / `hi-IN`.
- **Pipeline language:** everything normalises to **English** (Translation API) before Gemini; processing is English-only.
- **Citizen-facing replies:** returned in the submitter's original language.
- **MP dashboard, letters, memos:** English only.
- **UI i18n:** `react-i18next` + 3 JSON locale files (web) / equivalent on React Native.
