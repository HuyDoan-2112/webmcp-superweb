"""Orchestrates bronze to silver to gold, and writes data/meta on every run.

Offline. Runs on a laptop a handful of times during the build. The output is
committed: data/gold/*.parquet and data/meta/*.json.

A failed run is still a run the API has to be able to report on, so
pipeline_runs.json is written whether the checks pass or not.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb

from checks import run_checks

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "etl" / "source" / "parquet-1m"
SQL_DIR = ROOT / "etl" / "sql"
GOLD = ROOT / "data" / "gold"
META = ROOT / "data" / "meta"

DEMO_PERIOD = "2023-11"

GOLD_TABLES = [
    "fact_sales_daily",
    "fact_orders_daily",
    "dim_product",
    "dim_store",
    "dim_date",
]

STAGES = ["01_bronze.sql", "02_silver.sql", "03_gold.sql"]


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_sql(name: str) -> str:
    return (SQL_DIR / name).read_text().replace("${SOURCE}", SOURCE.as_posix())


def row_counts(con: duckdb.DuckDBPyConnection) -> dict[str, int]:
    counts = {}
    for table in [
        "bronze.orders",
        "bronze.orderrows",
        "bronze.currencyexchange",
        "silver.order_lines_raw",
        "silver.fct_order_lines",
        "silver.rejected_order_lines",
        *[f"gold.{t}" for t in GOLD_TABLES],
    ]:
        counts[table] = con.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
    return counts


def write_lineage(con: duckdb.DuckDBPyConnection, counts: dict[str, int]) -> None:
    """The stage-labelled chain, read from the dashboard metric upstream.

    The row counts are the real ones this run produced. They are the reason the
    ladder is worth showing: the drop at the transformation rung is measured,
    not asserted.
    """
    raw = counts["silver.order_lines_raw"]
    kept = counts["silver.fct_order_lines"]
    rejected = raw - kept

    lineage = {
        "metric": "net_revenue",
        "nodes": [
            {
                "node": "net_revenue",
                "stage": "dashboard metric",
                "summary": "The revenue figure on the dashboard.",
            },
            {
                "node": "gold.fact_sales_daily",
                "stage": "curated table",
                # Deliberately no rowsIn. This rung groups rows, it does not
                # lose them, and reporting a drop here would read as a second
                # failure next to the real one below.
                "rowsOut": counts["gold.fact_sales_daily"],
                "summary": "Daily totals, ready to read.",
            },
            {
                "node": "silver.fct_order_lines",
                "stage": "transformation",
                "rowsIn": raw,
                "rowsOut": kept,
                "failed": rejected > 0,
                "summary": (
                    "Where each order is converted into US dollars. "
                    f"{rejected:,} order lines were lost here."
                    if rejected
                    else "Where each order is converted into US dollars."
                ),
            },
            {
                "node": "bronze.currencyexchange",
                "stage": "warehouse",
                "rowsOut": counts["bronze.currencyexchange"],
                "summary": "The stored exchange rates, one per currency pair per day.",
            },
            {
                "node": "FX rate feed",
                "stage": "operational system",
                "summary": "The upstream system the rates arrive from.",
            },
        ],
    }
    (META / "lineage.json").write_text(json.dumps(lineage, indent=2) + "\n")


def main() -> int:
    if not SOURCE.exists():
        print(f"Source not found: {SOURCE}", file=sys.stderr)
        print("Download the Contoso V2 1M parquet tier first. See etl/README.md.", file=sys.stderr)
        return 1

    GOLD.mkdir(parents=True, exist_ok=True)
    META.mkdir(parents=True, exist_ok=True)

    run_id = f"run_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    started = utcnow()
    status = "failed"
    counts: dict[str, int] = {}
    checks: list[dict] = []

    con = duckdb.connect()
    try:
        for stage in STAGES:
            print(f"  {stage}")
            con.execute(load_sql(stage))

        counts = row_counts(con)

        for table in GOLD_TABLES:
            out = GOLD / f"{table}.parquet"
            con.execute(
                f"COPY gold.{table} TO '{out.as_posix()}' "
                "(FORMAT PARQUET, COMPRESSION ZSTD)"
            )

        checks = run_checks(con, DEMO_PERIOD)
        write_lineage(con, counts)
        status = "success"
    finally:
        finished = utcnow()

        (META / "quality_checks.json").write_text(
            json.dumps({"runId": run_id, "period": DEMO_PERIOD, "checks": checks}, indent=2) + "\n"
        )

        runs_path = META / "pipeline_runs.json"
        runs = json.loads(runs_path.read_text()) if runs_path.exists() else []
        runs.insert(
            0,
            {
                "id": run_id,
                "startedUtc": started,
                "finishedUtc": finished,
                "status": status,
                "rowCounts": counts,
                "checkNames": sorted({c["name"] for c in checks}),
            },
        )
        runs_path.write_text(json.dumps(runs[:20], indent=2) + "\n")
        con.close()

    raw = counts.get("silver.order_lines_raw", 0)
    kept = counts.get("silver.fct_order_lines", 0)
    print(f"\n{run_id} {status}")
    print(f"  order lines: {raw:,} in, {kept:,} out, {raw - kept:,} rejected")
    blocked = [c for c in checks if c["verdict"] == "blocked"]
    degraded = [c for c in checks if c["verdict"] == "degraded"]
    print(f"  checks: {len(checks)} evaluated, {len(blocked)} blocked, {len(degraded)} degraded")
    total = sum((GOLD / f"{t}.parquet").stat().st_size for t in GOLD_TABLES)
    print(f"  data/gold: {total / 1_000_000:.1f} MB")
    return 0 if status == "success" else 1


if __name__ == "__main__":
    raise SystemExit(main())
