# BigQuery schemas

One BigQuery JSON schema file per table, mirroring the data contract in
`backend/app/schema.py`. Each file is an array of `{name, type, mode}` objects.

| Table | Schema file | Source model |
|-------|-------------|--------------|
| `submissions` | `submissions.json` | `Submission` |
| `demand_records` | `demand_records.json` | `DemandRecord` |
| `scheme_gaps` | `scheme_gaps.json` | `SchemeGap` |
| `ranked_projects` | `ranked_projects.json` | `RankedProject` |
| `silent_villages` | `silent_villages.json` | `SilentVillage` |

Type mapping: `str→STRING`, `int→INTEGER`, `float→FLOAT`, `datetime→TIMESTAMP`,
`bool→BOOLEAN`, `dict→JSON`. Fields required by the pydantic models (no default)
are `REQUIRED`; optional / defaulted fields are `NULLABLE`.

## Setup script

`backend/app/ingestion/bq_setup.py` creates the dataset (if absent) and each
table from its schema JSON. It is idempotent (`exists_ok=True`), so re-running is
safe.

### Environment

| Var | Default | Purpose |
|-----|---------|---------|
| `GCP_PROJECT_ID` | `gemini-enterprise-475109` | Target project |
| `BQ_DATASET` | `constituency` | Dataset name |
| `GCP_REGION` | `asia-south1` | Dataset location |

### Dry run (no credentials needed)

Prints the dataset and 5 tables it *would* create — no GCP calls:

```bash
cd backend
python -m app.ingestion.bq_setup --dry-run
```

### Real run (needs a GCP service account)

Requires `google-cloud-bigquery` and Application Default Credentials, e.g. a
service-account key:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export GCP_PROJECT_ID=your-project        # optional overrides
export BQ_DATASET=constituency
export GCP_REGION=asia-south1

cd backend
python -m app.ingestion.bq_setup
```

The service account needs BigQuery Data Editor (create tables) and BigQuery User
(create datasets / run jobs) on the project.
