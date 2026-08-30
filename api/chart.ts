// GET /api/chart - the trend chart as an SVG a human can open and paste.
//
// SVG, not PNG. Rendering the page's own Recharts components through
// react-dom/server costs no new dependency and produces a complete, labelled
// chart; a raster would mean a native rasteriser, a bundled font file, and a
// silent failure mode where a missing font drops every axis label without an
// error. Measured before choosing: see docs/research/chart-rendering-on-vercel.md
// and issue #28.
//
// THE DRAWING IS NOT WRITTEN HERE. It comes from src/ui/chart-figure.tsx, the
// same module TrendChart renders, so the picture the agent hands over and the
// picture on the screen cannot disagree about axes or aggregation. The parts
// that genuinely differ between a browser and a server are the container and
// the theme, and those are the only things this file supplies.
//
// The rows come from the same composeQuery path /api/query uses. A chart drawn
// from its own SQL would be the second code path this repo exists to avoid,
// one layer down.

import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AreaChart } from "recharts";
import { getMetric } from "../shared/metrics.js";
import type { MetricQuery, MetricUnit } from "../shared/types.js";
import {
  composeQuery,
  isMetricId,
  parseFilters,
  QueryError,
} from "./_lib/compose.js";
import { query } from "./_lib/duckdb.js";
import { fail, params } from "./_lib/http.js";
import { verdictFor } from "./_lib/trust.js";
import {
  CHART_MARGIN,
  CHART_THEME,
  chartBody,
  type ChartPoint,
} from "../src/ui/chart-figure.js";

const WIDTH = 720;
const HEIGHT = 320;

/** The same rendering rule the tools use, so a ratio never prints as money. */
function formatValue(value: number, unit: MetricUnit): string {
  if (unit === "currency")
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  if (unit === "ratio") return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString("en-US");
}

/**
 * Pull the <svg> out of what React returned and give it a namespace.
 *
 * React wraps the chart in `<div class="recharts-wrapper">` and emits no
 * `xmlns` on the svg element, because in a browser the HTML parser supplies it.
 * A standalone document has no such parser: without the attribute injected here
 * every SVG consumer rejects the file outright.
 */
function extractSvg(markup: string): string | null {
  const open = markup.indexOf("<svg");
  const close = markup.lastIndexOf("</svg>");
  if (open === -1 || close === -1) return null;
  const svg = markup.slice(open, close + "</svg>".length);
  return svg.startsWith("<svg xmlns")
    ? svg
    : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
}

/**
 * Stamp the verdict into the picture itself.
 *
 * The one thing an image does that text does not is travel. A chart of a
 * number that was never fully counted, pasted into a deck without the sentence
 * that qualifies it, is precisely the failure this project exists to stop, and
 * the tool's careful prose stays behind in a transcript nobody opens again. So
 * the caption is burned into the SVG rather than printed beside it.
 *
 * An `ok` slice gets no caption. A clean chart should look clean.
 */
function caption(svg: string, verdict: string): string {
  if (verdict === "ok") return svg;
  const words =
    verdict === "blocked"
      ? "Not publishable: rows behind this figure were never counted"
      : "Incomplete: some rows behind this figure were never counted";
  const fill = verdict === "blocked" ? "#b91c1c" : "#b45309";
  const band =
    `<rect x="0" y="0" width="${WIDTH}" height="22" fill="${fill}" fill-opacity="0.12"/>` +
    `<text x="12" y="15" font-family="sans-serif" font-size="12" fill="${fill}">` +
    `${words}</text>`;
  return svg.replace(/(<svg[^>]*>)/, `$1${band}`);
}

function message(text: string, verdict = "ok"): Response {
  // A picture that says why there is no picture. An empty 200 would be read as
  // a chart of zero, which is the one reading that must never happen: on this
  // period a blocked slice has no rows precisely BECAUSE they were rejected,
  // and "zero revenue" is the wrong story about a missing exchange rate.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">` +
    `<rect width="100%" height="100%" fill="#f9fafb"/>` +
    `<text x="24" y="48" font-family="sans-serif" font-size="16" fill="#111827">` +
    `${text.replace(/[<&>]/g, "")}</text></svg>`;
  return new Response(caption(svg, verdict), {
    status: 200,
    headers: { "content-type": "image/svg+xml; charset=utf-8" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const p = params(request);
  const metricId = p.get("metric") ?? "";
  const period = p.get("period") ?? "";

  // Validated against the registry, never concatenated into the markup. An SVG
  // opened directly in a tab is a document rather than an image, and a document
  // runs script, so nothing an agent typed reaches the output unchecked.
  if (!isMetricId(metricId)) return fail(`Unknown metric "${metricId}"`, 400);
  if (!/^\d{4}-\d{2}$/.test(period)) return fail(`Bad period "${period}"`, 400);

  const metric = getMetric(metricId);
  const filters = parseFilters(Object.fromEntries(p.entries()));

  const q: MetricQuery = {
    metric: metricId,
    period,
    dimension: "date",
    filters,
    limit: 400,
  };

  try {
    // Before the rows, because a slice with no rows still has a verdict and it
    // is usually the reason there are none.
    const verdict = await verdictFor(metricId, period, filters);
    const composed = composeQuery(q);
    const rows = await query<{ label?: string; value: number | null }>(
      composed.sql,
      composed.params,
    );

    if (rows.length === 0) {
      return message(
        verdict === "blocked"
          ? `No chart: every row behind ${metricId} for ${period} was rejected.`
          : `No rows for ${metricId} in ${period}.`,
        verdict,
      );
    }

    const series: ChartPoint[] = rows
      .slice()
      .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""))
      .map((r) => ({ day: (r.label ?? "").slice(5), value: r.value ?? 0 }));

    const markup = renderToStaticMarkup(
      createElement(
        AreaChart,
        { data: series, width: WIDTH, height: HEIGHT, margin: CHART_MARGIN },
        chartBody(CHART_THEME, (v: number) => formatValue(v, metric.unit)),
      ),
    );

    const svg = extractSvg(markup);
    if (!svg) return message("The chart could not be drawn.", verdict);

    return new Response(caption(svg, verdict), {
      status: 200,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        // Query strings are part of Vercel's CDN cache key, and without an
        // s-maxage a function response is not cached at all. The image carries
        // no session: it is the same public figures the dashboard shows, and a
        // pasted URL travels without a cookie anyway.
        "cache-control": "public, max-age=0, s-maxage=3600",
      },
    });
  } catch (error) {
    if (error instanceof QueryError) return fail(error.message, 400);
    throw error;
  }
}
