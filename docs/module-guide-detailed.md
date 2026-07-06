# Sarvik — Detailed Module Guide

For every screen: what it is · the MP problem it solves · every element on the page · a worked example with real data · how it works under the hood · why the MP cares · the likely question + your answer.

Core thesis (say this first, always):
> "An MP's own MPLADS fund is ₹5 crore a year. But their people are owed **hundreds of crores** under central schemes (PMAY, Jal Jeevan, NHM, MGNREGA…) they haven't received. The failure isn't budget — it's *delivery and convergence*. Sarvik finds that owed money, routes it to the right department, and lets the MP unlock it for ₹0 — spending their ₹5 crore only on the gaps nothing else covers."

---

## 1. Dashboard (Overview) — `/`

**What it is:** the command centre. Opens by default. One screen = the whole constituency's situation and the MP's decisions.

**The problem it solves:** an MP has no single place that tells them *how big the real problem is* and *where to start*. Data is scattered across departments; the office reacts to whoever shouts loudest.

**Every element on the page:**
- **Greeting bar:** "Good morning, MP Office · Coimbatore. Your decisions start here."
- **The owed hero (the lead):** *"Already owed to your people · unclaimed entitlements — ₹1,619 crore."* Subtext: "This money is your constituents' by right — Track A unlocks it with letters, spending ₹0 of your ₹5 cr MPLADS before it's touched." This is the single most important number in the product.
- **Supporting stats (secondary, each with a provenance chip):** Villages never asked (36), Villages with real coverage data (237), Complaints processed (270). Deliberately smaller than the hero — money owed leads, not complaint volume.
- **Two-floor strip:** *Floor 1 — Consolidate & rank* (the complaint inbox judges expect) / *Floor 2 — Unlock what's owed* (the differentiator). Explains the whole product in two cards.
- **By-department block:** a ₹-owed bar chart + department cards (Housing ₹633 cr, Sanitation ₹307 cr, Health ₹249 cr…). Each card is clickable.
- **Top priorities:** the 6 highest-ranked projects with 0–100 scores.
- **Provenance chips everywhere:** "real / synthetic / computed" — honesty about each number's source.
- **Clickable:** department cards, priority rows, and recent-activity items all open the complaints behind them.

**Worked example:** You log in Monday. The hero reads **₹1,619 crore owed**. You see **Housing ₹633 cr** is the biggest. You think "₹1,600 crore of my people's money is stuck — housing is the worst." You click Housing → drills into that department.

**How it works under the hood:** the hero = `SUM(gap_value)` across every area×scheme in BigQuery, where `gap_value = (eligible − already-covered) × per-unit scheme value`. "Eligible" comes from real Census 2011 Coimbatore data; "covered" from scheme MIS (real where available, modelled for urban wards, labelled honestly). The department split is a `department_summary` aggregation.

**Why the MP cares:** it reframes their job from "spend my ₹5 crore" to "unlock the ₹1,600 crore already owed." That's a 300× bigger lever.

**Likely question → answer:**
- *"Is this ₹1,619 crore real?"* → "The eligibility is real Census data; the coverage is real where the scheme publishes it and modelled where it doesn't — every number is tagged 'real' or 'modelled' so you always know."

---

## 2. Intake — `/intake`

**What it is:** every citizen complaint, from any channel and any language, turned into one clean, structured, searchable list.

**The problem it solves:** complaints arrive as WhatsApp voice notes, phone calls, paper petitions, emails, Gram Sabha shouts — in Tamil and English — and drown the office. Nothing is consolidated or searchable.

**Every element on the page:**
- **Header:** "270 demands" + a "Synthetic / Live" honesty tag.
- **Search box:** filter by place, category, or channel.
- **Complaint feed.** Each card:
  - **Language chip** (EN / TA) — the language the citizen actually used.
  - **Category chip** (Water, Road, Housing, Health, Sanitation, Pension…) — auto-classified by AI.
  - **Channel chip** (Web, Phone, Meeting, Telegram) — how it arrived.
  - **The complaint text** in the original language.
  - **Place · urban/rural** on the right.
- **Pagination** (15 per page).

**Worked example:** You scroll and see, in the citizens' own words:
- *"Siruvani level crashed — Saravanampatti now gets water once a week."* (EN, Water, Web)
- *"Ganapathy-ல மூணு நாளைக்கு ஒரு முறை தான் தண்ணி வருது."* (TA, Water, Meeting)
- *"Vellalore dump — our well water is now undrinkable."* (Sanitation)
These are **real Coimbatore issues drawn from news reports**, so a local instantly recognises them.

**How it works under the hood:** each raw submission → Gemini 2.0/2.5-flash (multimodal) transcribes/translates + extracts `{category, urgency, beneficiaries, location clues}` as strict JSON → geo-resolution pins it to a ward/village → stored in BigQuery. The same pipeline handles a voice note, a photo of a letter, or typed text.

**Why the MP cares:** the office stops hand-sorting petitions. Everything becomes one searchable record — instantly.

**Likely question → answer:**
- *"Are these real complaints?"* → "For privacy the citizen complaints are synthesised, but they're built from **real, news-sourced Coimbatore issues** and mapped onto real wards — in a pilot it plugs straight into your WhatsApp/helpline."

---

## 3. Priorities — `/priorities`

**What it is:** the deduplicated, ranked, *justified* to-do list. The AI doesn't just count complaints — it explains whether each one is a genuine need or already served.

**The problem it solves:** 270 complaints ≠ 270 problems. Fifty people report one broken road. And a request isn't automatically valid — someone may ask for a school 4 km from an existing one.

**Every element on the page:**
- **Dedup headline:** "300 raw → 79 issues, duplicates merged."
- **Score-distribution spark:** a mini bar chart showing scores spread (not all identical).
- **Ranked list.** Each row:
  - **Rank** (1…N, sorted by score).
  - **Title** + **Track A/B** chip.
  - **Place · category.**
  - **"Why this matters"** verdict badge: *genuine gap · ~15 km* (act, red) / *watch · ~7 km* (amber) / *likely served · ~4 km* (grey, skip) + a one-line reason.
  - **Factor chips:** Need 35 · Feasibility 16 · Equity 15 — the transparent breakdown of the score.
  - **Score (0–100).**
  - **Click a row → the actual citizen complaints behind it.**

**Worked example:**
> **#1 · Water — JJM in Boluvampatti · Score 76 · Track A** — *"Genuine gap — nearest treated-water supply is ~15 km away."*
> **#40 · School in Vadavalli · Score 22** — *"Likely already served — a government school operates ~4 km away."* → skip.
You click #1 → the modal shows the residents who reported it. Now it's evidence, not noise.

**How it works under the hood:** complaints are embedded (Gemini embeddings) and clustered by semantic similarity + same area/category → unified issues (dedup); coordinated floods are flagged. Ranking is a **transparent weighted formula** — `0.30·Demand + 0.35·Need + 0.20·Feasibility + 0.15·Equity` (not a black box, so it's auditable). The "why this matters" verdict is a **proximity check**: for a school/PHC/water request, it finds the nearest area that already has that facility (haversine on coordinates) → served if ≤5 km, genuine gap if >10 km.

**Why the MP cares:** they act on real, defensible need — and can justify every decision publicly. "I funded this because the nearest school was 15 km away" beats "someone asked."

**Likely question → answer:**
- *"How is the score calculated?"* → "A transparent weighted formula you can see and tune — Demand, Need, Feasibility, Equity. Government only deploys what it can explain, so there's no black box."

---

## 4. Constituency X-Ray — `/x-ray`

**What it is:** the spatial view — a real Google Map + a list showing exactly where scheme money is failing to land, ward by ward, village by village.

**The problem it solves:** an MP can't *see* where the gaps are. A table of numbers doesn't show that the whole north-west of the constituency is under-served.

**Every element on the page:**
- **Owed hero:** "₹1,619 crore entitlements owed" (the same headline, now spatial).
- **Google Map (Map / Grid toggle):** every area is a colored marker — **red = biggest gap, amber, green = well covered**, sized by ₹ owed. Click a marker → area name, coverage %, ₹ gap, top scheme.
- **"Biggest gaps" list:** each area with its scheme (PMAY-U, NHM, JJM…), coverage ("1,060 / 2,425 covered"), a **real·Census / modelled** provenance tag, and ₹ owed. Click a row → the complaints for that area. Has a search + department filter.
- **"Top gaps by ₹" bar chart** at the bottom.

**Worked example:** The map shows **Race Course ward glowing red** — 1,060 of 2,425 families covered under PMAY-U, **₹34 crore owed there**. Kavundampalayam also red. You click Race Course → its gap breakdown + the citizen complaints from that ward. "So THIS is the worst ward for housing."

**How it works under the hood:** coverage per (area, scheme) drives the color; ₹ owed drives the size. Coordinates come from the geo skeleton (wards + fringe villages). The map uses the Google Maps JavaScript API; if the API key/referrer fails, it silently falls back to a colored grid so it never shows a broken card.

**Why the MP cares:** one glance = where to send resources first. It's the "heat map of unfairness."

**Likely question → answer:**
- *"Why is some data 'modelled'?"* → "Rural schemes (Jal Jeevan, PMAY-G) publish real village-level numbers — those are tagged 'real'. Urban ward coverage isn't published, so we model it from city totals against ward Census, and we say so openly."

---

## 5. Departments — `/departments`

**What it is:** the same owed money, re-grouped by the *department accountable for delivering it*, with the exact central schemes to invoke.

**The problem it solves:** an MP thinks in terms of *"who do I pressure?"* — not in terms of schemes. They need a department-wise agenda.

**Every element on the page:**
- **One rich panel per department** (sorted by ₹ owed): Housing, Sanitation, Health, Rural Dev, Revenue, Water, Education.
  - **Big ₹ owed** + **issue count.**
  - **★ Central schemes to push:** highlighted, colored badges — e.g. Housing → **PMAY-Gramin, PMAY-Urban** (Ministry of Housing & Urban Affairs); Health → **NHM** (+ Ayushman Bharat as context); Water → **Jal Jeevan, AMRUT**. Each badge names the responsible ministry.
  - **Top areas** with per-area ₹ (click → complaints).
  - **Share bar** — that department's % of total ₹ owed.
  - **"Send letter →"** action linking to Act.

**Worked example:**
> 🏠 **Housing — ₹633 crore owed · 90 issues**
> ★ Central schemes to push: **PMAY-Gramin, PMAY-Urban**
> Top areas: Race Course ₹34 cr, Kavundampalayam ₹34 cr, Selvapuram ₹32 cr…
You think: "My next meeting with the Housing Secretary — here's my exact agenda and the number: ₹633 crore, under PMAY, worst in Race Course."

**How it works under the hood:** every scheme maps to a responsible department (a routing table); the `department_summary` table aggregates ₹ owed, issue counts, schemes, and top areas per department. A static scheme-metadata map adds the ministry + well-known sibling schemes as context.

**Why the MP cares:** it turns data into a **pressure list** — exactly who to call, about what scheme, for how much.

**Likely question → answer:**
- *"How does this help me vs the department?"* → "You walk into a review with the department already knowing their own gap number and the scheme — you're not asking, you're holding them to account."

---

## 6. Act — `/act`

**What it is:** the decision + action screen. Two tracks: **A** = unlock existing entitlements for ₹0; **B** = spend the MP's ₹5 crore only on true gaps.

**The problem it solves:** insight is useless without action. The MP needs to *do* something in one click — and know when to use central money vs their own.

**Every element on the page:**
- **Two tabs:** "Track A · Letters" and "Track B · ₹5 Cr cart."
- **Track A** — collapsible cards, one per department. Expand → a summary of that department's owed items (top areas + "and N more") → **"Generate letter to {Dept}"** → a **letter preview** opens (Ref no., scheme, eligible-but-unlisted count, ₹ owed, area annexure) → **"Send to department"** → "Sent ✓". Per-item, a "Why eligible" affordance shows the eligibility rationale. **₹0 of MPLADS.**
- **Track B** — the needs **no central scheme covers** (mostly local roads/works), deduplicated. An **MPLADS ₹5 crore cart**: each candidate shows its ₹ cost; you tick works; a running total + over-budget guard; the AI's recommended mix (maximise beneficiaries within ₹5 cr).
- Every item is clickable → the complaints behind it.

**Worked example:**
- *Track A:* card "Housing — 90 items, ₹633 cr." Click **"Generate letter to Housing Dept"** → a formal letter appears listing the eligible families and the PMAY gap → **Send** → "Sent ✓". You just moved to unlock **₹633 crore** with one letter, spending **₹0**.
- *Track B:* "Road in Ukkadam — ₹1.28 crore." You add it + a drain (₹0.8 cr) to the cart; the AI recommends a 3-project mix at ₹4.6 cr covering the most people.

**How it works under the hood:** Track A letters are drafted by Gemini (with a template fallback), rendered to PDF. Track B uses an **OR-Tools knapsack optimiser** — maximise total priority subject to Σ cost ≤ ₹5 crore. "Send" is a demo confirmation ("Sent ✓"); in production it emails/files the letter.

**Why the MP cares:** this is where money moves. Unlock what's owed for free; spend their own fund only where nothing else will.

**Likely question → answer:**
- *"Does the letter actually go anywhere?"* → "In the demo, Send confirms. In a pilot it emails/files to the department and tracks status — so nothing falls through."

---

## 7. Forgotten Villages — `/forgotten`

**What it is:** the equity layer — high-need areas that send **zero** complaints, so they never get attention.

**The problem it solves:** every system rewards whoever complains loudest. The poorest, most remote areas don't complain — so they're invisible and get nothing.

**Every element on the page:**
- **A sortable table:** Area · **Need score** (high) · **Petitions (0)** · **Silent score** · **Flagged** tag. A count of flagged areas.
- Click a row → the complaints modal, which reads: *"No complaints from here — that's exactly why it's a forgotten village."*

**Worked example:**
> **Boluvampatti R.F. · Need 1.0 · Petitions: 0 · Flagged**
> **Anaikatti North R.F. · Need 1.0 · Petitions: 0 · Flagged**
Worst indicators, zero complaints. You click one → "0 complaints — that's the point." You add it to your ₹5 cr plan.

**How it works under the hood:** `silent_score = need_score / log(petition_count + 2)` (divide-by-zero-safe). Need comes from real Census amenity deficits; petition count from the complaint feed. Areas with need > 0.6 and 0 petitions get flagged.

**Why the MP cares:** it's the moral + political win — reaching people no one else does, defensibly, with data.

**Likely question → answer:**
- *"How do you know they need it if they didn't ask?"* → "Real Census data on their amenities — no school, no treated water, no PHC. The need is measured, not assumed."

---

## 8. Scan Petition — `/scan`

**What it is:** the real front-desk moment — turn a photographed paper letter or a voice note into a structured record instantly.

**The problem it solves:** most citizens still hand in paper. That paper dies in a file. The front desk isn't searchable.

**Every element on the page:**
- **Drop zone:** "Drop a file — photo, PDF, or voice note."
- **Language selector** (Tamil / English).
- **"Submit petition"** → "AI is reading…" → the **extracted record**: category, place, scheme, Track A/B, beneficiaries + **the transcript** ("what the AI read").

**Worked example:** A citizen hands your staff a paper letter. Staff photograph it → drop it here → "AI is reading…" → out comes **"Water · Peelamedu · AMRUT · 200 families."** Five seconds.

**How it works under the hood:** the file goes straight to **Gemini multimodal** — it reads the photo/PDF/OCR or transcribes the audio, then extracts the same structured record as typed text. No separate OCR or speech engine.

**Why the MP cares:** the office becomes instant and searchable; nothing is lost. It's also the most convincing live demo moment.

**Likely question → answer:**
- *"Does it handle Tamil handwriting / accents?"* → "Gemini is multilingual and multimodal — it reads Tamil and English, printed or spoken. Accuracy improves with real samples in a pilot."

---

## 9. Ask Sarvik — `/ask`

**What it is:** a chatbot that answers any question about the constituency in plain language, grounded in the real data — like an analyst on call.

**The problem it solves:** the MP can't write SQL or dig through dashboards. They want to *ask*.

**Every element on the page:**
- **Chat box** + suggested questions ("Which department owes the most?", "Top forgotten villages?", "Which projects fit my ₹5 crore?").
- **Answers:** structured, with ₹ figures highlighted in green, bold key terms, and **clickable chips** ("View Departments →", "Act →") that jump to the relevant screen; department/scheme names in the answer are also clickable.

**Worked example:** You type *"Which department owes the most?"* → *"**Housing — ₹632.50 crore**, 90 issues, mostly under PMAY-U in Race Course & Kavundampalayam. **Next step:** send the PMAY letter this week."* + a "View Departments →" button.

**How it works under the hood:** on each question, the backend pulls a compact data context from BigQuery (totals, all departments, top gaps, top ranked projects with costs + verdicts, silent villages, complaint category counts, unified issues) and sends it with a "senior policy analyst" system prompt to Gemini — which answers *only* from that data, cites numbers, explains why, and ends with a recommended action.

**Why the MP cares:** zero learning curve — ask like you'd ask a bright aide, get a sourced answer in seconds.

**Likely question → answer:**
- *"Can it make up numbers?"* → "It's instructed to answer only from the provided real data and to say when the data doesn't cover something — no hallucinated figures."

---

## The whole story in one line
> "270 real complaints came in → Sarvik showed me **₹1,619 crore my people are owed**, exactly **which department** owes it, drafted the **letters to unlock it for ₹0**, told me to spend my **₹5 crore only on the roads nothing else covers**, and pointed me to the **36 villages that never even asked** — Coimbatore today, any of India's 543 constituencies tomorrow."
