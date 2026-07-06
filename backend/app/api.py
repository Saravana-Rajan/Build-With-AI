"""
Dashboard read-API — the 5 screens read these endpoints (all served from BigQuery).
"""
from fastapi import APIRouter, Query
from app.store import bq
from app.config import settings

router = APIRouter()
DS = settings.bq_dataset


@router.get("/stats")
def stats():
    """Headline numbers for the dashboard header."""
    def one(sql, default=0):
        try:
            rows = bq.query(sql)
            return list(rows[0].values())[0] if rows else default
        except Exception:
            return default
    return {
        "constituency": settings.constituency,
        "complaints": one(f"SELECT COUNT(*) FROM `{DS}.complaints_synthetic`"),
        "rupees_owed": one(f"SELECT SUM(gap_value) FROM `{DS}.scheme_gaps`"),
        "silent_villages": one(
            f"SELECT COUNT(*) FROM `{DS}.silent_villages` WHERE flagged = true"),
        "real_villages": one(f"SELECT COUNT(*) FROM `{DS}.census_coimbatore_villages`"),
    }


@router.get("/demands")
def demands(limit: int = Query(50, le=500)):
    """Intake feed: LIVE citizen submissions first, then the seeded corpus.

    Live petitions (Telegram / Scan-a-Petition) are written to `demand_records`
    by the intake pipeline; the seeded + real-news corpus lives in
    `complaints_synthetic`. Merge them so a complaint a citizen just sent shows
    at the top of the MP's Intake feed, mapped into the same row shape.
    """
    try:
        syn = bq.query(
            f"SELECT * FROM `{DS}.complaints_synthetic` ORDER BY created_at DESC LIMIT {limit}")
        # Normalise to a single `urgency` field (synthetic uses `urgency_hint`).
        for r in syn:
            if "urgency" not in r or r.get("urgency") is None:
                r["urgency"] = r.get("urgency_hint")
    except Exception:
        syn = []

    live = []
    try:
        rows = bq.query(
            f"SELECT id, raw_text, place_name, urban, category, source, language, urgency, "
            f"CAST(created_at AS STRING) AS created_at "
            f"FROM `{DS}.demand_records` ORDER BY created_at DESC LIMIT 50")
        for r in rows:
            live.append({
                "id": r.get("id"),
                "raw_text": r.get("raw_text"),
                "place_name": r.get("place_name"),
                "urban": r.get("urban"),
                "true_category": r.get("category"),
                "channel": r.get("source"),
                "language": r.get("language"),
                "urgency": r.get("urgency"),
                "created_at": r.get("created_at"),
                "live": True,  # genuine live citizen submission (distinct from
                # complaints_synthetic.is_real, which means "sourced from news")
            })
    except Exception:
        live = []

    return (live + syn)[:limit]


@router.get("/scheme-gaps")
def scheme_gaps(limit: int = Query(100, le=500)):
    return bq.query(
        f"SELECT * FROM `{DS}.scheme_gaps` ORDER BY gap_value DESC LIMIT {limit}")


@router.get("/ranked-projects")
def ranked_projects(limit: int = Query(50, le=500)):
    return bq.query(
        f"SELECT * FROM `{DS}.ranked_projects` ORDER BY priority_score DESC LIMIT {limit}")


@router.get("/silent-villages")
def silent_villages(limit: int = Query(50, le=500)):
    return bq.query(
        f"SELECT * FROM `{DS}.silent_villages` WHERE flagged = true "
        f"ORDER BY silent_score DESC LIMIT {limit}")


@router.get("/departments")
def departments(limit: int = Query(50, le=500)):
    """Per-department accountability summary, biggest ₹ gap first."""
    try:
        return bq.query(
            f"SELECT * FROM `{DS}.department_summary` "
            f"ORDER BY total_gap_value DESC LIMIT {limit}")
    except Exception:
        return []


@router.get("/unified-issues")
def unified_issues(limit: int = Query(100, le=500)):
    """Deduplicated issues (may be empty until the dedup job runs)."""
    try:
        return bq.query(
            f"SELECT * FROM `{DS}.unified_issues` ORDER BY report_count DESC LIMIT {limit}")
    except Exception:
        return []
