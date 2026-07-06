# Sarvik — Live QA Report

- **Date:** 2026-07-06
- **Frontend:** https://sarvik.web.app
- **Backend:** https://build-with-ai-constutency-eeh5tlwcfa-el.a.run.app
- **Viewport:** 1440×900 · **Screenshots:** `qa-screenshots/`
- **Method:** Playwright, full-page capture + console-error check per route.

## Verdict summary

| Page | Route | Verdict | Console |
|------|-------|---------|---------|
| Dashboard | `/` | Works | 0 errors |
| Ask Sarvik | `/ask` | Works — chatbot answered correctly | 0 errors |
| Intake | `/intake` | Works — real Coimbatore geography | 0 errors |
| Priorities | `/priorities` | Works — verdicts present, **km missing** | 0 errors |
| X-Ray | `/x-ray` | Works via grid fallback — **map fails** | **1 error** |
| Departments | `/departments` | Works — scheme highlight badges | 0 errors |
| Act | `/act` | Works — letter preview + Track B deduped | 0 errors |
| Forgotten | `/forgotten` | Works | 0 errors |
| Scan | `/scan` | Works (upload UI only; not exercised) | 0 errors |

## Fixes verified live

- No dead search box / language toggle in the top header. ✅
- No notification chip and no `office@sarvik.local` email; sidebar shows a clean "MP Office · Coimbatore" identity with Sign out. ✅
- Real sparkle logo renders in sidebar + breadcrumb. ✅
- Ask chatbot answers from data: "Housing owes the most, ₹632.50 crore." ✅
- Act Track A letters generate a full preview (Ref No., addressee, NHM scheme, ₹ owed, area annexure) with an enabled "Send to department" button. ✅ (Send not clicked — real-world action out of scope.)
- Act Track B deduped: 13 unique works, budget guard flags "exceeds budget" and disables over-budget rows. ✅
- Departments central-scheme highlight badges ("★ Central schemes to push", PMAY-G/U, SBM-G/U, NHM, etc.). ✅
- Priorities "why this matters" verdicts present ("Likely already served…", "Genuine gap — no treated-water supply on record… or any mapped area nearby"). ✅ (km distance not shown — see P2.)

## Issues (prioritized)

### P0 — none
No blocking failures. Every route loads and renders usable content.

### P1

1. **X-Ray Google Map does not render (referer restriction).**
   Console on `/x-ray`: `Google Maps JavaScript API error: RefererNotAllowedMapError` — "Your site URL to be authorized: https://sarvik.web.app/x-ray". The API key's HTTP-referrer allowlist does not include the Firebase Hosting domain, so the interactive map never loads and the app falls back to the grid heatmap.
   - **Impact:** The grid fallback is clean (no broken "Oops"), so the page is usable, but the headline map feature is silently degraded on the live domain.
   - **Fix:** In Google Cloud Console → Credentials → the Maps JS API key → Application restrictions → HTTP referrers, add `https://sarvik.web.app/*` (and `https://sarvik.firebaseapp.com/*`). No code change required.

### P2

2. **Priorities verdict omits the "km" distance.**
   The spec calls for the "why this matters" verdict to include a distance (e.g. "nearest treated-water supply X km away"). Current copy says "…or any mapped area nearby" with no kilometre figure.
   - **Fix:** Surface the computed nearest-coverage distance in the verdict string on ranked-project rows (Priorities + dashboard Top-priorities), or drop the km requirement from the spec if the distance isn't computed.

3. **"MP Office · Coimbatore" identity is a static placeholder.**
   Acceptable for a demo, but there is no real signed-in user; the Sign-out button and identity are cosmetic. Confirm this is intentional before judging.

## Notes

- Data-source labelling is honest throughout (Synthetic / Modelled / Real·Census / Computed chips), and the dashboard footer discloses synthetic complaints over real geography on MeitY-compliant infra — good for judge trust.
- Intake complaints use real Coimbatore names and Siruvani water framing in EN/HI/TA. No synthetic-looking placeholder text observed.
