# Sarvik — Module Guide (what each screen actually shows)

Plain-language walkthrough of every screen: what you see on it, what each part means, and what you do there.

---

## 1. Dashboard (Overview) — `/`
**Purpose:** your home. One glance = the whole constituency + your decisions.

**What's on the screen:**
- **Greeting:** "Good morning, MP Office · Coimbatore. Your decisions start here."
- **Hero — "Already owed to your people · unclaimed entitlements: ₹1,619 crore":** the total money your constituents are entitled to under government schemes but haven't received. *This is the headline number.*
- **Two-floor strip:** "Floor 1 — consolidate & rank / Floor 2 — unlock what's owed. Spend ₹0 before your ₹5 cr." = how the product works in one line.
- **Department cards:** Housing ₹633 cr, Sanitation ₹307 cr, Health ₹249 cr… each shows how much that department owes + how many issues. Click → that department.
- **Top priorities:** the highest-ranked projects right now, with a 0–100 score.
- **"Villages that never asked":** a callout to the silent, high-need areas.
- **Provenance chips:** "real / synthetic / computed" — honesty about where each number comes from.

**What you do here:** get the big picture, then click into whichever number matters.
**In one line:** "₹1,619 crore is owed to my people — here's who owes it."

---

## 2. Intake — `/intake`
**Purpose:** every citizen complaint, cleaned and sorted.

**What's on the screen:**
- **"270 demands" + a search box:** filter by place, category, or channel.
- **A feed of complaint cards.** Each card shows:
  - **Language chip** (EN / TA) — the language the citizen used.
  - **Category chip** (Water, Road, Housing…) — auto-detected by AI.
  - **Channel chip** (Web, Phone, Meeting, Telegram) — how it arrived.
  - **The complaint text** (e.g. "Siruvani level crashed — Saravanampatti now gets water once a week").
  - **Place · urban/rural** on the right.
- **"Synthetic / Live" tags** at the top = honesty about data source.

**What you do here:** see the raw voice of citizens; staff triage from here.
**In one line:** "Every complaint, any channel, any language — one clean list."

---

## 3. Priorities — `/priorities`
**Purpose:** turn hundreds of complaints into a ranked, justified to-do list.

**What's on the screen:**
- **"300 raw → 79 issues, duplicates merged":** how many raw complaints collapsed into real issues.
- **Score distribution spark:** a mini bar chart of how scores spread.
- **Ranked list.** Each row:
  - **Rank number** (1, 2, 3…).
  - **Project title** + **Track A/B** chip.
  - **Place · category.**
  - **"Why this matters":** the AI's reason — *"genuine gap · ~15 km"* (act) or *"likely served · ~4 km"* (skip).
  - **Factor chips:** Need 35, Feasibility 16, Equity 15 — how the score was built.
  - **Score (0–100)** on the right.
  - **Click a row → the actual citizen complaints behind it.**

**What you do here:** decide what's worth acting on — with the AI's justification.
**In one line:** "Real issues, ranked, each with a reason — and the complaints behind them."

---

## 4. Constituency X-Ray — `/x-ray`
**Purpose:** see, on a map, where scheme money is failing to land.

**What's on the screen:**
- **Hero: "₹1,619 crore entitlements owed":** same headline, spatial view.
- **Google Map** (Map / Grid toggle): every ward/village colored by gap — red = biggest gap, green = well covered. Click an area for detail.
- **"Biggest gaps" list:** each area with its scheme (PMAY-U, NHM…), coverage (e.g. "1,060 / 2,425 covered"), a **real/modelled** tag, and ₹ owed. Click a row → the complaints for that area.
- **"Top gaps by ₹" bar chart** at the bottom.

**What you do here:** spot the worst-served areas at a glance.
**In one line:** "The X-ray of your constituency — where the money is stuck, on a map."

---

## 5. Departments — `/departments`
**Purpose:** the same money, grouped by who is accountable.

**What's on the screen:**
- **One panel per department** (sorted by ₹ owed): Housing, Sanitation, Health…
  - **Big ₹ owed** + **issue count.**
  - **★ Central schemes to push:** highlighted badges — PMAY-G/U (Housing), NHM (Health), Jal Jeevan/AMRUT (Water) — with the responsible ministry.
  - **Top areas** with per-area ₹ (click → complaints).
  - **A share bar** (that dept's % of total owed) + a "Send letter →" action.

**What you do here:** know exactly which department to pressure, under which scheme.
**In one line:** "Whose job is it — your meeting agenda with each department."

---

## 6. Act — `/act`
**Purpose:** turn priorities into action. Two tracks.

**What's on the screen:**
- **Two tabs: "Track A · Letters" and "Track B · ₹5 Cr cart".**
- **Track A** — collapsible cards, one per department. Expand → summary of that dept's owed items → **"Generate letter to {Dept}"** → a **letter preview** opens → **"Send to department"** (marks Sent ✓). This unlocks entitlements for **₹0** of your fund.
- **Track B** — the needs **no scheme covers** (mostly local roads). An **MPLADS ₹5 crore cart**: pick works, see the running total + a budget guard, and the AI's recommended mix (most people helped).

**What you do here:** send the letters (₹0) and allocate your ₹5 crore only on true gaps.
**In one line:** "Unlock what's owed for ₹0; spend your ₹5 crore only on what's left."

---

## 7. Forgotten Villages — `/forgotten`
**Purpose:** find the people who never complain.

**What's on the screen:**
- **A table** of areas with: **Need score** (high), **Petitions** (0), **Silent score**, and a **"Flagged"** tag.
- Sortable columns; a count of how many are flagged.

**What you do here:** reach high-need areas that sent zero complaints — the silent majority.
**In one line:** "The people no one else reaches, because they never asked."

---

## 8. Scan Petition — `/scan`
**Purpose:** the real front desk — turn a paper letter or voice note into data.

**What's on the screen:**
- **A drop zone:** "Drop a file — photo, PDF, or voice note."
- **A language selector** (Tamil / English).
- **"Submit petition"** → "AI is reading…" → the **extracted record**: category, place, scheme, Track A/B, beneficiaries, plus **what the AI read** (transcript).

**What you do here:** demo the live "paper → structured record" moment.
**In one line:** "Photograph a petition — the AI reads it and files it instantly."

---

## 9. Ask Sarvik — `/ask`
**Purpose:** ask questions about your data in plain language.

**What's on the screen:**
- **A chat box** + suggested questions ("Which department owes the most?", "Top forgotten villages?").
- **Answers** grounded in your real data, with ₹ figures highlighted, and **clickable chips** ("View Departments →") that jump to the relevant screen.

**What you do here:** ask anything; get an instant, sourced answer.
**In one line:** "Ask your constituency anything — answered from real data in seconds."

---

## The flow in one breath
Complaints come in (**Intake**) → deduped & ranked with reasons (**Priorities**) → seen on a map (**X-Ray**) → sorted by department (**Departments**) → acted on (**Act**: ₹0 letters + ₹5 cr) → and the silent are surfaced (**Forgotten Villages**). **Dashboard** ties it together; **Scan** and **Ask Sarvik** are the live-wow moments.
