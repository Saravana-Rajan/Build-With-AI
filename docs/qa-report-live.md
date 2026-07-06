# Sarvik — Live Deployment QA Report

- **Frontend:** https://sarvik.web.app
- **Backend:** https://build-with-ai-constutency-eeh5tlwcfa-el.a.run.app
- **Method:** Playwright browser automation (every page + flow) + curl against live backend + source review.
- **Date:** 2026-07-05

## Verdict at a glance

| Flow | Live status |
|------|-------------|
| Dashboard (KPIs, dept cards, chart) | ✅ Renders, no NaN/empty |
| Ask Sarvik chatbot | ✅ Real grounded answer ("Housing … ₹632.50 crore") |
| Intake list / pagination / search | ✅ Works (270 demands, 18 pages) |
| Priorities verdict badges | ✅ "Likely served" / "Act · genuine gap" + score breakdown |
| Constituency X-Ray **map** | ❌ **BLANK — Google Maps auth error (P0)** |
| X-Ray ₹ hero / gaps list / chart | ✅ All render |
| Departments central-scheme badges | ✅ ★ badges per dept |
| Act — Track A letter preview + Send | ✅ Modal opens, "Sent to department" success |
| Act — Track B cart | ✅ No duplicate rows, budget guard + total correct |
| Scan Petition upload UI | ✅ Dropzone + submit gating |
| Header language toggle | ❌ **Dead control (P1)** |
| Header global search | ❌ **Dead control (P1)** |

Backend: `/health`, `/api/stats`, `/api/departments`, `/api/ranked-projects`, `/api/silent-villages`, `/api/unified-issues` all **200** with sane payloads. `POST /api/ask` → real answer. `POST /api/letter/department {"department":"Health"}` → full formatted letter. `POST /api/intake` is **multipart form-data** (fields `text`/`file`, `language`, `source`) — returns structured record + citizen ack. (A JSON body returns 400 by design.) Note: `/api/stats` cold-start latency was ~5.7s on first hit.

---

## P0 — Must fix before any MP demo

### P0-1 · Google Map does not render on live X-Ray (blank "Oops!" box)
- **Evidence:** Console on https://sarvik.web.app/x-ray →
  `Google Maps JavaScript API error: RefererNotAllowedMapError … Your site URL to be authorized: https://sarvik.web.app/x-ray`. The hero map shows *"Oops! Something went wrong. This page didn't load Google Maps correctly."*
- **Root cause:** The Maps JS API key's HTTP-referrer allowlist in Google Cloud Console does **not** include `https://sarvik.web.app/*`. The key itself is present (`frontend/.env:2`, `VITE_MAPS_API_KEY`).
- **Secondary code bug:** `frontend/src/components/AreaMap.tsx:331` relies on `<APIProvider onError={() => setFailed(true)}>` to fall back to the grid. Google's auth failure (`RefererNotAllowedMapError`) does **not** trigger `onError` and is **not** thrown, so the `MapErrorBoundary`/`MapPlaceholder` fallback (line 297-302) never activates — the user is stuck on the broken map until they manually click "Grid".
- **Fix (two parts):**
  1. **Config (real fix):** In GCP → Credentials → the Maps key → Application restrictions → HTTP referrers, add `https://sarvik.web.app/*` (and `https://sarvik.firebaseapp.com/*`). Map will then render.
  2. **Resilience (`AreaMap.tsx`, near line 291):** register Google's auth hook so the grid fallback engages automatically:
     ```ts
     useEffect(() => {
       (window as any).gm_authFailure = () => setFailed(true);
       return () => { delete (window as any).gm_authFailure; };
     }, []);
     ```
     Optionally default `view` to `"grid"` until the map confirms it loaded.

---

## P1 — Embarrassing, fix before judging

### P1-1 · Header language toggle (EN / தமிழ் / हिन्दी) is a dead control
- **Evidence:** Clicking தமிழ்/हिन्दी only changes the pressed button; no UI text or data changes on any page. In a trilingual constituency this is the first thing an MP will try.
- **Root cause:** `frontend/src/components/Layout.tsx:354` — `<Outlet context={{ search }} />` passes **only `search`**; the `lang` state (`Layout.tsx:322`) is consumed solely by the Topbar for `aria-pressed` styling (`Layout.tsx:296`). No screen receives or acts on `lang`; there is no i18n dictionary.
- **Fix:** Either (a) wire `lang` into the Outlet context and translate visible copy / pass it as the default language to Scan + Intake, or (b) if out of scope for the demo, remove the toggle so it doesn't advertise a non-feature.

### P1-2 · Header global search box is a dead control
- **Evidence:** The top-bar search (focusable via `/`) accepts text but filters nothing anywhere. Per-page searches (Intake, Departments, X-Ray gaps) work — but the prominent global one does not.
- **Root cause:** `Layout.tsx:354` passes `search` through Outlet context, but **no screen calls `useOutletContext`** (`grep useOutletContext frontend/src/screens` → 0 hits). State is set and thrown away.
- **Fix:** Consume the context in the list screens (Dashboard/Intake/Departments) to filter, or remove the header search and keep the per-page ones.

---

## P2 — Polish / correctness

### P2-1 · Departments "Top areas · ₹ owed" list is not sorted by ₹
- **Evidence:** Under *Sanitation/Municipal* the list reads Chickadasampalayam ₹11 Cr, Marchinaickenpalayam ₹6.3 Cr, Vadavalli ₹8.9 Cr, Ramanathapuram ₹6.0 Cr, **Jadayampalayam ₹14 Cr** (largest shown, listed last). Housing similarly lists ₹42 Cr second. The label promises ₹-descending order.
- **Root cause:** `frontend/src/screens/Departments.tsx:307` renders `d.top_areas` in backend order; the ₹ value (`areaValue`, line 312) is looked up per-item but never used to sort.
- **Fix:** sort before render, e.g. `[...d.top_areas].sort((a,b) => (areaValue.get(b)??0) - (areaValue.get(a)??0))`, or relabel to "Top areas · by issue count".

### P2-2 · Priorities verdicts mention "nearby" but no distance (km)
- **Evidence:** Genuine-gap verdicts read *"no treated-water supply on record in X or any mapped area nearby"* — the spec's "+ km to nearest served area" is not surfaced.
- **Fix:** include the computed nearest-served distance in the justification string if the backend has it; otherwise drop the "nearby" claim to avoid implying a measured radius.

### P2-3 · Maps API key committed to the repo
- **Evidence:** `frontend/.env:2` contains a live `VITE_MAPS_API_KEY` and `.env` is tracked. A Vite client key is necessarily public, but it must be referrer-locked (see P0-1) and ideally not committed.
- **Fix:** rely on `.env.example` only; keep `.env` git-ignored; ensure the key is HTTP-referrer + API restricted in GCP.

---

## Do the three headline flows work live?
- **Map:** ❌ No — blank with a Google auth error until you manually switch to Grid (P0-1).
- **Chatbot (Ask Sarvik):** ✅ Yes — returns a real, data-grounded answer live.
- **Letter (Act Track A):** ✅ Yes — generates a full formatted preview and shows a "Sent to department" success state live.
