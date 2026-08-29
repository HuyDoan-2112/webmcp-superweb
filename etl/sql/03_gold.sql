-- 03_gold.sql - what the API reads.
--
-- Two facts at two grains, and three dimensions. The second fact exists because
-- one order covers several products, so order_count cannot be answered from a
-- table that has been split by category. See the `grain` field in
-- shared/metrics.ts.

CREATE SCHEMA IF NOT EXISTS gold;

-- Contoso pads several text columns with trailing spaces. Left alone they split
-- a dimension into members that look identical on screen and group separately:
-- 15 distinct brands that are really 11, and the same for category and
-- subcategory. Every text column that can become a dimension value is trimmed
-- here, once, rather than defensively at each read site.

-- Store, with the channel derivation.
--
-- Contoso has no channel column. It has 74 stores, 73 physical and one whose
-- country code is '--', which is the online store. That store is about 39 per
-- cent of all orders and is the only one carrying more than one currency, so
-- the derivation is worth making explicit rather than leaving to a filter.
CREATE OR REPLACE TABLE gold.dim_store AS
SELECT
  StoreKey                                              AS store_key,
  StoreCode                                             AS store_code,
  trim(CountryCode)                                     AS country_code,
  CASE WHEN CountryCode = '--' THEN 'Online'
       ELSE trim(CountryName) END                       AS country_name,
  CASE WHEN CountryCode = '--' THEN 'Online'
       ELSE 'Store' END                                 AS channel,
  trim(State)                                           AS state,
  CASE WHEN CountryCode = '--' THEN 'Kestrel Online'
       ELSE trim(Description) END                       AS description,
  SquareMeters                                          AS square_meters,
  trim(Status)                                          AS status
FROM bronze.store;

CREATE OR REPLACE TABLE gold.dim_date AS
SELECT
  CAST(Date AS DATE)  AS date_key,
  Year                AS year,
  YearMonth           AS year_month,
  MonthNumber         AS month_number,
  MonthShort          AS month_short,
  DayofWeekShort      AS day_of_week,
  WorkingDay          AS working_day
FROM bronze.date;

-- The product catalogue, at product grain. This is what the public surface
-- lists, so it carries price but never cost.
CREATE OR REPLACE TABLE gold.dim_product AS
SELECT
  ProductKey        AS product_key,
  ProductCode       AS product_code,
  trim(ProductName)     AS product_name,
  trim(Brand)           AS brand,
  trim(Manufacturer)    AS manufacturer,
  trim(Color)           AS color,
  Weight            AS weight,
  WeightUnit        AS weight_unit,
  Price             AS price,
  CategoryKey       AS category_key,
  trim(CategoryName)    AS category_name,
  SubCategoryKey    AS subcategory_key,
  trim(SubCategoryName) AS subcategory_name,
  -- Contoso ships one SKU per colourway, so a nine-colour camera is nine rows
  -- with one price between them. Left ungrouped the catalogue reads as padding.
  -- The family is the name with its trailing colour removed, which collapses
  -- 2,517 rows into 885 real products without hiding anything: price, code and
  -- key stay on the variant.
  trim(
    CASE
      WHEN trim(ProductName) LIKE '%' || trim(Color)
        THEN left(trim(ProductName), length(trim(ProductName)) - length(trim(Color)))
      ELSE replace(trim(ProductName), trim(Color), '')
    END
  )                     AS family_name,
  md5(
    trim(
      CASE
        WHEN trim(ProductName) LIKE '%' || trim(Color)
          THEN left(trim(ProductName), length(trim(ProductName)) - length(trim(Color)))
        ELSE replace(trim(ProductName), trim(Color), '')
      END
    ) || '|' || trim(Brand) || '|' || trim(SubCategoryName)
  )                     AS family_key
FROM bronze.product;

-- The sales fact.
--
-- Grain: order date, store, currency, category, subcategory, brand. The three
-- product attributes sit on the fact rather than behind a key, because the fact
-- is not at product grain and a join back to dim_product would be wrong.
-- Parquet dictionary encoding makes the repeated strings close to free.
CREATE OR REPLACE TABLE gold.fact_sales_daily AS
SELECT
  l.order_date                      AS date_key,
  l.store_key                       AS store_key,
  l.currency_code                   AS currency_code,
  p.CategoryKey                     AS category_key,
  trim(p.CategoryName)              AS category_name,
  p.SubCategoryKey                  AS subcategory_key,
  trim(p.SubCategoryName)           AS subcategory_name,
  trim(p.Brand)                     AS brand,
  SUM(l.quantity)                   AS quantity,
  SUM(l.net_amount_usd)             AS net_amount_usd,
  SUM(l.cost_amount_usd)            AS cost_amount_usd,
  COUNT(*)                          AS line_count
FROM silver.fct_order_lines l
JOIN bronze.product p ON p.ProductKey = l.product_key
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;

-- The orders fact.
--
-- An order is counted once, at the grain it actually exists at. An order whose
-- every line lost its rate disappears here too, which is correct: nothing of it
-- survived the pipeline.
CREATE OR REPLACE TABLE gold.fact_orders_daily AS
SELECT
  l.order_date                      AS date_key,
  l.store_key                       AS store_key,
  l.currency_code                   AS currency_code,
  COUNT(DISTINCT l.order_key)       AS order_count
FROM silver.fct_order_lines l
GROUP BY 1, 2, 3;
