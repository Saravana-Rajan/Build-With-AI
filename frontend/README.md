# Constituency Intelligence Engine — Frontend

MP-facing dashboard (Vite + React + TypeScript). Five screens behind a left-nav
layout, wired to the FastAPI backend.

## Screens

1. **Intake** — live feed of incoming demands as they are structured/geo-resolved.
2. **Priorities** — dominant themes + the ranked project list.
3. **Constituency X-Ray** _(hero)_ — village/ward coverage heatmap + "₹ owed" headline.
4. **Act** — Track A (letters to unlock entitlements) / Track B (₹5 Cr MPLADS cart).
5. **Forgotten Villages** — high-need, low-petition ("silent") areas.

The app opens on **Constituency X-Ray** (the hero screen).

## Run

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`.

## Environment

Create `frontend/.env` (gitignored — see `.env.example`):

```
VITE_API_URL=http://localhost:8000     # FastAPI backend base URL
VITE_MAPS_API_KEY=                     # Google Maps / map provider key
```

- `VITE_API_URL` — consumed by `src/api.ts` (defaults to `http://localhost:8000`).
- `VITE_MAPS_API_KEY` — used by the real map once wired. Until it is set, the
  X-Ray screen renders a static heatmap placeholder (see
  `src/components/MapPlaceholder.tsx`, which documents where Google Maps /
  react-map-gl goes). **Do not commit the key.**

## Structure

```
frontend/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json / tsconfig.node.json
├─ vite-env.d.ts
├─ .env.example
└─ src/
   ├─ main.tsx              # React root + RouterProvider
   ├─ router.tsx           # React Router routes
   ├─ types.ts             # mirrors backend/app/schema.py
   ├─ api.ts               # fetch client (VITE_API_URL)
   ├─ styles.css
   ├─ components/          # Layout, Page, StateBlock, MapPlaceholder
   └─ screens/             # the 5 route screens
```

## Types

`src/types.ts` mirrors `backend/app/schema.py` field-for-field: `DemandRecord`,
`SchemeGap`, `RankedProject`, `SilentVillage` (plus `Submission` and the shared
vocabularies `Category`, `Urgency`, `Track`, `MatchType`, `Source`). Keep them in
sync when the backend contract changes.

## Notes

Screens currently render loading / empty placeholder states. Real data wiring
(via `src/api.ts`) comes later — the API endpoint paths in `api.ts` are
best-guess placeholders and should be confirmed against the backend routes.
