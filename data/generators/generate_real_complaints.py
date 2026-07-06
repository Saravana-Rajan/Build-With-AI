"""
REAL-grounded citizen-complaint generator — Coimbatore (Track 1).

Unlike ``generate_complaints.py`` (purely synthetic templates), every complaint
here is DERIVED from a real, sourced Coimbatore civic issue documented in
``docs/coimbatore-real-issues.md`` (22 issues, 2023–2026, each with a named news
outlet / study + date). Each real issue is expanded into MANY citizen complaints
— different residents of the affected wards phrasing the SAME real problem in
Tamil / Hindi / English — so the feed looks lived-in while staying traceable:
every row carries ``source_outlet`` + ``source_note`` + ``is_real=True``.

Coimbatore is a Tamil-majority city, so complaints are authored ONLY in Tamil
and English (no Hindi). The language mix is ~60% Tamil / ~40% English, produced
by giving each real issue three Tamil templates and two English templates.

Place names are kept consistent with ``data/coimbatore/urban_wards.json`` /
``fringe_villages.json`` where the real area maps onto a known ward, so the
downstream analytics (petition_count per area) light up on real geography.

Usage:  python data/generators/generate_real_complaints.py
Outputs (data/generated/, gitignored):
    real_complaints.json      list-of-dicts
    real_complaints.ndjson    NDJSON, utf-8, Tamil-safe (for `bq load`)
    real_issues.json          the 22 sourced issues (list-of-dicts)
    real_issues.ndjson        NDJSON, utf-8 (for `bq load`)

Fields per complaint: id, channel, language, raw_text, place_name, urban,
true_category, urgency_hint, created_at, source_outlet, source_note, is_real
(+ synthetic=False to preserve the existing complaints_synthetic schema).
"""
from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GEO_DIR = ROOT / "data" / "coimbatore"
OUT_DIR = ROOT / "data" / "generated"

NOW = datetime(2026, 7, 5, 12, 0, 0)  # deterministic 'now'

CHANNELS = ["web", "telegram", "phone", "meeting"]

# ── The 22 REAL, SOURCED issues (from docs/coimbatore-real-issues.md) ─────────
# Each carries: display metadata for the `real_issues` table (area/sector/issue/
# source_outlet/source_date/headline) PLUS derivation metadata used to expand it
# into citizen complaints (category, affected wards, weight, urgency, base date,
# Tamil+English templates keyed (lang, text) with a {place} slot).
REAL_ISSUES = [
    {
        "id": "RI-01",
        "area": "Citywide (scarcity wards)",
        "sector": "Drinking water",
        "issue": "Siruvani Dam fell to ~12-16 ft of 50 ft; drawal halved so some wards got water only once every 3 days, others once a week",
        "source_outlet": "Simplicity.in / Afternoonnews.in",
        "source_date": "2026-04",
        "headline": "Siruvani Dam Water Level Drops to 12 Feet - Coimbatore Drinking Water Crisis",
        "category": "water",
        "urban": True,
        "base_date": datetime(2026, 5, 10),
        "window": 40,
        "urgency": ["critical", "high"],
        "weight": 30,
        "wards": ["Kuniyamuthur", "Kavundampalayam", "Thudiyalur", "Vadavalli",
                  "Vellakinar", "Saravanampatti", "Ondipudur", "Ganapathy",
                  "Selvapuram", "Ashokapuram", "Edayarpalayam", "Chinnavedampatti"],
        "templates": [
            ("ta", "Siruvani தண்ணி குறைஞ்சதால {place}ல வாரத்துக்கு ஒரு தடவைதான் குடிநீர் வருது."),
            ("ta", "{place}ல மூணு நாளைக்கு ஒரு முறைதான் தண்ணி விடுறாங்க, குடிக்கவே பத்தலை."),
            ("ta", "{place}ல குடிநீர் பஞ்சம், விடியக்காலைல நாலு மணிக்கே குடம் வெச்சு வரிசையில நிக்கிறோம்."),
            ("en", "Siruvani level has crashed - {place} now gets drinking water only once a week."),
            ("en", "Water in {place} comes once in three days; we are queuing at 4am for pots."),
        ],
    },
    {
        "id": "RI-02",
        "area": "All five corporation zones (scarcity wards)",
        "sector": "Drinking water",
        "issue": "Corporation announced zone-wise helpline numbers so scarcity-hit wards could request tanker (water-truck) supply",
        "source_outlet": "Covai Post",
        "source_date": "2025-06",
        "headline": "Drinking water supply: Helpline numbers announced",
        "category": "water",
        "urban": True,
        "base_date": datetime(2025, 6, 15),
        "window": 30,
        "urgency": ["high", "medium"],
        "weight": 12,
        "wards": ["Ukkadam", "Ramanathapuram", "Sundarapuram", "Karumbukadai",
                  "Selvapuram", "Ondipudur"],
        "templates": [
            ("ta", "{place}ல தண்ணி இல்லை, டேங்கர் கேட்டு ஹெல்ப்லைன்ல கூப்பிட்டா வரலை."),
            ("ta", "{place} பகுதிக்கு தண்ணி லாரி வரமாட்டேங்குது, குடிநீர் பஞ்சம்."),
            ("ta", "{place}ல ஹெல்ப்லைன் நம்பர்ல மூணு தடவ கூப்பிட்டும் தண்ணி டேங்கர் வரலை."),
            ("en", "Called the zone helpline for a water tanker in {place} three times - none came."),
            ("en", "Tanker supply promised for {place} but the truck skips our street every time."),
        ],
    },
    {
        "id": "RI-03",
        "area": "Kuniyamuthur, Saravanampatti, Vellakinar, Thudiyalur, Kavundampalayam, Ondipudur",
        "sector": "Water supply / UGD",
        "issue": "Underground drainage + water-supply works left incomplete and staggered, leaving roads dug up for long periods",
        "source_outlet": "urbanacres.in",
        "source_date": "2024-12",
        "headline": "Coimbatore Corporation to Fast-Track UGD and Water Supply Projects to Ease Public Woes",
        "category": "water",
        "urban": True,
        "base_date": datetime(2024, 12, 10),
        "window": 45,
        "urgency": ["high", "medium"],
        "weight": 16,
        "wards": ["Kuniyamuthur", "Saravanampatti", "Vellakinar", "Thudiyalur",
                  "Kavundampalayam", "Ondipudur"],
        "templates": [
            ("ta", "{place}ல UGD வேலைக்காக ரோடு தோண்டி வெச்சு மாசக்கணக்கா மூடலை, தண்ணி பைப்பும் முடியலை."),
            ("ta", "{place} குடிநீர் திட்ட வேலை பாதியிலயே நின்னுபோச்சு, மண்ணு குழி ஆபத்து."),
            ("ta", "{place}ல ஊரடி வடிகால் வேலை முடிக்காம ரோடு முழுக்க தோண்டி போட்டிருக்காங்க."),
            ("en", "UGD and water-pipe work in {place} is half-done - the road has been dug up for months."),
            ("en", "Water-supply project in {place} stalled at 20%; trenches everywhere, no water yet."),
        ],
    },
    {
        "id": "RI-04",
        "area": "Citywide (arterial & residential streets)",
        "sector": "Roads / potholes",
        "issue": "Residents demand pothole repairs; corporation to re-lay 1,847 deteriorated roads at Rs 1.07 bn",
        "source_outlet": "The Hindu",
        "source_date": "2025-10-13",
        "headline": "Fix potholes on roads in the city, demand residents",
        "category": "road",
        "urban": True,
        "base_date": datetime(2025, 10, 13),
        "window": 40,
        "urgency": ["high", "medium"],
        "weight": 30,
        "wards": ["Gandhipuram", "Peelamedu", "Singanallur", "R.S. Puram",
                  "Ganapathy", "Ramanathapuram", "Ondipudur", "Saravanampatti",
                  "Ram Nagar", "Puliakulam", "Sowripalayam", "Nava India",
                  "Rathinapuri", "Uppilipalayam"],
        "templates": [
            ("ta", "{place} ரோட்ல முழுக்க பள்ளம், தினமும் டூ-வீலர் விபத்து, ரிப்பேர் பண்ணுங்க."),
            ("ta", "{place}ல ரோடு பழுதாகி ரெண்டு வருஷம் ஆச்சு, மழையில குழி தெரியாம விழுறாங்க."),
            ("ta", "{place} சாலையில பெரிய பள்ளங்க, இரவுல வண்டி ஓட்டவே பயமா இருக்கு."),
            ("en", "The road in {place} is all potholes - bikes skid daily. Please re-lay it."),
            ("en", "Include {place} in the 1,847-road re-laying list - our stretch is dangerous."),
        ],
    },
    {
        "id": "RI-05",
        "area": "Vadavalli-Marudhamalai Road",
        "sector": "Roads",
        "issue": "Narrow congested 4.6 km two-lane stretch to temple foothills is a chronic bottleneck; Rs 43 cr four-laning began",
        "source_outlet": "Today's Coimbatore",
        "source_date": "2025-11",
        "headline": "Vadavalli-Marudhamalai Road Upgrade, Coimbatore",
        "category": "road",
        "urban": True,
        "base_date": datetime(2025, 11, 15),
        "window": 30,
        "urgency": ["high", "medium"],
        "weight": 8,
        "wards": ["Vadavalli"],
        "templates": [
            ("ta", "{place}-மருதமலை ரோடு ரொம்ப ஒடுக்கம், திருவிழா நேரத்துல மணிக்கணக்கா ட்ராஃபிக்."),
            ("ta", "{place} ரோடு நாலு வழிச்சாலையா ஆக்குறோம்னு சொன்னாங்க, வேலை மெதுவா நகருது."),
            ("ta", "{place}ல ரோடு ஒடுக்கமா இருக்கிறதால தினமும் வாகன நெரிசல், போக்குவரத்து சிக்கல்."),
            ("en", "The {place}-Marudhamalai stretch is a two-lane bottleneck - jams for hours on festival days."),
            ("en", "Four-laning of {place} road was announced but work is crawling; daily gridlock continues."),
        ],
    },
    {
        "id": "RI-06",
        "area": "Sanganoor",
        "sector": "Roads / drainage",
        "issue": "Canal-side road heavily damaged; road-laying/restoration begun as part of Sanganoor Canal revamp",
        "source_outlet": "ProjectsToday",
        "source_date": "2025-11",
        "headline": "Road-laying work begins along Sanganoor Canal in Coimbatore",
        "category": "road",
        "urban": True,
        "base_date": datetime(2025, 11, 10),
        "window": 30,
        "urgency": ["medium", "high"],
        "weight": 7,
        "wards": ["Sanganoor", "Ganeshapuram"],
        "templates": [
            ("ta", "{place} கால்வோரம் இருக்கிற ரோடு முழுசா உடைஞ்சு போச்சு, வண்டி ஓட்டவே முடியலை."),
            ("ta", "{place} கால்வாய் ஓரமா ரோடு போடுற வேலை தொடங்கியும் பாதி மட்டும்தான் முடிச்சிருக்காங்க."),
            ("ta", "{place}ல கால்வோர சாலை உடைஞ்சு கிடக்கு, சீக்கிரம் சரி செய்யுங்க."),
            ("en", "The canal-side road in {place} is completely broken - restoration is overdue."),
            ("en", "Road-laying along the {place} canal started but half the stretch is still rubble."),
        ],
    },
    {
        "id": "RI-07",
        "area": "Race Course / Sungam / Sivananda Colony",
        "sector": "Drainage / flooding",
        "issue": "Second straight day of heavy rain flooded major roads and subways; Sivananda Colony tunnel closed",
        "source_outlet": "DT Next",
        "source_date": "2024-10-23",
        "headline": "Heavy rain lashes Coimbatore for second consecutive day; roads and subways flooded",
        "category": "sanitation",
        "urban": True,
        "base_date": datetime(2024, 10, 23),
        "window": 20,
        "urgency": ["critical", "high"],
        "weight": 14,
        "wards": ["Race Course", "Sungam", "Sivananda Colony"],
        "templates": [
            ("ta", "{place}ல மழைத்தண்ணி வடிஞ்சு போக வழியில்லை, சப்வே முழுக மூழ்கிடுச்சு."),
            ("ta", "{place} சுரங்கப்பாதையில தண்ணி நிரம்பி வாகனம் போக முடியலை, டிரெயினேஜ் சரியில்லை."),
            ("ta", "{place}ல ரெண்டு நாள் மழைக்கே சாலைகள் மூழ்கி, மழைநீர் வடிகால் இல்லாம தவிக்கிறோம்."),
            ("en", "Two days of rain and {place} is under water again - the subway is closed and drains overflow."),
            ("en", "Stormwater in {place} has nowhere to go; every monsoon the underpass floods."),
        ],
    },
    {
        "id": "RI-08",
        "area": "Ukkadam, Peelamedu, Singanallur, Kuniyamuthur, Ganapathy, Saravanampatti, Kavundampalayam, Saibaba Colony",
        "sector": "Drainage / flooding",
        "issue": "City inundated; private bus stranded in flooded Sai Baba Colony subway, roads across localities submerged",
        "source_outlet": "News9live",
        "source_date": "2024-10-14",
        "headline": "Coimbatore inundated: Heavy rains strand private bus, leave roads submerged",
        "category": "sanitation",
        "urban": True,
        "base_date": datetime(2024, 10, 14),
        "window": 18,
        "urgency": ["critical", "high"],
        "weight": 28,
        "wards": ["Ukkadam", "Peelamedu", "Singanallur", "Kuniyamuthur",
                  "Ganapathy", "Saravanampatti", "Kavundampalayam", "Saibaba Colony"],
        "templates": [
            ("ta", "{place}ல வெள்ளம் புகுந்து வீட்டுக்குள்ள தண்ணி, சாலைகள் எல்லாம் மூழ்கிடுச்சு."),
            ("ta", "{place} பகுதி முழுக்க வெள்ளம், மழைநீர் வடிகால் இல்லாததால தண்ணி நிக்குது."),
            ("ta", "{place}ல மழையில சப்வேல தண்ணி நிரம்பி பஸ்ஸே சிக்கிக்கிச்சு, வெளியேற வழியில்லை."),
            ("en", "{place} is flooded - water entered homes and the subway swallowed a bus."),
            ("en", "No stormwater drains in {place}; the October rains left the whole area submerged."),
        ],
    },
    {
        "id": "RI-09",
        "area": "Sanganoor (stream encroachment zone)",
        "sector": "Drainage / sewage",
        "issue": "House on allegedly encroached land along Sanganur stream collapsed after evictions for desilting/flood-control work",
        "source_outlet": "DT Next",
        "source_date": "2025-01-21",
        "headline": "House built along Sanganur stream collapses in Coimbatore",
        "category": "sanitation",
        "urban": True,
        "base_date": datetime(2025, 1, 21),
        "window": 25,
        "urgency": ["high", "medium"],
        "weight": 6,
        "wards": ["Sanganoor"],
        "templates": [
            ("ta", "{place} ஓடையோரம் வீடு இடிஞ்சு விழுந்துச்சு, டிசில்ட்டிங் வேலை சரியா நடக்கலை."),
            ("ta", "{place}ல வெள்ள கட்டுப்பாட்டு வேலைக்காக காலி பண்ணச்சொல்லி குடும்பங்க தவிக்குது."),
            ("ta", "{place} ஓடையோர மண் சரிஞ்சு வீடு இடிஞ்சது, தடுப்புச்சுவர் வேலை சரியில்லை."),
            ("en", "A house collapsed along the {place} stream - desilting and retaining-wall work is botched."),
            ("en", "Flood-control evictions in {place} left families displaced and the stream still un-desilted."),
        ],
    },
    {
        "id": "RI-10",
        "area": "Sanganoor canal (Nanjundapuram to Noyyal)",
        "sector": "Sewage",
        "issue": "Unlined 10.8 km city drain heavily contaminated with faecal matter and untreated sewage, degrading water",
        "source_outlet": "Scrutiny Journals (study)",
        "source_date": "2024",
        "headline": "Pollution studies on Sanganur canal, Coimbatore district",
        "category": "sanitation",
        "urban": True,
        "base_date": datetime(2024, 9, 1),
        "window": 60,
        "urgency": ["high", "medium"],
        "weight": 10,
        "wards": ["Sanganoor", "Puliakulam", "Ramanathapuram"],
        "templates": [
            ("ta", "{place} கால்வாயில கழிவுநீர் கலந்து நாத்தம் அடிக்குது, கிணத்துத் தண்ணியும் கெட்டுபோச்சு."),
            ("ta", "{place} ஓடையில சுத்திகரிக்காத கழிவுநீர் விடுறாங்க, சுகாதார பிரச்சனை."),
            ("ta", "{place} கால்வாயில மலக்கழிவு கலந்து நாத்தம் தாங்கமுடியலை, கொசு தொல்லை."),
            ("en", "The {place} canal carries raw sewage - the stench is unbearable and groundwater is spoilt."),
            ("en", "Untreated household and factory sewage flows into the {place} drain daily."),
        ],
    },
    {
        "id": "RI-11",
        "area": "Vellalore dump yard",
        "sector": "Garbage / solid waste",
        "issue": "3,882+ tonnes of unsegregated waste dumped in Dec 2024 alone; biomining launched to clear legacy waste",
        "source_outlet": "iamrenew",
        "source_date": "2025-01",
        "headline": "New biogas project to come up at Coimbatore dumpyard",
        "category": "sanitation",
        "urban": False,
        "base_date": datetime(2024, 12, 15),
        "window": 45,
        "urgency": ["high", "medium"],
        "weight": 14,
        "wards": ["Vellalore"],
        "templates": [
            ("ta", "{place} குப்பை மேட்டுல தினமும் டன் கணக்கா குப்பை கொட்டுறாங்க, நாத்தம் தாங்கமுடியலை."),
            ("ta", "{place}ல பழைய குப்பையை அகத்தலை, ஈ, கொசு, நோய் பரவுது."),
            ("ta", "{place} குப்பை மேட்டு நாத்தம் வீடு வரைக்கும் அடிக்குது, மூச்சுவிடவே கஷ்டம்."),
            ("en", "The {place} dump yard gets thousands of tonnes of mixed waste - the smell reaches our homes."),
            ("en", "Legacy waste at {place} is still not bio-mined; flies and stench everywhere."),
        ],
    },
    {
        "id": "RI-12",
        "area": "Vellalore-Kurichi landfill surroundings",
        "sector": "Sanitation / groundwater",
        "issue": "Landfill leachate polluted nearby wells, groundwater unfit even for domestic use, plume moving north-west",
        "source_outlet": "ScienceDirect (study)",
        "source_date": "2021+",
        "headline": "Vulnerability analysis of groundwater quality around Vellalore-Kurichi landfill",
        "category": "sanitation",
        "urban": False,
        "base_date": datetime(2024, 11, 1),
        "window": 60,
        "urgency": ["high", "medium"],
        "weight": 8,
        "wards": ["Vellalore", "Kuniyamuthur"],
        "templates": [
            ("ta", "{place} குப்பை மேட்டு கசிவு கிணத்துத் தண்ணியில கலந்து, வீட்டு உபயோகத்துக்கே லாயக்கில்லை."),
            ("ta", "{place}ல போர்வெல் தண்ணி கருப்பா நாத்தத்தோட வருது, குடிக்கவே முடியலை."),
            ("ta", "{place} குப்பை மேட்டுக்கு பக்கத்துல கிணறு தண்ணி நச்சாகி கெட்டுபோச்சு."),
            ("en", "Landfill leachate near {place} has ruined our well water - it's unfit even for washing."),
            ("en", "Groundwater around {place} is contaminated by the dump; borewells now pump foul water."),
        ],
    },
    {
        "id": "RI-13",
        "area": "GN Mills flyover (Mettupalayam Road)",
        "sector": "Street lights",
        "issue": "Dysfunctional streetlights left the flyover dark for months, raising accident risk",
        "source_outlet": "The New Indian Express",
        "source_date": "2025-03-17",
        "headline": "Dysfunctional streetlights leave GN Mills flyover dark for months",
        "category": "other",
        "urban": True,
        "base_date": datetime(2025, 3, 17),
        "window": 40,
        "urgency": ["high", "medium"],
        "weight": 8,
        "wards": ["GN Mills"],
        "templates": [
            ("ta", "{place} மேம்பாலத்துல தெருவிளக்கு எரியலை, இரவுல வண்டி ஓட்ட ரொம்ப ஆபத்து."),
            ("ta", "{place} பாலத்துல விளக்கே இல்லாம பல மாசமா இருட்டு, விபத்து அபாயம்."),
            ("ta", "{place} மேம்பாலத்துல ராத்திரி காரிருட்டு, தெருவிளக்கை சரி செய்யுங்க."),
            ("en", "Streetlights on the {place} flyover have been dead for months - night riding is dangerous."),
            ("en", "The {place} flyover is pitch dark after sunset; please restore the lighting."),
        ],
    },
    {
        "id": "RI-14",
        "area": "Mettupalayam & Avinashi Roads",
        "sector": "Street lights",
        "issue": "Key arterial stretches left without functioning streetlights, endangering night commuters",
        "source_outlet": "The Hindu",
        "source_date": "2025-09-05",
        "headline": "No streetlights on key stretches of Mettupalayam and Avinashi roads",
        "category": "other",
        "urban": True,
        "base_date": datetime(2025, 9, 5),
        "window": 35,
        "urgency": ["high", "medium"],
        "weight": 9,
        "wards": ["Ganapathy", "Peelamedu", "Hope College"],
        "templates": [
            ("ta", "{place} பகுதி முக்கிய சாலையில தெருவிளக்கே இல்லை, இரவுல நடக்கவே பயமா இருக்கு."),
            ("ta", "{place}ல முக்கிய சாலையில விளக்கு எரியாததால இரவு பயணிகள் அச்சத்துல இருக்காங்க."),
            ("ta", "{place} சாலையில ராத்திரி இருட்டா இருக்கு, எப்பவும் விபத்து நடக்கலாம்."),
            ("en", "No working streetlights on the {place} arterial stretch - commuters are unsafe at night."),
            ("en", "The {place} stretch of Avinashi Road stays dark; accidents waiting to happen."),
        ],
    },
    {
        "id": "RI-15",
        "area": "Sidhapudur",
        "sector": "Housing / TNUHDB",
        "issue": "Tenement beneficiaries asked to pay Rs 85,000 each; residents face water-access & payment disputes",
        "source_outlet": "The New Indian Express",
        "source_date": "2024-02-22",
        "headline": "Beneficiaries of TNUHDB units in Sidhapudur asked to pay Rs 85,000 each",
        "category": "housing",
        "urban": True,
        "base_date": datetime(2024, 2, 22),
        "window": 50,
        "urgency": ["medium", "high"],
        "weight": 10,
        "wards": ["Sidhapudur"],
        "templates": [
            ("ta", "{place} TNUHDB வீட்டுக்கு 85,000 ரூபா கட்டச்சொல்றாங்க, எங்களால முடியலை."),
            ("ta", "{place}ல வீடு ஒதுக்கீடு ஆனா தண்ணி இணைப்பும் இல்ல, பணப் பிரச்சனையும் தீரலை."),
            ("ta", "{place} வீட்டுவாரிய குடியிருப்புல தண்ணி இணைப்பு இல்லை, கட்டணமும் அதிகம்."),
            ("en", "TNUHDB is demanding Rs 85,000 per family in {place} - beneficiaries can't afford it."),
            ("en", "Housing-board tenements in {place} still lack water connections despite the fees demanded."),
        ],
    },
    {
        "id": "RI-16",
        "area": "Keeranatham",
        "sector": "Housing / TNUHDB",
        "issue": "Residents of resettlement tenements live amid overflowing septic tanks, lacking basic facilities",
        "source_outlet": "The Hindu",
        "source_date": "2023-11-06",
        "headline": "Residents of TNUHDB tenements at Coimbatore's Keeranatham live amid overflowing septic tanks",
        "category": "housing",
        "urban": True,
        "base_date": datetime(2023, 11, 6),
        "window": 60,
        "urgency": ["high", "medium"],
        "weight": 8,
        "wards": ["Keeranatham"],
        "templates": [
            ("ta", "{place} குடியிருப்புல செப்டிக் டேங்க் நிரம்பி வழியுது, அடிப்படை வசதியே இல்லை."),
            ("ta", "{place}ல மறுவாழ்வு வீடுகள்ல கழிவுநீர் வழிஞ்சு, பராமரிப்பே இல்லை."),
            ("ta", "{place} புனர்வாழ்வு குடியிருப்புல அடிப்படை வசதி இல்லாம மக்கள் தவிக்கிறாங்க."),
            ("en", "Resettlement tenements in {place} have overflowing septic tanks and no basic amenities."),
            ("en", "We were resettled to {place} but live amid sewage overflow with no maintenance."),
        ],
    },
    {
        "id": "RI-17",
        "area": "Velandipalayam, Saravanampatti, Nehru Nagar West",
        "sector": "Health / UPHC",
        "issue": "Growing-population areas lack adequate public healthcare; corporation setting up five new Urban PHCs",
        "source_outlet": "Medical Buyer",
        "source_date": "2025-04-16",
        "headline": "Coimbatore Corporation mulls setting up five new UPHCs",
        "category": "health",
        "urban": True,
        "base_date": datetime(2025, 4, 16),
        "window": 45,
        "urgency": ["high", "medium"],
        "weight": 12,
        "wards": ["Velandipalayam", "Saravanampatti", "Nehru Nagar West", "Krishna Avenue"],
        "templates": [
            ("ta", "{place}ல அரசு நகர்ப்புற சுகாதார நிலையம் இல்லை, சின்ன காய்ச்சலுக்கும் தூரம் போகணும்."),
            ("ta", "{place} பகுதியில மக்கள் தொகை பெருகியும் அருகில அரசு மருத்துவமனை இல்லை."),
            ("ta", "{place}ல வாக்குறுதி கொடுத்த நகர்ப்புற சுகாதார நிலையத்தை சீக்கிரம் திறங்க."),
            ("en", "{place} has no urban PHC - even for a fever we travel far. Please open the promised UPHC."),
            ("en", "Population in {place} has exploded but there's no public health centre nearby."),
        ],
    },
    {
        "id": "RI-18",
        "area": "Coimbatore Medical College Hospital (CMCH)",
        "sector": "Health / govt hospital",
        "issue": "1,020-bed CMCH handles 5,500+ outpatients/day; overcrowding delays registration, diagnostics & pharmacy",
        "source_outlet": "coimbatore.nic.in / TN govt report",
        "source_date": "2024-25",
        "headline": "CMCH handles 5,500+ outpatients/day across 30 departments",
        "category": "health",
        "urban": True,
        "base_date": datetime(2024, 11, 1),
        "window": 60,
        "urgency": ["high", "medium"],
        "weight": 8,
        "wards": ["CMCH"],
        "templates": [
            ("ta", "{place}ல ஓபி வரிசை ரொம்ப நீளம், பதிவு பண்ணவே மணிக்கணக்கா காத்திருக்கணும்."),
            ("ta", "{place}ல தினமும் ஆயிரக்கணக்கான நோயாளிகள், கவுண்டர் பத்தாம மருந்துக்கே நீண்ட வரிசை."),
            ("ta", "{place} மருத்துவமனையில கூட்ட நெரிசல், பரிசோதனைக்கு நாள் முழுக்க ஆகுது."),
            ("en", "{place} OPD is hopelessly overcrowded - hours of waiting for registration and pharmacy."),
            ("en", "5,500 patients a day at {place} and too few counters; diagnostics take all day."),
        ],
    },
    {
        "id": "RI-19",
        "area": "Vellalore (Integrated Bus Terminus)",
        "sector": "Transport",
        "issue": "Rs 125-cr Coimbatore Integrated Bus Terminus stalled since 2020-21; city still reliant on congested Gandhipuram",
        "source_outlet": "CIBT project records",
        "source_date": "2025",
        "headline": "Coimbatore Integrated Bus Terminus stalled since 2020-21",
        "category": "road",
        "urban": False,
        "base_date": datetime(2025, 3, 1),
        "window": 60,
        "urgency": ["medium", "high"],
        "weight": 6,
        "wards": ["Vellalore"],
        "templates": [
            ("ta", "{place}ல ஒருங்கிணைந்த பேருந்து நிலையம் 2020லயே நின்னுபோச்சு, இன்னும் காந்திபுரம்தான்."),
            ("ta", "{place} பஸ் டெர்மினஸ் வேலை பல வருஷமா நிறுத்தி வெச்சிருக்காங்க, முடிக்கணும்."),
            ("ta", "{place}ல புது பேருந்து நிலையம் முடிக்காததால காந்திபுரத்துல நெரிசல் அதிகம்."),
            ("en", "The {place} integrated bus terminus has been stalled since 2020-21 - finish it."),
            ("en", "Because {place} CIBT is incomplete, all buses still choke Gandhipuram."),
        ],
    },
    {
        "id": "RI-20",
        "area": "Ukkadam",
        "sector": "Transport",
        "issue": "Ukkadam terminus disrupted after partial demolition for flyover; Rs 21.55-cr twin-terminus rebuild launched Aug 2025",
        "source_outlet": "Ukkadam civic records",
        "source_date": "2025-08-24",
        "headline": "Rs 21.55-cr Ukkadam twin bus terminus rebuild launched",
        "category": "road",
        "urban": True,
        "base_date": datetime(2025, 8, 24),
        "window": 45,
        "urgency": ["medium", "high"],
        "weight": 9,
        "wards": ["Ukkadam"],
        "templates": [
            ("ta", "{place} பேருந்து நிலையம் இடிச்சதுக்கப்புறம் பஸ் நிற்க இடமில்லை, ரோட்லயே ஏறுறோம்."),
            ("ta", "{place}ல பேருந்து நிலையம் இடிச்சாச்சு, மறுசீரமைப்பு வேலை மெதுவா நடக்குது."),
            ("ta", "{place} டெர்மினஸ் இல்லாததால பஸ் சாலையில நிற்குது, பயணிகளுக்கு ரொம்ப சிரமம்."),
            ("en", "Since the {place} terminus was demolished, buses halt on the road - chaos for passengers."),
            ("en", "The {place} terminus rebuild only started in Aug 2025; till then commuters suffer."),
        ],
    },
    {
        "id": "RI-21",
        "area": "Saravanampatti-Kalapatti (IT corridor)",
        "sector": "Transport / infrastructure",
        "issue": "Peak-hour traffic congestion on IT corridor; metro proposal rejected, leaving road-only options",
        "source_outlet": "Swarajya / Today's Coimbatore",
        "source_date": "2025-11",
        "headline": "Coimbatore metro proposal rejected; IT corridor stuck with road-only options",
        "category": "road",
        "urban": True,
        "base_date": datetime(2025, 11, 1),
        "window": 40,
        "urgency": ["high", "medium"],
        "weight": 10,
        "wards": ["Saravanampatti", "Kalapatti", "Chinnavedampatti"],
        "templates": [
            ("ta", "{place} IT காரிடார்ல பீக் அவர்ல மணிக்கணக்கா ட்ராஃபிக், மெட்ரோவும் வேண்டாம்னு சொல்லிட்டாங்க."),
            ("ta", "{place}ல பீக் நேரத்துல 3 கிலோமீட்டர் போக ஒரு மணி நேரம் ஆகுது, போக்குவரத்து சிக்கல்."),
            ("ta", "{place} ஐடி வழித்தடத்துல வாகன நெரிசல் தாங்கமுடியலை, சாலைகளை சரி செய்யுங்க."),
            ("en", "Peak-hour traffic on the {place} IT corridor is brutal and the metro was rejected - fix the roads."),
            ("en", "Commuting through {place} at 6pm takes an hour for 3km; we need real transport planning."),
        ],
    },
    {
        "id": "RI-22",
        "area": "Sanganoor canal / Dr. Rajendraprasad Road",
        "sector": "Encroachment",
        "issue": "CCMC evicting 10+ commercial units and ~80 houses among 3,000+ unauthorized structures for canal rejuvenation",
        "source_outlet": "Prop News Time",
        "source_date": "2025-06",
        "headline": "Coimbatore intensifies eviction of commercial encroachments along Sanganoor Canal",
        "category": "other",
        "urban": True,
        "base_date": datetime(2025, 6, 15),
        "window": 40,
        "urgency": ["medium", "high"],
        "weight": 7,
        "wards": ["Sanganoor"],
        "templates": [
            ("ta", "{place} கால்வாய் ஆக்கிரமிப்பு அகற்றுறாங்க, ஆனா மறுவாழ்வு இல்லாம குடும்பங்க தவிக்குது."),
            ("ta", "{place}ல கால்வாய் தூர்வார ஆக்கிரமிப்பு வீடுகளை இடிக்கிறாங்க, மறுகுடியமர்வு தெளிவில்லை."),
            ("ta", "{place} கால்வோர கடைகளை காலி பண்ணச்சொல்றாங்க, ஆனா மாற்று இடம் தரலை."),
            ("en", "Eviction of {place} canal encroachments is on, but displaced families got no rehabilitation."),
            ("en", "3,000+ structures along the {place} canal face demolition with unclear resettlement."),
        ],
    },
]


def load_ward_sets():
    """Return (urban_name_set, fringe_name_set) normalised for urban flagging."""
    def names(path):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return {d["name"] for d in data if d.get("name")}
        except Exception:
            return set()
    return names(GEO_DIR / "urban_wards.json"), names(GEO_DIR / "fringe_villages.json")


def is_urban(place: str, issue_default: bool, urban_set, fringe_set) -> bool:
    """Urban flag: known fringe -> False, known ward -> True, else issue default."""
    if place in fringe_set:
        return False
    if place in urban_set:
        return True
    return issue_default


def generate(seed: int = 7):
    rng = random.Random(seed)
    urban_set, fringe_set = load_ward_sets()
    complaints = []
    counter = 0
    # deterministic order for reproducibility
    for issue in REAL_ISSUES:
        source_note = f"{issue['source_outlet']}: \"{issue['headline']}\" ({issue['source_date']})"
        for _ in range(issue["weight"]):
            counter += 1
            place = rng.choice(issue["wards"])
            lang, tpl = rng.choice(issue["templates"])
            base = issue["base_date"]
            offset = rng.randint(0, issue["window"])
            ts = base - timedelta(days=offset, hours=rng.randint(0, 23),
                                  minutes=rng.choice([0, 15, 30, 45]))
            if ts > NOW:
                ts = NOW - timedelta(days=rng.randint(1, 20))
            complaints.append({
                "id": f"REAL-{counter:04d}",
                "channel": rng.choice(CHANNELS),
                "language": lang,
                "raw_text": tpl.format(place=place),
                "place_name": place,
                "urban": is_urban(place, issue["urban"], urban_set, fringe_set),
                "true_category": issue["category"],
                "urgency_hint": rng.choice(issue["urgency"]),
                "created_at": ts.strftime("%Y-%m-%dT%H:%M:%S") + "Z",
                "source_outlet": issue["source_outlet"],
                "source_note": source_note,
                "is_real": True,
                "synthetic": False,
            })
    rng.shuffle(complaints)
    return complaints


def real_issue_rows():
    """The 22 sourced issues as flat rows for the `real_issues` BigQuery table."""
    return [
        {
            "id": i["id"],
            "area": i["area"],
            "sector": i["sector"],
            "issue": i["issue"],
            "source_outlet": i["source_outlet"],
            "source_date": i["source_date"],
        }
        for i in REAL_ISSUES
    ]


def _write_json(path: Path, rows):
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_ndjson(path: Path, rows):
    with path.open("w", encoding="utf-8", newline="\n") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    complaints = generate(args.seed)
    issues = real_issue_rows()

    _write_json(OUT_DIR / "real_complaints.json", complaints)
    _write_ndjson(OUT_DIR / "real_complaints.ndjson", complaints)
    _write_json(OUT_DIR / "real_issues.json", issues)
    _write_ndjson(OUT_DIR / "real_issues.ndjson", issues)

    langs = Counter(c["language"] for c in complaints)
    cats = Counter(c["true_category"] for c in complaints)
    per_issue = Counter(c["source_outlet"] for c in complaints)
    urban = sum(c["urban"] for c in complaints)
    print(f"Wrote {len(complaints)} REAL-grounded complaints -> {OUT_DIR}")
    print(f"  urban {urban} / fringe {len(complaints)-urban}")
    print(f"  languages : {dict(langs)}")
    print(f"  categories: {dict(cats)}")
    print(f"  real_issues rows: {len(issues)}")
    print("  top source outlets:")
    for outlet, n in per_issue.most_common(6):
        print(f"    {outlet}: {n}")


if __name__ == "__main__":
    main()
