# Production Ingestion — Real-Time Collection in an MP Office (Pilot)

*(For the final submission PDF. Demo uses Telegram + web + paper-scan; this is the "how it scales in a real pilot" architecture.)*

## Core idea
One **AI Ingestion Gateway** (the `/api/intake` endpoint). Every channel is a thin **connector** that pushes into it. The AI pipeline never changes — a new channel = a new connector only.

## Per channel — how it connects live

| Channel | How it collects in real-time | What's needed |
|---|---|---|
| **WhatsApp** | MP office WhatsApp number → provider (Gupshup/Twilio/Interakt) → **webhook** fires the instant a citizen messages | WhatsApp Business API approval (~1–2 wks) |
| **Telegram** | Bot (built ✅) → webhook, instant | Nothing — works today |
| **Phone / call** | IVR (Exotel/Twilio) → records the voice → webhook → Gemini transcribes | Phone number + IVR provider |
| **Paper letter / petition** | Front-desk staff photograph/scan at intake → upload page → OCR (Gemini multimodal) | Tablet/phone at the office desk |
| **Email** | Poll inbox (Gmail API/IMAP) every few min → parse + attachments | Office email access |
| **Web form** | Direct into intake (built ✅) | Nothing |
| **CPGRAMS / state portal** | If API/feed available → scheduled sync; else staff export CSV → import | Dept data-sharing agreement |
| **Gram Sabha / public meeting** | Volunteer records audio → upload → transcribe | Staff phone |

## Real-time vs batch
- **Instant (webhooks):** WhatsApp, Telegram, phone, web → land in seconds; dashboard updates live.
- **Every few minutes (polling):** email, CPGRAMS → scheduled sync.
- All → same pipeline → same BigQuery → same dashboard.

## Phased pilot rollout
**Week 1 (zero approval needed):** office WhatsApp (via provider) · Telegram · web form · **paper-scan desk** (most citizens still hand in paper).
**Week 3–4:** IVR phone line (non-literate / no-smartphone citizens) · email · CPGRAMS sync.
→ Covers ~90% of how an MP office really receives requests.

## Governance / security (govt will ask)
- Consent captured at intake · minimal PII · Aadhaar optional · data on MeitY-compliant Indian cloud (GCP `asia-south1`).

## One-line answer
> "Citizens keep using whatever they already use — WhatsApp, a phone call, the paper petition box. We put a connector on each. Everything flows into one live dashboard in seconds. A new channel tomorrow means one connector, not a rebuild."
