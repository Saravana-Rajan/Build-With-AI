# Demo Script — Sarvik (Track 1)

**Demo constituency:** Coimbatore · **Runtime:** 5 minutes · **Presenters:** 1 driver + 1 narrator

> One-line frame (say it first): *"We don't help an MP spend ₹5 crore. We help unlock the hundreds of crores already owed to their people — and spend the ₹5 crore only on gaps nothing else covers."*

---

## Timed beats

### 0:00–0:30 — Hook
- On screen: the **Constituency X-Ray** dashboard, Coimbatore selected.
- Say: "An MP has an MPLADS fund of ₹5 crore a year. Meanwhile hundreds of crores their people are already entitled to — under AMRUT, Jal Jeevan, PMAY — never reach them, because nobody connects the complaint to the scheme that owes the money. That's the problem we solve."

### 0:30–1:30 — Live intake (judge participates)
- Say: "Intake is multimodal — voice, photo, PDF or text, in Tamil, Hindi or English. Please send one now."
- **Invite a judge** to send the live-intake **Telegram bot** a message — e.g. a voice note in Tamil "தண்ணீர் வரவில்லை" (no water) or a photo of a broken road.
- On screen: message lands in **Scan Petition**; Gemini 2.5-flash transcribes/translates, extracts the issue, and **geo-resolves it to a Coimbatore ward or village**.
- Say: "That just got classified, located, and routed to the right scheme automatically — urban water goes to AMRUT, rural water to Jal Jeevan, housing to PMAY-U or PMAY-G."

### 1:30–2:15 — Deduplication
- On screen: the dedup view — **300 raw complaints → 245 unified issues**, cross-language clusters merged.
- Say: "Ten people reporting the same broken pipe in three languages is one issue, not ten. And when a burst of complaints is suspiciously identical, we flag it as a **coordinated campaign** so it can't game the priority list."

### 2:15–3:15 — X-Ray: the ₹463 crore
- On screen: the **owed-but-undelivered** headline — **₹463 crore**, of which **₹308 crore is computed from real Census 2011 amenity gaps across 237 Coimbatore villages**.
- Say: "This is gap-math, not a guess. We take real village amenity data, compare it to what central and state schemes are supposed to deliver, and price the shortfall. ₹463 crore is already owed to Coimbatore — before the MP spends a rupee."
- Note honestly: "Citizen complaints here are synthetic for privacy, mapped onto real geography. The rural gap math uses the real Census village MIS; urban ward scheme coverage is modelled. We label every source on screen."

### 3:15–3:50 — The forgotten village (mic-drop)
- On screen: **Silent-village detection — 24 villages flagged.** Open the top one: **Jaganarai Slopes R.F., need score 1.0, zero petitions filed.**
- Say: "The loudest wards get attention. These 24 villages have the highest need and have filed **almost no complaints** — so they're invisible to a normal grievance system. We surface them. Jaganarai Slopes has maximum need and not a single petition. Without this, it stays forgotten."

### 3:50–4:40 — Two-track action
- **Track 1 — Unlock (the hundreds of crores):** click a top issue → Gemini **auto-drafts a department letter** citing the scheme and entitlement → export **PDF**. Say: "One click turns an issue into an official letter to the right department demanding the money that's already owed."
- **Track 2 — Spend the ₹5 crore well:** open the **OR-Tools optimiser** → it allocates the ₹5 crore MPLADS budget across the **gaps no existing scheme covers**, using transparent priority scores. Say: "The fund is spent only where nothing else will pay."
- **Close the loop:** show the **Telegram notify** back to the citizen. Say: "The person who reported it gets told what happened."

### 4:40–5:00 — Close
- Say: "Built on GCP — Gemini and Vertex, BigQuery, Firestore, Cloud Run, Maps — with FastAPI and React. It runs on real Coimbatore geography today and drops into any constituency. We're not asking an MP to do more with ₹5 crore. We're unlocking the hundreds of crores already owed — and making the ₹5 crore count. Thank you."

---

## Fallback plan (if the live call fails)

**Trigger:** Telegram bot doesn't respond within ~10 seconds, no network, or judge declines.

1. **Don't wait — narrate over it.** Say: "Networks at demos are unreliable — here's the same flow pre-captured," and switch to the backup.
2. **Pre-recorded intake:** play a 15-second screen recording of a Tamil voice note + a road photo being ingested, transcribed, geo-resolved, and scheme-routed. Keep this file loaded in a browser tab before the demo.
3. **Seeded example:** the system already holds the 300→245 processed issues, so **skip straight to Scan Petition** and open a pre-loaded petition to show classification, geo-resolution and routing on real data.
4. **Everything downstream is local/seeded** — dedup, X-Ray ₹463cr, the 24 silent villages, letter-drafting, and the OR-Tools optimiser all run on already-ingested data and **do not depend on the live call**. The demo loses nothing but the audience-participation moment.

**Pre-demo checklist:** bot online and pinged once; backup recording tab open; Coimbatore pre-selected on the X-Ray; one petition pre-loaded in Scan Petition; PDF export tested once; laptop on a personal hotspot as network backup.
