"""BigQuery data-access layer.

Reads project/dataset/location from the environment (GCP_PROJECT_ID, BQ_DATASET,
and optionally BQ_LOCATION / VERTEX_LOCATION) via python-dotenv. Auth uses gcloud
Application Default Credentials.

Run a connectivity check from backend/:

    python -m app.store.bq --check
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "gemini-enterprise-475109")
DATASET = os.getenv("BQ_DATASET", "constituency")
LOCATION = os.getenv("BQ_LOCATION") or os.getenv("VERTEX_LOCATION") or "asia-south1"

_ADC_HELP = (
    "BigQuery credentials (Application Default Credentials) are missing or invalid.\n"
    "Run the following, then retry:\n"
    "  gcloud auth application-default login\n"
    f"  gcloud auth application-default set-quota-project {PROJECT_ID}"
)

_client = None


def client():
    """Return a lazily-created, module-level bigquery.Client."""
    global _client
    if _client is None:
        # Auth is via ADC. If GOOGLE_APPLICATION_CREDENTIALS points at a
        # missing service-account file, drop it so google-auth uses ADC.
        gac = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if gac and not os.path.exists(gac):
            os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

        from google.cloud import bigquery

        _client = bigquery.Client(project=PROJECT_ID, location=LOCATION)
    return _client


def _fqn(table: str) -> str:
    """Fully-qualify a bare table name as `project.dataset.table`."""
    if table.count(".") >= 2:
        return table
    if "." in table:
        return f"{PROJECT_ID}.{table}"
    return f"{PROJECT_ID}.{DATASET}.{table}"


import time

# In-process TTL cache for read queries. Analytics tables change only when the
# batch job reruns, so caching identical SELECTs avoids a BigQuery round-trip
# (~1-2s) on every page load / navigation. Live queries pass cache=False.
_CACHE: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL = float(os.getenv("BQ_CACHE_TTL", "180"))  # seconds


def query(sql: str, cache: bool = True) -> list[dict]:
    """Run SQL and return rows as a list of dicts.

    Results are cached in-process for BQ_CACHE_TTL seconds (default 180) unless
    ``cache=False`` — pass that for queries whose freshness matters (e.g. live
    citizen submissions) so they always hit BigQuery.
    """
    if cache and _CACHE_TTL > 0:
        hit = _CACHE.get(sql)
        if hit and (time.time() - hit[0]) < _CACHE_TTL:
            return hit[1]
    try:
        job = client().query(sql)
        rows = [dict(row.items()) for row in job.result()]
    except Exception as exc:  # noqa: BLE001
        raise _wrap(exc)
    if cache and _CACHE_TTL > 0:
        _CACHE[sql] = (time.time(), rows)
    return rows


def insert_rows(table: str, rows: list[dict]) -> None:
    """Append JSON rows into dataset.table (WRITE_APPEND, autodetect schema)."""
    if not rows:
        return
    from google.cloud import bigquery

    cfg = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        autodetect=True,
    )
    try:
        job = client().load_table_from_json(rows, _fqn(table), job_config=cfg)
        job.result()
    except Exception as exc:  # noqa: BLE001
        raise _wrap(exc)


def replace_table(table: str, rows: list[dict]) -> None:
    """Replace dataset.table contents with rows (WRITE_TRUNCATE, autodetect)."""
    from google.cloud import bigquery

    cfg = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        autodetect=True,
    )
    try:
        job = client().load_table_from_json(rows, _fqn(table), job_config=cfg)
        job.result()
    except Exception as exc:  # noqa: BLE001
        raise _wrap(exc)


def count(table: str) -> int:
    """Return the row count of dataset.table."""
    rows = query(f"SELECT COUNT(*) AS n FROM `{_fqn(table)}`")
    return int(rows[0]["n"])


def _wrap(exc: Exception) -> Exception:
    """Return a friendly error for auth/ADC problems, else the original."""
    from google.auth.exceptions import (
        DefaultCredentialsError,
        RefreshError,
    )

    if isinstance(exc, (DefaultCredentialsError, RefreshError)):
        return RuntimeError(_ADC_HELP)
    msg = str(exc).lower()
    if any(k in msg for k in ("credential", "reauth", "quota project", "unauthenticated")):
        return RuntimeError(_ADC_HELP)
    return exc


def _check() -> int:
    for table in ("complaints_synthetic", "census_coimbatore_villages"):
        try:
            print(f"{table}: {count(table)}")
        except Exception as exc:  # noqa: BLE001
            print(str(exc))
            return 1
    return 0


if __name__ == "__main__":
    import sys

    if "--check" in sys.argv:
        raise SystemExit(_check())
    print(__doc__)
