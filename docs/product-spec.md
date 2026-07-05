# Sarvik — Product Spec

**AI Constituency-Intelligence for a Member of Parliament & office staff**
**Demo constituency:** Coimbatore (PC-20, Tamil Nadu) · **Status:** Build spec (v1.0) · **Author:** Alex (PM) · **Stack:** React (web) · React Native (mobile) · FastAPI

---

## 0. The one-sentence product

> Sarvik turns thousands of messy, multilingual constituent complaints into a ranked map of **whose job it is, what's already owed, and where the MP's own money actually moves the needle** — so an MP walks into a district review with receipts, not anecdotes.

The product's spine is a single argument the MP can win any meeting with:
**"₹463 crore is already owed to my people under existing schemes. Before I spend a rupee of my ₹5 crore, unlock that. Then I'll spend mine only on the gaps nothing else covers."**

Everything on screen exists to make that sentence undeniable.

---

## 1. Jobs-to-be-done — who opens Sarvik Monday, to DO what

### 1a. The MP (the principal) — "Make me powerful in the room"

The MP does not process complaints. The MP **applies pressure** and **allocates scarce money and attention**. The MP thinks in *departments, constituencies (assembly segments/wards), and political risk* — not in scheme acronyms.

**Monday-morning job:** *"In 5 minutes, tell me what's on fire, whose fault it is, and what I should push at today's district review — and hand me the letter to sign."*

The single decision Sarvik drives for the MP: **Where do I spend my next unit of pressure (a call/letter/review) and my next rupee?**

Concretely, the MP opens Sarvik to walk out with:
1. The **top 3 departments** to publicly push, with the number that embarrasses them (owed vs. delivered).
2. A **stack of pre-drafted department letters** to sign — Track A, costs ₹0.
3. An **allocation plan for the ₹5cr** that survives scrutiny because it only funds true gaps.

### 1b. The office staff (the operators) — "Turn the firehose into a clean list"

Staff live in intake, triage, and follow-up. Their pain is volume, duplication, language, and "did anyone actually action this?"

**Monday-morning job:** *"Clear the weekend's intake, kill the duplicates, confirm the AI routed each issue to the right department, and send what's ready to send."*

The single decision Sarvik drives for staff: **What's genuinely new, is it routed correctly, and what can go out the door today?**

> **Design consequence:** two entry modes off the same data. MP lands on **Overview** (decision surface). Staff land on **Intake queue** (work surface). Same records, different verb — MP *decides*, staff *process*.

---

## 2. Information hierarchy — what the MP sees FIRST

**The lead number is the entitlement gap: `₹463 crore owed-but-undelivered`.** Not complaint count. Complaint count is a workload metric; the owed-gap is a *power* metric — it reframes the MP from "petition clerk" to "auditor of the government's own promises." That is the emotional and political hook, and it's backed by real Census data.

Overview reads top-to-bottom as a **narrative**, not a dashboard grid:

1. **The headline (power):** ₹463 cr owed across Coimbatore → *"This is money your people are already entitled to and haven't received."* Sub-stat: across N schemes, M departments.
2. **The leverage (Track A vs B):** one bar — `₹463cr unlockable for ₹0` vs `₹5cr of your funds`. Establishes the whole strategy in one glance.
3. **The accountability (departments):** top 3 departments by owed-gap, each with a "push this" call-to-action. This is where the MP's eyes should land longest.
4. **The signal integrity (dedup):** "300 raw → 245 real issues · 1 coordinated campaign flagged." Tells the MP the numbers are clean and someone tried to game them.
5. **The conscience (silent villages):** "24 high-need areas filed zero petitions." The counter-intuitive line — *the loudest wards aren't the neediest.*
6. **Today's actions:** N letters ready to sign · top 3 priorities.

Rule: **one screen, one scroll, no login-to-insight gap.** If the MP has to click to understand the state of the constituency, we failed.

---

## 3. Department-wise view — "whose job is it?"

The MP's mental model is **pressure targets**, so the schemes are backstage; **departments are the front page.** Scheme convergence (urban→AMRUT/PMAY-U/NULM, rural→JJM/PMAY-G/MGNREGA, health→NHM, education→Samagra Shiksha, pension→NSAP, sanitation→SBM) runs under the hood; the UI rolls every routed issue up to the **responsible department** via `/api/departments`.

Each department is a **pressure card**, sorted by owed-gap (biggest embarrassment first):

```
┌─────────────────────────────────────────────┐
│ TWAD Board (Water)              ⬤ HIGH        │
│ ₹142 cr owed · 3,200 households · 47 wards    │
│ Schemes: JJM, AMRUT                           │
│ Trend ▲ 12% vs last month                     │
│ "Push at Thursday district review"            │
│ [ Draft letter ]  [ See issues ]              │
└─────────────────────────────────────────────┘
```

The three elements that make it instantly actionable:
- **The number that embarrasses them** (owed ₹ + households affected) — the MP's opening line in the meeting.
- **The one-line "what to push"** — translates data into a spoken sentence.
- **One button: Draft letter** — pressure becomes an artifact in one click.

> An MP should be able to read the Departments screen aloud as a meeting agenda. If it doesn't read like an agenda, it's still a dashboard.

---

## 4. Screen-by-screen spec

Eight screens. For each: **Job · Key elements · The one action · CUT.**

### 4.1 Overview  (MP home)
- **Job:** In 60 seconds, know the state of the constituency and what to do today.
- **Key elements:** (1) ₹463cr owed headline + Track A/B leverage bar; (2) Top-3 department pressure cards; (3) "Today": letters-to-sign count + top-3 priorities; small dedup + silent-village stat strip.
- **One action:** Tap a department card → jump to its pressure view (or "Review today's letters").
- **CUT:** time-series charts, complaint-volume vanity counters, per-language breakdown, anything requiring interpretation. No filters on the home screen.

### 4.2 Departments  ("whose job is it")
- **Job:** Decide which department to pressure and generate the artifact to do it.
- **Key elements:** (1) Ranked pressure cards (owed ₹, households, wards, trend); (2) department detail drawer (issue list, schemes rolled up, historical responsiveness if available); (3) "Draft letter" generator.
- **One action:** Draft department letter (Track A).
- **CUT:** scheme-first navigation, org-chart of sub-departments, contact directory. The MP wants the *lever*, not the phone book.

### 4.3 Priorities  (the ranked "do these 3")
- **Job:** Tell the MP the 3–5 highest-impact issues this week and why they rank there.
- **Key elements:** (1) Ranked list with a transparent score chip (severity × people affected × silence-adjustment); (2) one-line rationale per item ("2,400 people, health, zero prior petitions"); (3) Track A/B tag (unlockable vs needs-your-money).
- **One action:** Send to Act (route to letter or allocation).
- **CUT:** user-tunable weight sliders (looks powerful, erodes trust — we defend the ranking, we don't outsource it), infinite scroll. Cap at ~10.

### 4.4 Constituency X-Ray  (the map)
- **Job:** See *where* need concentrates and expose the loud-vs-needy mismatch.
- **Key elements:** (1) Ward/segment map shaded by **need**, with a toggle to shade by **petition volume** — the gap between the two IS the insight; (2) tap-a-ward panel (owed ₹, top departments, silent-flag); (3) silent-village overlay.
- **One action:** Drill a ward → its issues/departments.
- **CUT:** heatmap eye-candy layers, individual complaint pins (privacy + noise), 3D. Two clean choropleth layers beat ten.

### 4.5 Act — Two-Track  (the money + letters engine)
- **Job:** Convert insight into (A) signed department letters for ₹0 and (B) an optimized spend of the ₹5cr.
- **Key elements:**
  - **Track A panel:** queue of auto-drafted department letters, each showing owed-amount unlocked, editable body, [Approve & export].
  - **Track B panel:** OR-Tools allocation of ₹5cr across *true gaps only* (things Track A can't cover) — table of funded items with cost, people reached, and a "why this over that" line; a "what ₹5cr buys" summary.
  - Toggle/contrast making explicit: **Track A first (free), Track B only for residual gaps.**
- **One action:** Approve the allocation plan / sign the letter batch.
- **CUT:** manual line-item budgeting from scratch, procurement/vendor workflow, multi-scenario what-if sandbox (offer ONE defensible plan + reason, not a spreadsheet). Editable, not build-your-own.

### 4.6 Forgotten Villages  (silent-village detection)
- **Job:** Surface the 24 high-need, zero-petition areas so the neediest aren't invisible because they're quiet.
- **Key elements:** (1) List/map of the 24 with the need signal that flags them (Census deprivation vs. zero inbound); (2) "why silent" hypothesis (no digital access / no local broker); (3) proactive action — schedule camp / push department.
- **One action:** Add to Priorities / draft proactive outreach.
- **CUT:** demographic deep-dives, editorializing. State the fact, offer the action.

### 4.7 Intake  (staff work surface)
- **Job:** Ingest weekend multimodal complaints and confirm structured, deduped, routed records.
- **Key elements:** (1) Multimodal drop (voice/photo/PDF/text; Tamil/Hindi/English) → structured record preview with confidence; (2) dedup view: "300 raw → 245 unified" with merge groups the operator can confirm/split; (3) coordinated-campaign flag with the evidence (near-identical text, time clustering).
- **One action:** Confirm & route (accept the AI's structuring + department tag).
- **CUT:** manual data-entry forms as the primary path (AI-first, human-confirm), bulk mystery-imports without a review step.

### 4.8 Scan Petition  (mobile-first single-item)
- **Job:** A field staffer photographs one paper petition and it becomes a routed record on the spot.
- **Key elements:** (1) Camera/upload; (2) instant extraction + language detection → editable structured card (name, ward, issue, department); (3) "matches existing issue?" dedup nudge.
- **One action:** Save → routed record (lands in Intake).
- **CUT:** everything else. This screen does one thing perfectly. No dashboards on mobile.

---

## 5. The 3 "wow" moments — "I'd use this Monday"

1. **"₹463 crore is already yours."** The reframe from complaints to *owed entitlement from real Census data*. The MP stops seeing a to-do list and sees an audit of the government's broken promises — pressure they can wield publicly. This is the moment the pitch lands.

2. **"Spend ₹0 before you spend ₹5cr."** Track A auto-drafts department letters that unlock existing entitlement for free; the OR-Tools optimizer then spends the MP's discretionary ₹5cr *only* on true residual gaps. No MP has ever been handed "here's how to not waste your own money" — it's fiscally and politically irresistible.

3. **"24 villages that never asked."** Silent-village detection inverts the squeaky-wheel bias every politician knows they have. Showing the MP the *needy who are invisible because they're quiet* is a conscience-and-credibility moment — and a re-election insight. (Bonus half-wow: "1 coordinated campaign flagged" — proof the numbers can't be astroturfed.)

Each wow is a **number the MP can repeat in a sentence** — that's the test for "would use Monday."

---

## 6. What to CUT (over-building & noise)

- **Vanity volume metrics** — total complaints, messages/day, response-time graphs. Workload, not power. Demote or delete.
- **Scheme-first navigation** — the MP doesn't think in AMRUT/PMAY. Keep scheme convergence backstage; surface departments.
- **Tunable ranking sliders / multi-scenario budget sandbox** — looks smart, signals "we don't trust our own model." Offer ONE defensible plan + a reason; make it editable, not configurable.
- **Chat/LLM free-text box on the home screen** — invites a demo where the model says something wrong. Sarvik asserts; it doesn't chat.
- **Individual complainant PII on maps/dashboards** — privacy risk and noise. Aggregate everywhere except the single-record intake surface.
- **Notifications, settings, user-management, org charts, contact directories** — real product, not a demo differentiator. Stub or hide.
- **Time-series everything** — one trend arrow per department is enough; charts imply history we're synthesizing.

> Rule of thumb: if an element requires the MP to *interpret* rather than *act*, it's noise on this product.

---

## 7. Credibility guardrails — real vs. synthetic, honestly

The strongest asset is that the **entitlement gap and silent villages come from real Census data.** Protect that by being transparent, which *increases* trust rather than undermining it:

- **Provenance chips on every headline number.** `● Census 2011 (real)` vs `◐ Synthetic complaints (demo)` vs `● Computed (OR-Tools/dedup)`. Tap → one-line methodology. The MP-facing story ("₹463cr owed") rests on real data; the complaint corpus is clearly labeled illustrative volume.
- **Show the seams on dedup, don't hide them.** "300 → 245" with confidence and a human-confirm step signals a tool that assists judgment, not one that fabricates certainty. Expose the coordinated-campaign evidence.
- **State assumptions inline on Track B.** The optimizer shows unit costs and "reaches N people" with a footnote on cost basis. Never present an allocation as fact without its inputs.
- **Confidence, not false precision.** Extraction/routing carry a confidence indicator; low-confidence routes get a "review" flag rather than silent auto-assignment.
- **One honest line in the pitch:** *"Real entitlement math on real Census data; the incoming complaints are synthetic to show the pipeline at volume. Point it at a live intake and the plumbing is identical."* Owning the boundary is more credible than blurring it.

---

## 8. Build priority (must / should / cut)

- **MUST (demo spine):** Overview · Departments · Act (two-track) · Forgotten Villages · Scan Petition. These carry all 3 wow moments.
- **SHOULD:** Priorities · Constituency X-Ray · Intake dedup view. High value, degrade gracefully if time-boxed.
- **CUT for demo:** notifications, settings, auth beyond a demo login, any config/admin surface, chat.

**North-star for the build team:** every screen must answer *"so what does the MP DO with this?"* in one visible button. If a screen has no verb, it's a report — and reports don't get used Monday.
