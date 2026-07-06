# QA + UX Review — Sarvik AI (MP Constituency Console)

Reviewer: Senior QA + UX. Mode: read-only code review + live API testing.
Live base: `https://build-with-ai-constutency-eeh5tlwcfa-el.a.run.app`
Date: 2026-07-05

## Method
- Read every screen in `frontend/src/screens/*.tsx`, `components/Layout.tsx`, and shared components/libs.
- Hit all 8 GET endpoints + POST `/api/intake`, `/api/ask`, `/api/letter/*` with curl. Verified 200, non-empty, duplicate-free, and sane values.

## Live API results
| Endpoint | Status | Notes |
|---|---|---|
| GET /health | 200 | ok |
| GET /api/stats | 200 | complaints 300, owed ₹1,619 cr, 33 silent, 237 villages |
| GET /api/demands | 200 | no dup ids |
| GET /api/scheme-gaps | 200 | 100 rows, all `(area_id,scheme)` unique |
| GET /api/ranked-projects | 200 | 295 rows, 49/50 unique titles; **291 Track A, only 4 Track B**; `estimated_cost` null on all 291 Track A |
| GET /api/silent-villages | 200 | 33 rows unique; **petition_count = 0 on every row, every row flagged** |
| GET /api/unified-issues | 200 | 100 rows unique ids |
| GET /api/departments | 200 | 7 depts, no dups |
| POST /api/intake | 200 | classified English text as `language:"ta"` (wrong) |
| **POST /api/letter/department** | **404** | route not on live revision |
| **POST /api/letter/item** | **404** | route not on live revision |
| **POST /api/ask** | **404** | ask router never registered |

No duplicate rows found in any list endpoint. Good.

---

## P0 — Blockers

### P0-1 · The Act screen's core action is dead in production
`POST /api/letter/department` and `POST /api/letter/item` both return **404** on the live backend. In `frontend/src/screens/Act.tsx` the primary CTAs — "Generate letter to {dept}" (`openDeptLetter`) and "Why eligible" (`openItemLetter`) — call these via `api.letterDepartment` / `api.letterItem` (`frontend/src/api.ts:106-124`). Every click opens the modal, then falls into the error branch ("Could not generate letter"). The letter routes exist locally (`backend/app/letters/routes.py`, registered `backend/app/main.py:45`) but the deployed Cloud Run revision predates them — **deployment drift**.
**Fix:** Redeploy the backend so the live revision includes `letter_routes`. Verify with `curl -X POST .../api/letter/item -d @payload`. Confirm `frontend` `VITE_API_URL` targets that revision. This is the flagship "unlock what's owed" flow — it must work before any demo.

---

## P1 — Important

### P1-1 · "Ask Sarvik" screen is orphaned AND its endpoint 404s
`frontend/src/screens/AskSarvik.tsx` is fully built and routed at `/ask` (`router.tsx:27`) but has **no sidebar entry** in `Layout.tsx` `NAV` — unreachable except by typing the URL. Worse, it POSTs to `/api/ask`, which returns 404 because the ask router is **never included** in `backend/app/main.py` (only intake/closeloop/api/letters/webhook are). So even if reached, every question errors.
**Fix:** Decide — ship it (register `ask_routes` in `main.py`, redeploy, add a nav item) or remove the `/ask` route from `router.tsx` and delete the screen so there is no hidden broken surface.

### P1-2 · Two visible top-bar controls do nothing (trust killer)
In `Layout.tsx`: (a) the global **search box** feeds `OutletContext.search`, but **no screen consumes `useOutletContext`** (verified — zero references), so typing does nothing. (b) The **language toggle** (EN / தமிழ் / हिन्दी) updates local `lang` state that is never passed to any API or content. An MP will click these, see nothing happen, and distrust the product.
**Fix:** Either wire them (global search → filter/route; language → pass to intake/content and persist) or remove them. Dead primary-chrome controls read as broken.

### P1-3 · Intake misclassifies obvious English as Tamil
`POST /api/intake text="No water in Peelamedu for 3 days"` → `language:"ta"`. On `ScanPetition.tsx` the extracted-record card shows this language chip; a judge submitting plain English and seeing "Tamil" undermines the "the AI reads it correctly" claim (category `water`, place `Peelamedu`, urgency `high` were all correct, so the miss is glaring).
**Fix:** Backend language detection should trust script/heuristics before defaulting; at minimum don't label Latin-script English as `ta`. Consider showing detected-language confidence.

---

## P2 — Polish

### P2-1 · Forgotten Villages looks broken/monotone
`ForgottenVillages.tsx` renders a sortable **Petitions** column, but `petition_count = 0` for every row, so that sort is a no-op; and every row is "Flagged" (the `Watch` chip branch at line 103 is dead code). The table reads as static/dummy.
**Fix:** Drop or de-emphasize the Petitions column, add real variance (e.g. show `need_score` bars, distance/last-contact), or surface why each is silent. Give the MP a reason to believe these 33 are real.

### P2-2 · `estimated_cost` null on all 291 Track A projects
`Priorities.tsx:147` only renders cost when non-null, so cost never appears there; only the 4 Track B rows have a rupee figure. Track B "₹5 Cr cart" (`Act.tsx`) therefore has just **4 candidates** totalling ~₹5.26 cr — the "optimiser picks the best mix within ₹5 Cr" story is thin (barely a knapsack). 
**Fix:** Populate `estimated_cost` for more works, or reframe Track B copy so 4 items doesn't feel like a stub.

### P2-3 · Client department taxonomy diverges from backend
`lib/departments.ts` `SCHEME_TO_DEPT` derives names like "Jal Shakti · Water Supply", "Housing & Urban Affairs" — but the live API uses "Water — TWAD/CMWSSB", "Housing", etc. Today the endpoint works so `departmentFor` returns the explicit backend name and the mismatch is hidden; if `/api/departments` ever 404s, the derived-fallback view (`loadDepartments`) will show a **different, inconsistent set of department names** than every other screen.
**Fix:** Align the fallback map to the backend's canonical department labels.

### P2-4 · Dead / decorative controls
- Sidebar **Sign out** button (`Layout.tsx:176`) has no `onClick` — a no-op.
- Dashboard "By department" cards link to `/departments#<slug>` (`Dashboard.tsx:190`); React Router does not auto-scroll to a hash, so the anchor does nothing on navigation. Add a scroll-to-hash effect on the Departments screen or drop the anchor.

### P2-5 · Provenance honesty on Dashboard
Dashboard labels "Complaints processed" as `synthetic` (correct, honest) but the hero "₹ already owed" and supporting stats sit above a small data-note. Good transparency overall; consider making the synthetic-data note more prominent so an MP isn't surprised the complaints aren't live.

### P2-6 · Map/area id format skew (latent)
`silent-villages` area ids are zero-padded (`V-030`, `V-119`) while `scheme-gaps`/geo files use `V-10`, `W-17`. `AreaMap.aggregate` silently skips areas whose id isn't in `AREA_COORDS`. Not currently on the same screen, but any future join across these will drop rows. Normalise id formats server-side.

---

## What is genuinely strong (keep)
- Consistent loading/empty/error handling via `useFetch` + `StateBlock` on every list screen.
- No duplicate rows in any endpoint; dedup/unified-issues story is real (100 clusters).
- Real Google-Maps heatmap with graceful grid fallback and error boundary (`AreaMap.tsx`).
- Provenance chips (real/synthetic/computed/modelled) are a credible, honest touch for MP trust.
- Budget guard in Track B (over-budget block, greedy density selection) is a nice, correct interaction — once cost data is richer.

## Recommended fix order
1. P0-1 redeploy backend (letters) — without it the demo's headline feature fails.
2. P1-1 / P1-2 remove or wire the three dead surfaces (Ask, global search, language).
3. P1-3 intake language.
4. P2 polish for depth and trust.
