-- 01_bronze.sql - raw source tables, typed, otherwise unmodified.
--
-- One exception, at the bottom of this file, and it is deliberate. Read it.
--
-- ${SOURCE} is replaced by run.py with the absolute path to etl/source/parquet-1m.

CREATE SCHEMA IF NOT EXISTS bronze;

CREATE OR REPLACE TABLE bronze.orders AS
  SELECT * FROM read_parquet('${SOURCE}/orders.parquet');

CREATE OR REPLACE TABLE bronze.orderrows AS
  SELECT * FROM read_parquet('${SOURCE}/orderrows.parquet');

CREATE OR REPLACE TABLE bronze.currencyexchange AS
  SELECT * FROM read_parquet('${SOURCE}/currencyexchange.parquet');

CREATE OR REPLACE TABLE bronze.product AS
  SELECT * FROM read_parquet('${SOURCE}/product.parquet');

CREATE OR REPLACE TABLE bronze.store AS
  SELECT * FROM read_parquet('${SOURCE}/store.parquet');

CREATE OR REPLACE TABLE bronze.date AS
  SELECT * FROM read_parquet('${SOURCE}/date.parquet');

CREATE OR REPLACE TABLE bronze.customer AS
  SELECT * FROM read_parquet('${SOURCE}/customer.parquet');

-- sales.parquet is deliberately not loaded. It is a pre-joined denormalised
-- table that already carries CurrencyCode and ExchangeRate, so building from it
-- would make the FX join decorative. The whole point is that the join is load
-- bearing. See docs/adr/0001-keep-the-etl-real.md.


-- ---------------------------------------------------------------------------
-- THE PLANTED DEFECT
-- ---------------------------------------------------------------------------
--
-- Contoso ships complete FX coverage: all 25 ordered currency pairs across all
-- 3,653 days, 91,325 rows, no holes. Every one of the 2,098,633 order lines
-- finds a rate. So the failure this project exists to surface does not occur
-- on its own and has to be introduced.
--
-- It is introduced HERE, in bronze, immediately after load, rather than faked
-- later at the verdict layer. That ordering is the honest one. The pipeline
-- really loses the rows, the row counts really drop at the silver join, and
-- trace_lineage really walks a chain that broke. A verdict invented downstream
-- would be a lie that happens to render correctly.
--
-- 30 rows. One directed pair, one month. USD to EUR stays, and so do the other
-- 23 pairs, so a person browsing the table sees a plausibly populated feed with
-- one narrow hole in it. That is what an upstream feed failure looks like.

DELETE FROM bronze.currencyexchange
WHERE FromCurrency = 'EUR'
  AND ToCurrency   = 'USD'
  AND Date >= DATE '2023-11-01'
  AND Date <  DATE '2023-12-01';
