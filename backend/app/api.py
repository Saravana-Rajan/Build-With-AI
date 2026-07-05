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
    return bq.query(
        f"SELECT * FROM `{DS}.complaints_synthetic` ORDER BY created_at DESC LIMIT {limit}")


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


@router.get("/unified-issues")
def unified_issues(limit: int = Query(100, le=500)):
    """Deduplicated issues (may be empty until the dedup job runs)."""
    try:
        return bq.query(
            f"SELECT * FROM `{DS}.unified_issues` ORDER BY report_count DESC LIMIT {limit}")
    except Exception:
        return []
