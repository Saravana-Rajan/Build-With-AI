"""Batch jobs.

Offline pipelines that (re)build the dashboard's analytics tables in BigQuery
from the real Census + synthetic complaint inputs. Run from `backend/`:

    python -m app.jobs.build_analytics
"""
