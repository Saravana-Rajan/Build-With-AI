# Pitch Deck Outline — Sarvik (Track 1)

Audience: government / MP office. Tone: honest, no fabricated impact numbers. 12 slides, one paragraph + suggested visual each.

---

### Slide 1 — Title / Frame
Sarvik. Demo constituency: Coimbatore. The one line that frames everything: "We don't help an MP spend ₹5 crore. We help unlock the hundreds of crores already owed to their people — and spend the ₹5 crore only on gaps nothing else covers." Track 1 submission.
*Visual:* Product name over the Constituency X-Ray dashboard hero, "₹463 crore owed to Coimbatore" faint in the background.

### Slide 2 — The problem
An MP's discretionary MPLADS fund is about ₹5 crore a year — tiny against a constituency's needs. Meanwhile, far larger sums their constituents are already entitled to, under central and state schemes, never arrive. The system optimises the wrong number: it fusses over the ₹5 crore and ignores the crores already owed.
*Visual:* Two bars side by side — a small ₹5 cr bar vs a much larger "owed under existing schemes" bar.

### Slide 3 — The sharper problem
The money is unclaimed because no one connects an individual complaint to the specific scheme that owes it. Grievances arrive by voice, paper, and photo, in Tamil, Hindi and English; the loudest wards dominate; the neediest, quietest villages are invisible. The bottleneck isn't funding — it's translation from "citizen problem" to "scheme entitlement."
*Visual:* A messy funnel of mixed-language, mixed-format complaints, with most falling on the floor and the neediest village greyed out.

### Slide 4 — Solution: a two-floor model
Floor 1 (required basics): capture every complaint, dedupe it, locate it, route it to the right scheme, and generate the letter that unlocks the owed money. Floor 2 (differentiator): quantify what's owed, find the forgotten villages, and spend the ₹5 crore only on gaps no scheme covers. Basics done well; the differentiator is unlocking, not spending.
*Visual:* Two stacked floors — "Floor 1: Unlock what's owed" over "Floor 2: Spend ₹5cr on the gaps."

### Slide 5 — How it works (pipeline)
Intake → geo-resolution → scheme routing → deduplication → gap-math → priority scoring → two-track action → close-the-loop. Each stage is a working component, not a mock. The pipeline turns raw, multilingual, multimodal grievances into ranked, priced, actionable entitlements with an audit trail.
*Visual:* Left-to-right pipeline diagram with the eight stages, GCP icons under each.

### Slide 6 — Multimodal intake + deduplication
Citizens send voice, photo, PDF or text in Tamil, Hindi or English; Gemini 2.5-flash transcribes, translates, and extracts the issue, then geo-resolves it to a Coimbatore ward or village. Deduplication collapsed 300 raw complaints into 245 unified issues across languages, and flags suspiciously identical bursts as coordinated campaigns so they can't game priority.
*Visual:* Three input chips (voice/photo/PDF) merging into one unified issue card; a "coordinated campaign" flag badge.

### Slide 7 — Constituency X-Ray + real data
The headline: ₹463 crore owed-but-undelivered to Coimbatore, of which ₹308 crore is computed directly from real Census 2011 amenity gaps across 237 villages. This is gap-math against what schemes are obligated to deliver — a defensible figure, not a projection. Data honesty stated plainly: citizen complaints are synthetic for privacy but mapped to real geography; rural gap math uses the real village MIS; urban ward scheme coverage is modelled — every source is labelled on screen.
*Visual:* The X-Ray hero with ₹463cr, a breakout callout "₹308cr from real Census 2011 · 237 villages," and a small data-source legend.

### Slide 8 — Silent-village detection
A normal grievance system serves whoever complains loudest. We invert it: silent-village detection surfaces the 24 Coimbatore villages with the highest need and almost no petitions. The top case — Jaganarai Slopes R.F., need score 1.0, zero petitions — would be invisible anywhere else. This is the equity mechanism: attention allocated by need, not by volume.
*Visual:* Map of Coimbatore with 24 pins; the top pin exploded into a card: "Jaganarai Slopes R.F. — need 1.0 — 0 petitions."

### Slide 9 — Two-track action
Track 1, Unlock: one click turns a top issue into a Gemini-drafted department letter citing the scheme and entitlement, exported as PDF — a demand for money already owed. Track 2, Spend well: an OR-Tools optimiser allocates the ₹5 crore MPLADS budget across only the gaps no scheme covers, using transparent priority scores. Then a Telegram message closes the loop with the citizen who reported it.
*Visual:* Split screen — left, a generated PDF letter; right, the optimiser's ₹5cr allocation; a Telegram "resolved" bubble below.

### Slide 10 — Deployability & scale
It runs today on real Coimbatore geography and is constituency-agnostic — swap the geography and Census data and it works elsewhere. Built cloud-native on managed GCP services (Cloud Run, BigQuery, Firestore) so it scales without re-architecting, and the Telegram bot means zero app install for citizens.
*Visual:* "Coimbatore today → any constituency" arrow over a stack of GCP service logos.

### Slide 11 — Tech stack
GCP throughout: Vertex AI / Gemini 2.5-flash for multimodal understanding and drafting, BigQuery for the Census and issue analytics, Firestore for live state, Cloud Run for serverless services, Maps for geo-resolution. FastAPI backend, React dashboard (six screens including the Constituency X-Ray hero and Scan Petition), plus a Telegram live-intake bot. OR-Tools for optimisation.
*Visual:* Layered architecture diagram — clients (React + Telegram) → FastAPI on Cloud Run → Gemini/BigQuery/Firestore/Maps/OR-Tools.

### Slide 12 — Impact & the ask
Honest framing, no invented numbers: the mechanism is proven end-to-end on real Coimbatore data — ₹463 crore surfaced as owed, 24 forgotten villages named, letters and allocations generated. The realistic impact is unlocking entitlements that already exist and directing scarce discretionary funds to true gaps. Ask: a pilot with one MP office to validate unlocked rupees against real departmental data.
*Visual:* Recap triptych (₹463cr owed · 24 silent villages · two-track action) with a single call to action: "Pilot with one constituency."
