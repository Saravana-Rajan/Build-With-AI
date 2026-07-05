# Root Dockerfile for Cloud Build (build context = repo root).
# Builds the FastAPI backend. Cloud Run injects $PORT (default 8080).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Runtime data files. Modules resolve these via parents[3]/data/... which,
# with backend/ copied to /app, evaluates to /data inside the container.
COPY data /data

CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
