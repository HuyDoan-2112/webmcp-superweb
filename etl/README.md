# ETL — how to regenerate the data from scratch

Offline. Runs on a laptop, a handful of times during the build. The output is committed: `data/gold/*.parquet` and `data/meta/*.json`.

## Source

Contoso Data Generator V2, **1M-order tier**, MIT licensed. Download and unpack into `etl/source/` (gitignored).

## Run

```bash
python -m venv .venv
```

```bash
source .venv/Scripts/activate
```

```bash
pip install -r etl/requirements.txt
```

```bash
python etl/run.py
```

## Stages

| File | Stage | Produces |
|---|---|---|
| `sql/01_bronze.sql` | bronze | raw source tables, typed, unmodified |
| `sql/02_silver.sql` | silver | `fct_order_lines` — **the FX join lives here** |
| `sql/03_gold.sql` | gold | `fact_sales_daily` plus the three dimension tables |

`checks.py` runs after gold and writes `data/meta/quality_checks.json`. `run.py` writes `data/meta/pipeline_runs.json` on every run, whether it passes or not — a failed run is still a run the API has to be able to report on.

## Metadata written every run

- `pipeline_runs.json` — run id, timestamps, status, row counts per stage
- `quality_checks.json` — per check: name, metric, period, verdict, detail
- `lineage.json` — the stage-labelled chain, one entry per node

## Size budget

`data/gold/` must stay under ~50 MB. It is pulled into the serverless function bundle, which is capped. If it grows past that, host the parquet as a static asset and read it over HTTP instead of bundling it.

## Verify before `shared/types.ts` is written

- Does the source carry a currency code on orders, with non-USD rows?
- What date range does the 1M tier actually cover?
- Confirm the real column names in the Orders / OrderRows variant.
