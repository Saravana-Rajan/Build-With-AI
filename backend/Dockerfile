# Constituency Intelligence Engine — backend (Cloud Run)
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# System deps for reportlab / numpy wheels are already covered by slim + wheels.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run injects $PORT (default 8080). App must listen on 0.0.0.0:$PORT.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
