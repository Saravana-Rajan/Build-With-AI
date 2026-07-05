# Track 1 — Risk & Mitigation Checklist
**Sarvik · Coimbatore · Build with AI: Code for Communities**

**Submission deadline: 8 July 2026** · Demo Day: 23 July, New Delhi
**Working days left to submit: ~3 (5 → 8 Jul).** Triage hard. Protect the live path, cut everything else calmly.

Legend: **P0** = can lose you the whole thing · **P1** = credibility hit in Q&A · **P2** = content/code correctness.
Fill Owner + tick Done. Anything still open on 7 Jul → move to the Cut List.

---

## P0 — Existential (fix first, do not ship without these)

### R1 · Data moat — ✅ VERIFIED (5 Jul, 3 research agents)
- **Verdict:** Moat is REAL for the rural fringe, SYNTHETIC for urban wards (disclosed). See `data/ingestion/SOURCES.md`.
  - 🟢 Real & clean: **Jal Jeevan per-village taps (Excel export)**, Census town/village (data.gov.in free key), PM-Kisan; PMAY-G/MGNREGA/SBM-G/NSAP village-level via scrape; rural + municipal ward polygons (DataMeet/OpenCity).
  - 🔴 Not public: urban ward scheme coverage, CPGRAMS by district/ward, Census↔municipal ward crosswalk, NFHS below district → all modelled/synthesized.
- **Action:** Anchor hero on a real rural-fringe village (clean 3-way join). Present urban as modelled. Get the free data.gov.in API key.
- **Mitigation:**
  - [ ] Get ONE **real, defensible gap** for the hero example (real Census + real scheme MIS). Depth over breadth.
  - [ ] **Anchor the hero on a real Sulur/Madukkarai-block fringe village** (confirm exact panchayat name at data pull) where PMAY-G / Jal Jeevan village-level MIS is genuinely downloadable.
  - [ ] Urban wards → synthetic, but keep the **"synthetic, mapped to real geography" disclaimer visible** on screen, not buried.
- **Owner:** ______  **Done:** [ ]

### R2 · Live demo is a single point of failure
- **Risk:** Judge sends Tamil voice note → STT/translate/Gemini/geo chain must fire live on stage. Accent, network, or cold-start failure deflates the entire pitch.
- **Mitigation:**
  - [ ] Build a **silent fallback**: a pre-seeded record you can drop in so the story continues if the live call dies.
  - [ ] Pre-warm services before demo (no cold start). Record a **backup video** of the working flow.
  - [ ] Rehearse the exact voice note 5+ times on the real stage network.
- **Owner:** ______  **Done:** [ ]

### R3 · Scope > days left
- **Risk:** 12 steps, 5 screens, 3 languages, Telegram+web, letters, optimizer, satellite, mobile app — in ~3 days. Something gets cut at 2am on the 7th by accident instead of on purpose today.
- **Mitigation:**
  - [ ] **Protect only the live critical path:** intake (0–3) → X-Ray (screen 3) → forgotten village (screen 5) → auto-letter (9).
  - [ ] Commit to the **Cut List** below *today*. Decide before pressure decides for you.
- **Owner:** ______  **Done:** [ ]

---

## P1 — Credibility (will surface in judge Q&A)

### R4 · "It diagnoses — does anything actually happen?"
- **Risk:** Tool drafts a letter; real delivery is outside the system. Judge probes the gap between recommendation and action.
- **Mitigation:** [ ] Own the boundary out loud — "we're a **decision + accountability layer**: what was raised, who owns it, was it closed — not a magic delivery pipe." Have the sentence ready.
- **Owner:** ______  **Done:** [ ]

### R5 · "Where's the real AI?" (AI/Technical Execution = 25%)
- **Risk:** Core logic (gap math, priority, knapsack) is deterministic arithmetic. Judge may want more model muscle.
- **Mitigation:** [ ] Pre-load the defense: "**explainable over black-box** — government only deploys what it can audit." Point to the real ML parts (Gemini extraction + eligibility, embeddings clustering, RAG). Say it with confidence.
- **Owner:** ______  **Done:** [ ]

### R6 · Weights presented as objective
- **Risk:** `W1=.30, W2=.35…` framed as "objective." Someone chose .35. "Why?" has no answer.
- **Mitigation:** [ ] Reframe: weights are **tunable by the MP's office / district priorities**. System is objective about *inputs*; the office sets *values*. Show a "what if equity mattered more?" slider if time allows.
- **Owner:** ______  **Done:** [ ]

### R7 · Silent-village is the hero AND the most fake-able
- **Risk:** The mic-drop rests on a `need_score` you may have invented. Fragile under a probe.
- **Mitigation:** [ ] The hero village's `need_score` must come from **real Census + real scheme data**. Everything else can be synthetic; the hero cannot. (Same village as R1.)
- **Owner:** ______  **Done:** [ ]

---

## P2 — Content & code correctness (from the blueprint review)

### R8 · Coimbatore migration + urban/rural split as the hero feature (~25 spots)
- [ ] Name: every "Dharmapuri" → "Coimbatore"
- [ ] **Carry BOTH scheme sets** (this is the point of picking Coimbatore):
  - Urban core → **PMAY-U, AMRUT, NULM, SBM-U**
  - Rural fringe → **PMAY-G, Jal Jeevan, MGNREGA, SBM-G**
  - Routing rule keys off **is the ward urban or rural** → picks the right scheme.
- [ ] Place names: Vellampatti/Harur/Palacode → urban: **Perur, Ukkadam, Singanallur, Peelamedu, Selvapuram, Kuniyamuthur, Madampatti**; fringe: **Sulur / Madukkarai-block villages**
- [ ] Map unit: **ward-level** for urban core (~100 wards), **village-level** for fringe
- [ ] **Pitch the mix as the differentiator:** "Coimbatore is a city AND villages in one seat. Our AI routes an urban ward to AMRUT and a fringe village to Jal Jeevan — automatically. That's why it scales to any of India's 543 constituencies."
- **Owner:** ______  **Done:** [ ]

### R9 · Two contradicting score formulas
- **Risk:** Tab 2 = multiplicative (`Demand × Need × Feasibility + Equity`); Step 7 = additive (`ΣW·factor × Scheme_Deduction`).
- **Mitigation:** [ ] Keep the **Step 7 additive-weighted** version; rewrite Tab 2 to match.
- **Owner:** ______  **Done:** [ ]

### R10 · LGD village_code join key breaks for urban wards
- **Risk:** LGD codes are village/panchayat IDs; Coimbatore Corporation wards use ULB ward codes. "Everything hangs off lgd_village_code" is rural-only.
- **Mitigation:** [ ] Document a **mixed join key**: ward code for the city, LGD code for fringe villages. Update Tabs 5/6/7 language.
- **Owner:** ______  **Done:** [ ]

### R11 · Silent-score divide-by-zero
- **Risk:** `need_score × (1/log(petition_count+1))` → `log(1)=0` → ÷0 at zero petitions.
- **Mitigation:** [ ] Change to `1/log(petition_count+2)` (or clamp). Fix formula in doc + code.
- **Owner:** ______  **Done:** [ ]

### R12 · Demo clock over budget + stray scope
- [ ] Demo timings sum to **5:20** — trim 20–30s to fit 5:00.
- [ ] **Cut React Native** citizen app (dead weight; judges score one flow). Remove from stack + scope.
- [ ] Footer link `track1-build-plan.md` — confirm it exists or drop it.
- [ ] Demo Tamil + English; **claim** Hindi as scalability (don't build/test 3rd language under pressure).
- **Owner:** ______  **Done:** [ ]

---

## Cut List — if time runs out (decide NOW, in this order)
Cut top-down. Each line is pre-approved to drop without breaking the core story.
1. React Native mobile app (cut regardless — see R12)
2. Hindi language (keep as claim only)
3. Satellite / Earth Engine hero imagery
4. Budget optimizer (OR-Tools) → replace with a hardcoded ₹5 cr plan
5. Anti-lobbying down-weighting
6. Close-the-loop notification (step 11)
7. Auto-letter live generation → pre-generated sample PDF

**Never cut:** live intake (0–3) · Constituency X-Ray (screen 3) · forgotten village (screen 5) · the one real hero example.

---

## Demo-day safety (final rehearsal, 7 Jul)
- [ ] Backup video of full working flow (in case live dies)
- [ ] Services pre-warmed, no cold starts
- [ ] Synthetic-data disclaimer visible on screen
- [ ] All figures on screen are computable/real or labelled illustrative
- [ ] Q&A defenses rehearsed: R4 (diagnosis→action), R5 (why deterministic), R6 (weights tunable)
- [ ] 5-minute run timed end-to-end, under 5:00

---

## The 3 that actually decide it
If you only have energy for three things: **R1 (one real gap), R3 (protect the live path), R2 (demo fallback).** Everything else is polish.
