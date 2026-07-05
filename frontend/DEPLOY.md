# Deploying the frontend to Firebase Hosting

The frontend is a static Vite + React + TS site. It is built to `dist/` and served
by Firebase Hosting. The backend deploys separately to Cloud Run.

Firebase project: `gemini-enterprise-475109` (see `.firebaserc`).

## Prerequisites

- Node 18+ and npm
- Firebase CLI (either `npm i -g firebase-tools`, or use `npx firebase-tools ...`)
- Authenticated: `firebase login` (this repo assumes you are already logged in)

## 1. Point the build at the deployed backend

Set `VITE_API_URL` in `frontend/.env` to the deployed Cloud Run backend URL:

```
# frontend/.env
VITE_API_URL=https://constituency-engine-xxxxx.asia-south1.run.app
VITE_MAPS_API_KEY=your-google-maps-browser-key
```

- `.env` is gitignored — copy from `.env.example` if it does not exist.
- Do NOT include a trailing slash on `VITE_API_URL`.

> Note: `VITE_API_URL` and `VITE_MAPS_API_KEY` are baked into the JavaScript bundle
> at build time. They are visible to anyone in the browser — that is expected and
> fine for these two values (a public API base URL and a referrer-restricted Maps
> browser key). Never put server secrets in `VITE_*` variables.

## 2. Build

```
cd frontend
npm install        # first time only
npm run build      # runs tsc + vite build, outputs dist/
```

## 3. Deploy

```
cd frontend
firebase deploy --only hosting
# or, without a global install:
npx firebase-tools deploy --only hosting
```

The live URL will be `https://gemini-enterprise-475109.web.app` (and
`https://gemini-enterprise-475109.firebaseapp.com`).

## 4. Google Maps key restriction

The Maps browser key is restricted by HTTP referrer. After the first deploy, add
the Firebase Hosting domains to the key's allowed referrers in the Google Cloud
Console (APIs & Services -> Credentials -> your key -> Website restrictions):

```
https://gemini-enterprise-475109.web.app/*
https://gemini-enterprise-475109.firebaseapp.com/*
```

Add `http://localhost:5173/*` too if you use maps during local dev. Referrer
changes can take a few minutes to propagate.

## Notes

- SPA routing: `firebase.json` rewrites all routes to `/index.html`, so
  React Router deep links (e.g. reloading `/dashboard`) work.
- Caching: hashed assets under `/assets/**` are served `immutable` for a year;
  `index.html` is served `no-cache` so new deploys are picked up immediately.
- Re-deploying only requires repeating steps 2 and 3.
