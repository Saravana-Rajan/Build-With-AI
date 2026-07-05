"""
Idempotent BigQuery bootstrap: create the dataset and one table per schema JSON.

Schema JSON files live in ``data/schemas/`` (BigQuery JSON schema format — an
array of ``{name, type, mode}`` objects). This script mirrors the data contract
in ``backend/app/schema.py``.

Usage:
    python -m app.ingestion.bq_setup            # create dataset + tables (needs creds)
    python -m app.ingestion.bq_setup --dry-run  # print the plan; no creds needed

Environment:
    GCP_PROJECT_ID   target project   (default: gemini-enterprise-475109)
    BQ_DATASET       dataset name     (default: constituency)
    GCP_REGION       dataset location (default: asia-south1)
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

# One entry per table: logical table name -> schema JSON filename.
TABLES = {
    "submissions": "submissions.json",
    "demand_records": "demand_records.json",
    "scheme_gaps": "scheme_gaps.json",
    "ranked_projects": "ranked_projects.json",
    "silent_villages": "silent_villages.json",
}

# repo_root/data/schemas  (this file is repo_root/backend/app/ingestion/bq_setup.py)
SCHEMA_DIR = Path(__file__).resolve().parents[3] / "data" / "schemas"


def _config() -> dict:
    return {
        "project": os.environ.get("GCP_PROJECT_ID", "gemini-enterprise-475109"),
        "dataset": os.environ.get("BQ_DATASET", "constituency"),
        "location": os.environ.get("GCP_REGION", "asia-south1"),
    }


def _load_schema(filename: str) -> list[dict]:
    with open(SCHEMA_DIR / filename, "r", encoding="utf-8") as fh:
        return json.load(fh)


def dry_run() -> None:
    cfg = _config()
    print("DRY RUN — no BigQuery calls, no credentials required.\n")
    print(f"Would ensure dataset : {cfg['project']}.{cfg['dataset']}")
    print(f"          location   : {cfg['location']}\n")
    print(f"Would create {len(TABLES)} tables (from {SCHEMA_DIR}):")
    for name, filename in TABLES.items():
        schema = _load_schema(filename)
        print(f"  - {cfg['project']}.{cfg['dataset']}.{name}  ({len(schema)} fields)")


def apply() -> None:
    from google.cloud import bigquery

    cfg = _config()
    client = bigquery.Client(project=cfg["project"])

    # Dataset (idempotent).
    dataset_id = f"{cfg['project']}.{cfg['dataset']}"
    dataset = bigquery.Dataset(dataset_id)
    dataset.location = cfg["location"]
    dataset = client.create_dataset(dataset, exists_ok=True)
    print(f"Dataset ready: {dataset_id} ({dataset.location})")

    # Tables (idempotent).
    for name, filename in TABLES.items():
        schema = [
            bigquery.SchemaField(f["name"], f["type"], mode=f.get("mode", "NULLABLE"))
            for f in _load_schema(filename)
        ]
        table_id = f"{dataset_id}.{name}"
        table = bigquery.Table(table_id, schema=schema)
        client.create_table(table, exists_ok=True)
        print(f"Table ready: {table_id} ({len(schema)} fields)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap BigQuery dataset + tables.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the planned dataset + tables without contacting GCP.",
    )
    args = parser.parse_args()

    if args.dry_run:
        dry_run()
    else:
        apply()


if __name__ == "__main__":
    main()
