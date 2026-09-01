// GET /api/query - metric values, optionally broken down by a dimension.
//
// The only endpoint that aggregates. Every column it touches comes from the
// registry through compose.ts.

import { getMetric } from "../shared/metrics.js";
import type { MetricQuery, Row } from "../shared/types.js";
import {
  composeQuery,
  isMetricId,
  parseFilters,
  previousPeriod,
  QueryError,
} from "./_lib/compose.js";
import { query } from "./_lib/duckdb.js";
import { fail, json, params } from "./_lib/http.js";
import { verdictFor } from "./_lib/trust.js";
import { latestRun } from "./_lib/runs.js";

export async function GET(request: Request): Promise<Response> {
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
    // Null stays null everywhere below. A slice with no surviving rows used to
    // come back as value 0 with delta -1, so Germany, whose every order line
    // was rejected at the FX join, reported zero revenue down a hundred per
    // cent. That is a fabricated number in the one product built to refuse
    // them, and it is worse than an absence because it looks like an answer.
    const priorBy = new Map(priorRows.map((r) => [r.label ?? "", r.value]));

    // Share is only meaningful for a metric you can add up. gross_margin is a
    // ratio, and its "shares" summed to 1.0 across countries, which says a
    // 56 per cent margin is 20 per cent of the total margin. shared/metrics.ts
    // already records the unit, so the registry decides this, not this file.
    const additive = metric.unit !== "ratio";
    const total = additive
      ? rows.reduce((sum, r) => sum + (r.value ?? 0), 0)
      : 0;

    const out: Row[] = rows.flatMap((r) => {
      if (r.value === null) return [];
      const before = priorBy.get(r.label ?? "");
      return [
        {
          label: r.label,
          value: r.value,
          delta:
            before === null || before === undefined || before === 0
              ? undefined
              : (r.value - before) / Math.abs(before),
          share:
            additive && q.dimension && total !== 0 ? r.value / total : undefined,
        },
      ];
    });

    return json({
      metric: metricId,
      period,
      dimension: q.dimension,
      filters,
      unit: metric.unit,
      rows: out,
      verdict: await verdictFor(metricId, period, filters),
      // The run this number came from, so a caller can refuse to publish a
      // figure and a verdict that came from different snapshots. /api/trust
      // reports the same field.
      runId: (await latestRun())?.id ?? "unknown",
    });
  } catch (error) {
    if (error instanceof QueryError) return fail(error.message, 400);
    throw error;
  }
}
