# Public Data Sources — Track 1 (Coimbatore) — VERIFIED

Researched & verified 5 Jul 2026. Bottom line: **rural-fringe data is real and clean; urban
ward-level data does not exist publicly and must be modelled — disclosed in the demo.**

## 🟢 REAL & usable (build on these)

| Data | Source | Resolution | Access |
|---|---|---|---|
| **Jal Jeevan (FHTC per village)** | ejalshakti.gov.in | **Village** | ✅ Excel export — the hero dataset |
| Census 2011 (pop, HH, SC/ST, literacy) | data.gov.in / censusindia | **Town / village** | ✅ CSV/API (free key) |
| PM-Kisan beneficiaries | data.gov.in | Some **village** | ✅ CSV/API |
| PMAY-G, MGNREGA, SBM-G, NSAP | nic.in MIS portals | **Village / GP** | ⚠️ HTML scrape (parametrized NIC URLs) |
| Scheme dashboards (PMAY, MGNREGA, NSAP, health) | data.gov.in REST API | **District** | ✅ CSV/API (free key) |
| Village polygons (rural fringe) | DataMeet / Bhuvan | Village | ✅ GeoJSON, CC-BY |
| Coimbatore Corporation 100-ward polygons | DataMeet / OpenCity | **Municipal ward** | ✅ KML/GeoJSON |
| UDISE+ schools | udiseplus.gov.in | School | ⚠️ report-builder + geocode |

## 🔴 NOT available — must synthesize (state honestly)

| Gap | Why | Our approach |
|---|---|---|
| Urban ward scheme coverage (PMAY-U, AMRUT, SBM-U) | Portals stop at **city/ULB** | Interpolate city totals against ward Census |
| CPGRAMS grievances by district/ward | data.gov.in has **state/ministry only** | Synthesize petitions (planned anyway) |
| Census-ward ↔ municipal-ward crosswalk | 3 incompatible ward systems, **no official key** | Hand-build concordance via spatial overlay |
| NFHS-5 health below district | District is the floor | Overlay district health as constant |

## The taxonomy trap (urban weak point)
Census wards ≠ LGD urban wards ≠ Municipal/CCMC wards. Only **municipal** wards have downloadable
polygons; only **Census** wards have attributes; **no crosswalk** links them. → For urban Coimbatore
we use municipal polygons + a hand-built ward concordance + modelled coverage. Rural fringe has a
clean 3-way join (Census village ↔ LGD village ↔ village polygon), so **the hero example is real.**

## API portals
- **data.gov.in** — the one that works. Free key from "My Account". Use `datagovindia` package. REST: `api.data.gov.in/resource/{id}?api-key=KEY&format=json`. Note: many datasets are static CSV snapshots, not live API.
- **API Setu / NeGD Open API** — identity/verification APIs needing org onboarding; add nothing open. Skip.
- **Kaggle** `indian-government-schemes`, **AIKosh** (aikosh.indiaai.gov.in) — curated dataset mirrors, bonus.

## Pitch honesty line
> "Rural-fringe entitlement gaps use real village-level scheme MIS (Jal Jeevan per-village taps,
> PMAY-G). Urban-ward coverage is modelled from city totals against ward Census, stated openly.
> Citizen petitions are synthesised and mapped to real Coimbatore geography."
