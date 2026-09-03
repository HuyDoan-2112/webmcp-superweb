# Rebuild the data

The ETL runs offline and writes the files committed under `data/gold/` and
`data/meta/`. Production functions read those files in place. They do not run
the pipeline.

## Source data

Use the 1M-order tier from Contoso Data Generator V2. Despite the tier name,
the source contains 875,901 orders and 2,098,633 order lines.

Extract its parquet files to:

```text
etl/source/parquet-1m/
```

The directory is gitignored. The archive includes `sales.parquet`, a
denormalized table that already contains currency and exchange-rate fields. The
pipeline does not load it because that would bypass the FX join being tested.

## Run the pipeline

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r etl/requirements.txt
python etl/run.py
```

On Windows, activate the environment with `.venv/Scripts/activate`.

`run.py` executes three SQL files in order:

| File | Output |
| --- | --- |
| `sql/01_bronze.sql` | Typed source tables and the deliberate 30-row FX deletion |
| `sql/02_silver.sql` | Raw, accepted, and rejected order lines |
| `sql/03_gold.sql` | Daily facts plus product, store, and date dimensions |

After SQL completes, `checks.py` writes the scoped quality checks. `run.py`
writes lineage and adds a pipeline-run record even when the run fails.

## The deliberate FX gap

Contoso contains a complete 25-pair by 3,653-day exchange-rate grid. Every
source order line finds a rate, so the failure used by the demo does not occur
naturally.

`sql/01_bronze.sql` removes one directed pair for one month:

```sql
DELETE FROM bronze.currencyexchange
WHERE FromCurrency = 'EUR'
  AND ToCurrency = 'USD'
  AND Date >= DATE '2023-11-01'
  AND Date < DATE '2023-12-01';
```

The silver join then rejects 7,831 of November's 31,084 order lines. Germany,
France, Italy, and the Netherlands lose every line. The Online slice loses
4,788 of 18,831 lines.

The deletion belongs in bronze because every later artifact must describe a
failure the pipeline actually produced. A verdict typed directly into JSON
would not reproduce the missing rows or the lineage break. See
[ADR 0003](../docs/adr/0003-the-fx-gap-is-planted.md).

## Currency assumption

Contoso stores the order-row amounts in USD. `CurrencyCode` records the currency
used by the customer, not the denomination of `UnitPrice`, `NetPrice`, and
`UnitCost`.

This pipeline deliberately treats those amounts as local currency and converts
them through the FX join. That assumption creates the stage the demo needs to
fail. It also means the dashboard's dollar values are not the original Contoso
dollar values.

The rejected-row counts and trust verdicts are real consequences of the join.
The denomination beneath that join is a modeling choice. A production pipeline
would need genuinely local amounts or a different completeness failure.

## Source details that affect the result

### Order date

The order date is `orders.DT`. Source columns use PascalCase. Gold columns use
snake case.

### Discounts

`orderrows` has no discount column. `NetPrice` already contains the discount.
Net revenue therefore starts with `Quantity * NetPrice`.

### Rate direction

To convert an order amount to USD, silver joins on the order date plus:

```text
FromCurrency = orders.CurrencyCode
ToCurrency   = USD
```

The conversion multiplies the local amount by `Exchange`.

### Channel

The source has no channel column. The store whose `CountryCode` is `--` becomes
the Online channel. Every other store becomes Store.

### Text values

Several source dimensions contain trailing spaces. Gold trims every text field
that can become a dimension value so names such as `Litware` do not split into
two facets.

## Product families

Contoso stores one product row per colourway. Gold derives `family_name` by
removing the trailing colour from `ProductName`, then hashes the family name,
brand, and subcategory into `family_key`.

That reduces 2,517 variants to 885 families. `/api/products` groups on the
family key, while each colourway keeps its own product key, code, price, and
photo. Only 27 families contain more than one distinct price.

## Metrics and grain

`fact_sales_daily` is grouped by date, store, currency, category, subcategory,
and brand. It supports revenue, profit, margin, units, and order-line metrics.

`fact_orders_daily` is grouped by date, store, and currency. `order_count` uses
this table because one order can contain several products and cannot be assigned
to one category or brand.

## Generated files

| Path | Contents |
| --- | --- |
| `data/gold/*.parquet` | Two daily fact tables and three dimensions |
| `data/meta/quality_checks.json` | Metric, period, filter, verdict, and rejected-row counts |
| `data/meta/lineage.json` | Stage-labelled chain for `net_revenue` |
| `data/meta/pipeline_runs.json` | Run timestamps, status, row counts, and check names |

`data/meta/catalog-products.json` is hand-authored and survives an ETL run.
Validate it separately:

```bash
node docs/validate-catalog.mjs
```

## Period and size limits

The demo period is `2023-11`, also defined as `DEMO_PERIOD` in
`shared/metrics.ts`.

Orders run from 2015-01-01 through 2024-04-20. March 2024 is already much
smaller than February, and April is partial. Do not use the thinning 2024 tail
for period comparisons.

The committed gold data is about 21.6 MB. Keep it below roughly 50 MB for the
Vercel function bundle. If the fact grows too large, reduce its grain or serve
the parquet from an external object store without removing dimensions the
metric registry advertises.
