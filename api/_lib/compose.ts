// The registry becomes SQL here, and nowhere else.
//
// Every column name and every metric expression comes from shared/metrics.ts.
// Nothing in this file hardcodes a metric, which is the property that stops the
// server and the tool schemas drifting apart.

import { getMetric, supportsDimension } from "../../shared/metrics";
import type {
  DimensionId,
  Filters,
  MetricId,
  MetricQuery,
} from "../../shared/types";

/**
 * How each dimension is reached from a fact row. `f` is the fact, `s` is
 * dim_store. Product attributes sit on the fact itself because the fact is not
 * at product grain.
 */
const DIMENSION_SQL: Record<DimensionId, string> = {
  date: "f.date_key",
  country: "s.country_name",
  channel: "s.channel",
  category: "f.category_name",
  subcategory: "f.subcategory_name",
  brand: "f.brand",
  store: "s.description",
  currency: "f.currency_code",
};

const FACT_TABLE: Record<string, string> = {
  "gold.fact_sales_daily": "fact_sales_daily",
  "gold.fact_orders_daily": "fact_orders_daily",
};

export class QueryError extends Error {}

/** "2023-11" to the first day of that month and the first day of the next. */
export function periodBounds(period: string): { from: string; to: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw new QueryError(`Period must look like 2023-11, got "${period}"`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new QueryError(`No month ${month}`);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { from: iso(from), to: iso(to) };
}

/** The period of equal length immediately before this one. */
export function previousPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type Composed = { sql: string; params: unknown[] };

/**
 * Build the SQL for one metric over one period, optionally split by a dimension
 * and narrowed by filters.
 *
 * Filter values are always bound as parameters. Dimension and metric names are
 * never interpolated from user input; they are looked up in the registry and
 * rejected if absent, so the only strings reaching the SQL text are ones this
 * repository wrote.
 */
export function composeQuery(q: MetricQuery): Composed {
  const metric = getMetric(q.metric);
  const fact = FACT_TABLE[metric.grain];
  if (!fact) throw new QueryError(`Unknown grain ${metric.grain}`);

  const { from, to } = periodBounds(q.period);
  const params: unknown[] = [from, to];
  const where = ["f.date_key >= ?", "f.date_key < ?"];

  for (const [dimension, value] of Object.entries(q.filters ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    const dim = dimension as DimensionId;
    if (!DIMENSION_SQL[dim]) throw new QueryError(`Unknown dimension "${dimension}"`);
    if (!supportsDimension(q.metric, dim)) {
      throw new QueryError(
        `${metric.label} cannot be filtered by ${dimension}, because it is measured at ${metric.grain}.`,
      );
    }
    where.push(`${DIMENSION_SQL[dim]} = ?`);
    params.push(value);
  }

  const select: string[] = [];
  const group: string[] = [];
  if (q.dimension) {
    if (!supportsDimension(q.metric, q.dimension)) {
      throw new QueryError(
        `${metric.label} cannot be split by ${q.dimension}, because it is measured at ${metric.grain}. ` +
          `Available: ${metric.dimensions.join(", ")}.`,
      );
    }
    select.push(`CAST(${DIMENSION_SQL[q.dimension]} AS VARCHAR) AS label`);
    group.push("1");
  }
  select.push(`${metric.sql} AS value`);

  const limit = Math.min(Math.max(q.limit ?? 100, 1), 500);

  const sql = [
    `SELECT ${select.join(", ")}`,
    `FROM ${fact} f`,
    `JOIN dim_store s ON s.store_key = f.store_key`,
    `WHERE ${where.join(" AND ")}`,
    group.length ? `GROUP BY ${group.join(", ")}` : "",
    group.length ? `ORDER BY value DESC NULLS LAST` : "",
    group.length ? `LIMIT ${limit}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { sql, params };
}

/** Restrict an arbitrary object to filters the registry recognises. */
export function parseFilters(raw: Record<string, string | undefined>): Filters {
  const out: Filters = {};
  for (const key of Object.keys(DIMENSION_SQL) as DimensionId[]) {
    const value = raw[key];
    if (value) out[key] = value;
  }
  return out;
}

export function isMetricId(value: string): value is MetricId {
  try {
    getMetric(value as MetricId);
    return true;
  } catch {
    return false;
  }
}
