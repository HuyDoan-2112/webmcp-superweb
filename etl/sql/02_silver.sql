-- 02_silver.sql - the FX join lives here, and this is where rows are lost.
--
-- Two tables come out. fct_order_lines is what survived. rejected_order_lines
-- is what did not, kept rather than discarded so the counts behind a failed
-- check point at something real.

CREATE SCHEMA IF NOT EXISTS silver;

-- Every order line, with its order's date and currency attached, before any
-- conversion is attempted. This is the denominator the checks compare against.
CREATE OR REPLACE TABLE silver.order_lines_raw AS
SELECT
  r.OrderKey                              AS order_key,
  r.RowNumber                             AS line_number,
  r.ProductKey                            AS product_key,
  o.StoreKey                              AS store_key,
  o.CustomerKey                           AS customer_key,
  CAST(o.DT AS DATE)                      AS order_date,
  o.CurrencyCode                          AS currency_code,
  r.Quantity                              AS quantity,
  -- The discount is already applied inside NetPrice. There is no discount
  -- column in Contoso, so quantity * unit_price * (1 - discount) cannot be
  -- computed and would double count the reduction if it could.
  r.Quantity * r.NetPrice                 AS net_amount_local,
  r.Quantity * r.UnitCost                 AS cost_amount_local
FROM bronze.orderrows r
JOIN bronze.orders o ON o.OrderKey = r.OrderKey;

-- The conversion.
--
-- Direction matters and it is the opposite of the obvious guess. Contoso's own
-- sales.ExchangeRate is USD to local, and matching that way silently produces
-- numbers that look fine and are wrong. To reach USD we need the rate whose
-- FromCurrency is the order's currency and whose ToCurrency is USD, on the day
-- the order was placed. Rates move daily, so the lookup needs both keys.
--
-- An INNER join, on purpose. A line with no rate does not become zero and does
-- not raise an error. It stops being counted.
CREATE OR REPLACE TABLE silver.fct_order_lines AS
SELECT
  l.*,
  fx.Exchange                             AS fx_rate,
  l.net_amount_local  * fx.Exchange       AS net_amount_usd,
  l.cost_amount_local * fx.Exchange       AS cost_amount_usd
FROM silver.order_lines_raw l
JOIN bronze.currencyexchange fx
  ON  fx.Date         = l.order_date
  AND fx.FromCurrency = l.currency_code
  AND fx.ToCurrency   = 'USD';

-- What the join dropped. Same shape, no amounts, because there is no honest
-- way to state a USD figure for these lines. That is the entire problem.
CREATE OR REPLACE TABLE silver.rejected_order_lines AS
SELECT l.*
FROM silver.order_lines_raw l
LEFT JOIN bronze.currencyexchange fx
  ON  fx.Date         = l.order_date
  AND fx.FromCurrency = l.currency_code
  AND fx.ToCurrency   = 'USD'
WHERE fx.Exchange IS NULL;
