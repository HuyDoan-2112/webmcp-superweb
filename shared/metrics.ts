// shared/metrics.ts - the metric registry.
//
// One definition per metric, in one place. api/_lib/compose.ts builds SQL from
// `sql` and `grain`. src/mcp/ builds tool inputSchema enums from the ids. If a
// metric is not here, nothing can ask for it.
//
// Column names below match the gold tables the ETL writes, not the Contoso
// source. Source columns are PascalCase and the order date is `orders.DT`.
//
// Changing this file means saying so out loud first. See CLAUDE.md.

import type { Dimension, DimensionId, Metric, MetricId } from "./types";

/**
 * The demo period. Contoso orders run 2015-01-01 to 2024-04-20, so anything
 * later is empty and anything after 2024-01 sits in a thinning tail.
 */
export const DEMO_PERIOD = "2023-11";

export const DIMENSIONS: readonly Dimension[] = [
  {
    id: "date",
    label: "Date",
    description: "The day an order was placed.",
    column: "gold.fact_sales_daily.date_key",
  },
  {
    id: "country",
    label: "Country",
    description: "The country of the store that took the order.",
    column: "gold.dim_store.country_name",
  },
  {
    id: "channel",
    label: "Channel",
    description:
      "Online or in store. Derived in silver: Contoso has no channel column, " +
      "so the single store with country code '--' is the online channel.",
    column: "gold.dim_store.channel",
  },
  {
    id: "category",
    label: "Category",
    description: "Top level product category.",
    column: "gold.fact_sales_daily.category_name",
  },
  {
    id: "subcategory",
    label: "Subcategory",
    description: "Product subcategory, nested under category.",
    column: "gold.fact_sales_daily.subcategory_name",
  },
  {
    id: "brand",
    label: "Brand",
    description: "Product brand.",
    column: "gold.fact_sales_daily.brand",
  },
  {
    id: "store",
    label: "Store",
    description: "The individual store that took the order.",
    column: "gold.dim_store.description",
  },
  {
    id: "currency",
    label: "Currency",
    description:
      "The currency the customer paid in. Every physical store transacts in " +
      "exactly one currency; the online store carries all five.",
    column: "gold.fact_sales_daily.currency_code",
  },
] as const;

/** Dimensions available on the sales fact. */
const SALES_DIMENSIONS: DimensionId[] = [
  "date",
  "country",
  "channel",
  "category",
  "subcategory",
  "brand",
  "store",
  "currency",
];

/**
 * Dimensions available on the orders fact. An order spans several products, so
 * category, subcategory and brand do not exist at this grain. This is why
 * order_count cannot be compared against net_revenue without saying so.
 */
const ORDER_DIMENSIONS: DimensionId[] = [
  "date",
  "country",
  "channel",
  "store",
  "currency",
];

const FX_EXCLUSION =
  "Order lines whose currency had no exchange rate for the order date. They " +
  "are removed in silver rather than counted as zero.";

const SHARED_LINEAGE = {
  upstream: [
    "bronze.orders",
    "bronze.orderrows",
    "bronze.currencyexchange",
    "silver.fct_order_lines",
  ],
  transforms: [
    "join orders to orderrows on OrderKey",
    "net_amount = Quantity * NetPrice (the discount is already inside NetPrice)",
    "convert to USD via currencyexchange, matched on FromCurrency = CurrencyCode, ToCurrency = 'USD', and the order date",
  ],
  owner: "data-platform",
  freshness: "daily 04:00 UTC",
};

export const METRICS: readonly Metric[] = [
  {
    id: "net_revenue",
    label: "Net Revenue",
    description:
      "What customers paid, after discounts, converted to US dollars.",
    unit: "currency",
    sql: "SUM(net_amount_usd)",
    grain: "gold.fact_sales_daily",
    dimensions: SALES_DIMENSIONS,
    exclusions: [FX_EXCLUSION],
    definitionVersion: "1.0.0",
    lineage: SHARED_LINEAGE,
  },
  {
    id: "gross_profit",
    label: "Gross Profit",
    description: "Net revenue less the cost of the goods sold.",
    unit: "currency",
    sql: "SUM(net_amount_usd - cost_amount_usd)",
    grain: "gold.fact_sales_daily",
    dimensions: SALES_DIMENSIONS,
    exclusions: [FX_EXCLUSION],
    definitionVersion: "1.0.0",
    lineage: {
      ...SHARED_LINEAGE,
      transforms: [
        ...SHARED_LINEAGE.transforms,
        "cost_amount = Quantity * UnitCost, converted on the same rate",
      ],
    },
  },
  {
    id: "gross_margin",
    label: "Gross Margin",
    description:
      "Gross profit as a share of net revenue. A ratio, so it cannot be summed " +
      "across rows.",
    unit: "ratio",
    sql: "SUM(net_amount_usd - cost_amount_usd) / NULLIF(SUM(net_amount_usd), 0)",
    grain: "gold.fact_sales_daily",
    dimensions: SALES_DIMENSIONS,
    exclusions: [FX_EXCLUSION],
    definitionVersion: "1.0.0",
    lineage: SHARED_LINEAGE,
  },
  {
    id: "units_sold",
    label: "Units Sold",
    description: "How many individual items left the shelf.",
    unit: "count",
    sql: "SUM(quantity)",
    grain: "gold.fact_sales_daily",
    dimensions: SALES_DIMENSIONS,
    exclusions: [FX_EXCLUSION],
    definitionVersion: "1.0.0",
    lineage: SHARED_LINEAGE,
  },
  {
    id: "order_lines",
    label: "Order Lines",
    description:
      "How many lines were counted. Compare it against the pipeline's input " +
      "count to see what the FX join removed.",
    unit: "count",
    sql: "SUM(line_count)",
    grain: "gold.fact_sales_daily",
    dimensions: SALES_DIMENSIONS,
    exclusions: [FX_EXCLUSION],
    definitionVersion: "1.0.0",
    lineage: SHARED_LINEAGE,
  },
  {
    id: "order_count",
    label: "Orders",
    description:
      "How many orders were placed. Counted on its own table because one order " +
      "covers several products, so it cannot be split by category or brand.",
    unit: "count",
    sql: "SUM(order_count)",
    grain: "gold.fact_orders_daily",
    dimensions: ORDER_DIMENSIONS,
    exclusions: [
      "Orders where every line lost its exchange rate. An order that kept at " +
        "least one line is still counted.",
    ],
    definitionVersion: "1.0.0",
    lineage: {
      ...SHARED_LINEAGE,
      transforms: [
        "join orders to orderrows on OrderKey",
        "convert to USD via currencyexchange, matched on FromCurrency = CurrencyCode, ToCurrency = 'USD', and the order date",
        "count distinct OrderKey after the conversion",
      ],
    },
  },
] as const;

const METRIC_BY_ID = new Map<MetricId, Metric>(METRICS.map((m) => [m.id, m]));
const DIMENSION_BY_ID = new Map<DimensionId, Dimension>(
  DIMENSIONS.map((d) => [d.id, d]),
);

export function getMetric(id: MetricId): Metric {
  const m = METRIC_BY_ID.get(id);
  if (!m) throw new Error(`Unknown metric: ${id}`);
  return m;
}

export function getDimension(id: DimensionId): Dimension {
  const d = DIMENSION_BY_ID.get(id);
  if (!d) throw new Error(`Unknown dimension: ${id}`);
  return d;
}

/** True when this metric can be split along this dimension. */
export function supportsDimension(
  metric: MetricId,
  dimension: DimensionId,
): boolean {
  return getMetric(metric).dimensions.includes(dimension);
}

/** Every metric id. Tool inputSchema enums are built from this. */
export const METRIC_IDS: MetricId[] = METRICS.map((m) => m.id);

/** Every dimension id. */
export const DIMENSION_IDS: DimensionId[] = DIMENSIONS.map((d) => d.id);
