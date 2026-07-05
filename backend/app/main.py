"""
Constituency Intelligence Engine — FastAPI service.
Track 1 · Build with AI: Code for Communities · Coimbatore.

Entry point. The 12-step pipeline lives under app/pipeline/ (added incrementally).
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(
    title="Constituency Intelligence Engine",
    description="AI decision-support for constituency development planning (Coimbatore).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before any real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Liveness probe for Cloud Run."""
    return {
        "status": "ok",
        "service": "constituency-intelligence-engine",
        "constituency": settings.constituency,
        "project": settings.gcp_project_id,
    }


from app.pipeline import intake, closeloop
from app import api

app.include_router(intake.router, prefix="/api")
app.include_router(closeloop.router, prefix="/api")
app.include_router(api.router, prefix="/api")
