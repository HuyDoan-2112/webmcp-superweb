# ETL - how to regenerate the data from scratch

Offline. Runs on a laptop, a handful of times during the build. The output is committed: `data/gold/*.parquet` and `data/meta/*.json`.

## Source

Contoso Data Generator V2, **1M-order tier**, MIT licensed. Download and unpack into `etl/source/` (gitignored). The "1M" is a rounded name: `orders` is 875,901 rows and `orderrows` is 2,098,633.

Eight flat parquet files come out of the archive. One of them, `sales.parquet`, is a pre-joined denormalised table that already carries `CurrencyCode` and `ExchangeRate`. **Do not build from it.** The defect needs the `orders` + `orderrows` + `currencyexchange` join to be load bearing, and a pre-joined table removes the join we are demonstrating. Use it as a cross-check and nothing else.

## Run

```bash
python -m venv .venv
```

```bash
source .venv/bin/activate       # .venv/Scripts/activate on Windows
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
| `sql/01_bronze.sql` | bronze | raw source tables, typed, then 30 EUR rate rows deleted - **the demo defect, planted on purpose** |
| `sql/02_silver.sql` | silver | `fct_order_lines` - **the FX join lives here** |
| `sql/03_gold.sql` | gold | `fact_sales_daily`, `fact_orders_daily` and the three dimension tables |

Gold trims every dimension value on the way out, because the source carries
trailing whitespace on some of them and `"Litware "` splits a facet in two.

`dim_product` also carries `family_name` and `family_key`, which the source does
not. The family is the product name with its trailing colour removed, so the
2,517 rows collapse to 885 products. Contoso ships one row per colourway and a
nine-colour camera is nine rows at one identical price, which reads as a
duplicated catalogue rather than a range. `/api/products` groups on `family_key`;
only 27 families carry more than one distinct price.

`checks.py` runs after gold and writes `data/meta/quality_checks.json`. `run.py` writes `data/meta/pipeline_runs.json` on every run, whether it passes or not - a failed run is still a run the API has to be able to report on.

## The planted defect

FX coverage in the source is a complete 25-pair by 3,653-day cross product with no holes, and all 2,098,633 order lines match. Nothing fails on its own, so the failure is made:

```sql
DELETE FROM bronze.currencyexchange
WHERE FromCurrency = 'EUR' AND ToCurrency = 'USD'
  AND Date >= '2023-11-01' AND Date < '2023-12-01';
-- 30 rows
```

Only the `EUR -> USD` direction. `USD -> EUR` and the other 23 pairs stay, so the table still looks plausibly populated to anyone browsing it. One directed pair, one month, which is what a real upstream feed failure looks like.

This runs at the end of `01_bronze.sql`, immediately after load, under a loud comment. It has to happen there rather than at the verdict layer, because `pipeline_runs.json` and `quality_checks.json` have to describe a failure that really occurred. A hand-authored verdict is set dressing and `trace_lineage` pointing at it is worth nothing. See `docs/adr/0003-the-fx-gap-is-planted.md`.

## Traps in the source

Four things are not what a first guess produces. Each one produces wrong numbers rather than an error, which is why they are written down here.

**The order date is `orders.DT`.** Not `OrderDate`. Column names are PascalCase throughout the source; the gold tables we write are snake_case.

**There is no discount column.** `orderrows` carries `Quantity`, `UnitPrice`, `NetPrice` and `UnitCost`. The discount is already inside `NetPrice`, on 1,282,514 of 2,098,633 lines, at a mean ratio of 0.9408. The net amount is `Quantity * NetPrice`, full stop.

**The rate direction is backwards from the obvious guess.** Contoso's own `sales.ExchangeRate` is USD to local. Converting *to* USD therefore joins on `FromCurrency = CurrencyCode, ToCurrency = 'USD'`, and `amount_usd = amount_local * Exchange`. Getting this the wrong way round returns a rate for every row and silently scales the whole dashboard. Comment it in `sql/02_silver.sql`.

**There is no channel column.** Nowhere in the eight tables. The only proxy is the single online store, `store.CountryCode = '--'`, against every physical store. Silver derives `channel` from that, which is what `shared/metrics.ts` advertises.

## Currency denomination

Amounts in `orderrows` are USD-denominated in the source. `avg(UnitPrice / product.Price)` sits at about 1.15 to 1.18 for every currency including USD; if the amounts were local, EUR and GBP would sit near 0.9 and 0.8. So `CurrencyCode` records the currency the customer paid in, not the denomination of the stored number.

**Silver declares the amounts to be local currency and converts them through the FX join anyway.** This is a deliberate choice over the alternative of keeping them as USD and converting the other way for the regional sections. Synthetic data for a fictional company has no ground truth to contradict, it matches the transform text the metric registry already publishes, and it keeps the FX join load bearing: no rate, no `net_amount_usd`, the line drops. That last property is the whole demo.

## Period

The demo period is **`2023-11`**, which is also `DEMO_PERIOD` in `shared/metrics.ts`.

`orders.DT` runs 2015-01-01 to 2024-04-20, while `currencyexchange.Date` and `date.Date` both run to 2024-12-31. FX over-covering orders by eight months is the structural reason no natural gap exists.

**Nothing after 2024-01 is usable.** The generator's tail thins before the hard stop: 2024-03 is roughly half of 2024-02, and 2024-04 is a partial month. A period comparison across the thinning tail measures the generator, not the business.

## Metadata written every run

- `pipeline_runs.json` - run id, timestamps, status, row counts per stage
- `quality_checks.json` - per check: name, metric, period, verdict, detail
- `lineage.json` - the stage-labelled chain, one entry per node

## Size budget

`data/gold/` must stay under ~50 MB. It is pulled into the serverless function bundle, which is capped. As committed, the fact at date x store x currency x category x subcategory is 21,005,105 bytes over 1,282,911 rows, and the whole of `data/gold/` is 21,619,650 bytes. That leaves about 28 MB of headroom.

Daily grain aggregates poorly here: 1.28M fact rows against 2.10M source lines is only a 1.6x reduction. If the budget tightens, coarsen to category only or move the fact to monthly grain. Do not drop dimensions the registry advertises.

If it grows past the cap anyway, host the parquet as a static asset and read it over HTTP instead of bundling it.

## Verified before `shared/types.ts` was written

Answered 2026-08-29 against the extracted source. Kept rather than deleted, because the record of what was checked is worth more than a tidy list.

- **Does the source carry a currency code on orders, with non-USD rows?** Yes. `orders.CurrencyCode`, five values. Non-USD is 47.84% of orders: EUR 20.82%, GBP 10.63%, CAD 10.42%, AUD 5.96%.
- **What date range does the 1M tier actually cover?** `orders.DT`, 2015-01-01 to 2024-04-20. See Period above.
- **Confirm the real column names in the Orders / OrderRows variant.** `orders` is `OrderKey`, `CustomerKey`, `StoreKey`, `DT`, `DeliveryDate`, `CurrencyCode`. `orderrows` is `OrderKey`, `RowNumber`, `ProductKey`, `Quantity`, `UnitPrice`, `NetPrice`, `UnitCost`, and carries neither a date nor a currency - both come from `orders` via `OrderKey`. `currencyexchange` is `Date`, `FromCurrency`, `ToCurrency`, `Exchange`.
