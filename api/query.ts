// GET /api/query - metric values, optionally broken down by a dimension.
//
// The only endpoint that aggregates. Every column it touches comes from the
// registry through compose.ts.

import { getMetric } from "../shared/metrics";
import type { MetricQuery, Row } from "../shared/types";
import {
  composeQuery,
  isMetricId,
  parseFilters,
  previousPeriod,
  QueryError,
} from "./_lib/compose";
import { query } from "./_lib/duckdb";
import { fail, json, params } from "./_lib/http";
import { verdictFor } from "./_lib/trust";

export default async function handler(request: Request): Promise<Response> {
  const p = params(request);
  const metricId = p.get("metric") ?? "";
  const period = p.get("period") ?? "";
  const dimension = p.get("dimension") ?? undefined;

  if (!isMetricId(metricId)) {
    return fail(`Unknown metric "${metricId}"`, 400);
  }
  const metric = getMetric(metricId);
  const filters = parseFilters(Object.fromEntries(p.entries()));

  const q: MetricQuery = {
    metric: metricId,
    period,
    dimension: dimension as MetricQuery["dimension"],
    filters,
    limit: p.has("limit") ? Number(p.get("limit")) : undefined,
  };

  try {
    const composed = composeQuery(q);
    const rows = await query<{ label?: string; value: number | null }>(
      composed.sql,
      composed.params,
    );

    // The same query one period earlier, for the delta. Cheap enough to always
    // run, and a number without a comparison is rarely what anyone wanted.
    const prior = composeQuery({ ...q, period: previousPeriod(period) });
    const priorRows = await query<{ label?: string; value: number | null }>(
      prior.sql,
      prior.params,
    );
    const priorBy = new Map(priorRows.map((r) => [r.label ?? "", r.value ?? 0]));

    const total = rows.reduce((sum, r) => sum + (r.value ?? 0), 0);
    const out: Row[] = rows.map((r) => {
      const before = priorBy.get(r.label ?? "") ?? 0;
      const value = r.value ?? 0;
      return {
        label: r.label,
        value,
        delta: before === 0 ? undefined : (value - before) / Math.abs(before),
        share: q.dimension && total !== 0 ? value / total : undefined,
      };
    });

    return json({
      metric: metricId,
      period,
      dimension: q.dimension,
      filters,
      unit: metric.unit,
      rows: out,
      verdict: await verdictFor(metricId, period, filters),
    });
  } catch (error) {
    if (error instanceof QueryError) return fail(error.message, 400);
    throw error;
  }
}
