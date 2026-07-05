"""
Synthetic citizen-complaint generator — Coimbatore (Track 1).

Produces realistic Tamil / English / Tanglish complaints across the 8 categories,
mapped onto real Coimbatore urban wards + rural fringe villages, so the dashboard
looks alive before any live submission. Deterministic (seeded) for reproducibility.

Usage:  python data/generators/generate_complaints.py --n 300
Output: data/generated/complaints.json   (gitignored)

Reads geo from data/coimbatore/{urban_wards,fringe_villages}.json if present,
else falls back to an embedded seed list, so it runs standalone.
"""
from __future__ import annotations
import argparse
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GEO_DIR = ROOT / "data" / "coimbatore"
OUT_DIR = ROOT / "data" / "generated"

# ── Embedded fallback geo (real Coimbatore names; used if JSON files absent) ──
FALLBACK_URBAN = [
    "R.S. Puram", "Gandhipuram", "Peelamedu", "Singanallur", "Ukkadam",
    "Saibaba Colony", "Ganapathy", "Ramanathapuram", "Selvapuram", "Kuniyamuthur",
    "Saravanampatti", "Vadavalli", "Podanur", "Town Hall", "Sundarapuram",
]
FALLBACK_FRINGE = [
    "Madukkarai", "Sulur", "Thondamuthur", "Perianaickenpalayam", "Karamadai",
    "Kinathukadavu", "Annur", "Madvarayanpatti",
]

# ── Category templates: (english, tamil, hindi) with {place} slot ────────────
TEMPLATES = {
    "water": [
        ("No drinking water in {place} for the last 3 days.",
         "{place}ல மூணு நாளா குடிக்க தண்ணி வரலை.",
         "{place} में पिछले 3 दिनों से पीने का पानी नहीं आ रहा है।"),
        ("The public tap in {place} has been dry for weeks.",
         "{place} பொது குழாயில வாரக்கணக்கா தண்ணி இல்லை.",
         "{place} का सार्वजनिक नल कई हफ्तों से सूखा पड़ा है।"),
    ],
    "road": [
        ("The road in {place} is full of potholes, accidents happen daily.",
         "{place} ரோட்ல முழுக்க பள்ளம், தினமும் விபத்து.",
         "{place} की सड़क गड्ढों से भरी है, रोज़ दुर्घटनाएँ होती हैं।"),
        ("No proper road connectivity to {place}, buses can't come.",
         "{place}க்கு ஒழுங்கான ரோடு இல்லை, பஸ் வர முடியலை.",
         "{place} तक ठीक सड़क नहीं है, बसें नहीं आ पातीं।"),
    ],
    "housing": [
        ("We are eligible for a housing scheme but haven't received a house in {place}.",
         "{place}ல வீட்டு திட்டத்துக்கு தகுதி இருந்தும் வீடு கிடைக்கலை.",
         "{place} में हम आवास योजना के पात्र हैं पर घर नहीं मिला।"),
        ("House sanctioned in {place} but construction stalled for a year.",
         "{place}ல வீடு அனுமதி ஆனா ஒரு வருஷமா வேலை நிக்குது.",
         "{place} में घर स्वीकृत हुआ पर निर्माण एक साल से रुका है।"),
    ],
    "education": [
        ("The government school in {place} has a leaking roof and no teachers.",
         "{place} அரசு பள்ளியில கூரை ஒழுகுது, ஆசிரியர்களும் இல்லை.",
         "{place} के सरकारी स्कूल की छत टपकती है और शिक्षक नहीं हैं।"),
        ("Children in {place} travel 8 km to reach the nearest school.",
         "{place} குழந்தைகள் 8 கிமீ போய் பள்ளிக்கு போறாங்க.",
         "{place} के बच्चे नज़दीकी स्कूल के लिए 8 किमी चलते हैं।"),
    ],
    "health": [
        ("No PHC near {place}, ambulance takes over an hour.",
         "{place} பக்கத்துல ஆரம்ப சுகாதார நிலையம் இல்லை, ஆம்புலன்ஸ் ஒரு மணி நேரம் ஆகுது.",
         "{place} के पास कोई पीएचसी नहीं, एम्बुलेंस एक घंटे से ज़्यादा लेती है।"),
        ("Medicine stock-out at the {place} health centre.",
         "{place} சுகாதார நிலையத்தில மருந்து இல்லை.",
         "{place} स्वास्थ्य केंद्र में दवाइयाँ खत्म हैं।"),
    ],
    "jobs": [
        ("MGNREGA work demanded in {place} but not provided for months.",
         "{place}ல வேலை கேட்டும் பல மாசமா கொடுக்கலை.",
         "{place} में मनरेगा काम माँगा पर महीनों से नहीं मिला।"),
        ("Job card not issued to families in {place}.",
         "{place} குடும்பங்களுக்கு வேலை அட்டை கொடுக்கலை.",
         "{place} के परिवारों को जॉब कार्ड नहीं मिला।"),
    ],
    "pension": [
        ("Old-age pension not received in {place} for 6 months.",
         "{place}ல ஆறு மாசமா முதியோர் ஓய்வூதியம் வரலை.",
         "{place} में 6 महीने से वृद्धावस्था पेंशन नहीं आई।"),
        ("Widow pension application from {place} pending for a year.",
         "{place} விதவை ஓய்வூதிய விண்ணப்பம் ஒரு வருஷமா நிலுவையில.",
         "{place} का विधवा पेंशन आवेदन एक साल से लंबित है।"),
    ],
    "sanitation": [
        ("Sewage overflowing on the streets of {place}.",
         "{place} தெருக்களில கழிவுநீர் வழிஞ்சு ஓடுது.",
         "{place} की गलियों में सीवेज बह रहा है।"),
        ("No toilets built in {place}, open defecation continues.",
         "{place}ல கழிப்பறை கட்டலை, திறந்தவெளி கழிப்பு தொடருது.",
         "{place} में शौचालय नहीं बने, खुले में शौच जारी है।"),
    ],
}

# Index of each language within a template tuple
LANG_INDEX = {"en": 0, "ta": 1, "hi": 2}

URGENCIES = ["critical", "high", "medium", "low"]
CHANNELS = ["web", "telegram", "phone", "meeting"]


def load_geo():
    """Return (urban_names, fringe_names) from JSON files or fallback."""
    def names(path, fallback):
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                got = [d["name"] for d in data if d.get("name")]
                if got:
                    return got
            except Exception:
                pass
        return fallback
    urban = names(GEO_DIR / "urban_wards.json", FALLBACK_URBAN)
    fringe = names(GEO_DIR / "fringe_villages.json", FALLBACK_FRINGE)
    return urban, fringe


def generate(n: int, seed: int = 42):
    rng = random.Random(seed)
    urban, fringe = load_geo()
    now = datetime(2026, 7, 5, 12, 0, 0)  # fixed 'now' — deterministic
    cats = list(TEMPLATES.keys())
    out = []
    for i in range(n):
        # 65% urban wards, 35% rural fringe
        is_urban = rng.random() < 0.65
        place = rng.choice(urban if is_urban else fringe)
        category = rng.choice(cats)
        tpl = rng.choice(TEMPLATES[category])
        # language mix: 40% Tamil, 30% Hindi, 30% English
        r = rng.random()
        lang = "ta" if r < 0.40 else ("hi" if r < 0.70 else "en")
        text = tpl[LANG_INDEX[lang]].format(place=place)
        ts = now - timedelta(days=rng.randint(0, 21), hours=rng.randint(0, 23))
        out.append({
            "id": f"SYN-{i+1:04d}",
            "channel": rng.choice(CHANNELS),
            "language": lang,
            "raw_text": text,
            "place_name": place,
            "urban": is_urban,
            "true_category": category,          # for eval only
            "urgency_hint": rng.choice(URGENCIES),
            "created_at": ts.isoformat() + "Z",
            "synthetic": True,
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=300)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    data = generate(args.n, args.seed)
    out_path = OUT_DIR / "complaints.json"
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    # quick summary
    from collections import Counter
    cats = Counter(d["true_category"] for d in data)
    langs = Counter(d["language"] for d in data)
    urban = sum(d["urban"] for d in data)
    print(f"Wrote {len(data)} complaints -> {out_path}")
    print(f"  urban {urban} / fringe {len(data)-urban}")
    print(f"  languages: {dict(langs)}")
    print(f"  categories: {dict(cats)}")


if __name__ == "__main__":
    main()
