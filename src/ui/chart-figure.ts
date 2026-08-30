// The drawing of the trend chart, and nothing else.
//
// Shared on purpose. `src/mcp/tools/catalog.ts` opens with the failure this
// repo is most alert to: the tools once held their own copy of the product list
// and reported "3 of 24 match" over a screen showing hundreds. A server-side
// chart renderer is exactly that shape, so there is no second drawing here.
// TrendChart renders these elements inside a ResponsiveContainer and the chart
// endpoint renders them at a fixed size through renderToStaticMarkup. Both draw
// the same axes from the same code, so they cannot disagree about what a series
// looks like. See issues #28 and #29.
//
// Three constraints keep this module renderable on a server, all of them
// measured rather than assumed:
//
//   1. No ResponsiveContainer. It renders 94 bytes and no <svg> element outside
//      a browser, because it measures a DOM node that is not there. Each caller
//      owns its own container.
//   2. No CSS variables and no Tailwind classes. A standalone SVG carries no
//      stylesheet, so `var(--chart-1)` and `className="text-xs"` resolve to
//      nothing and the chart comes out unstyled and unlabelled. Colours and
//      font sizes are props, and the page passes its own theme values in.
//   3. Nothing imported through the `@/` alias, since the endpoint is built by
//      Vercel's Node builder, which does not apply Vite's aliases. For the same
//      reason this is a .ts file that calls createElement rather than a .tsx:
//      `vercel.json` scopes its function config to `api/*.ts`, and a .tsx
//      dragged into a serverless bundle is one more thing to discover on the
//      day. JSX buys nothing in a five-element list.

import { Area, CartesianGrid, XAxis, YAxis } from "recharts";
import { createElement, type ReactElement } from "react";
import type { MetricUnit } from "../../shared/types.js";

export type ChartPoint = { day: string; value: number };

export type ChartTheme = {
  /** The area's stroke and the top of its gradient fill. */
  line: string;
  grid: string;
  axis: string;
  fontSize: number;
};

/** What the page looks like in light mode, and what the endpoint draws with. */
export const CHART_THEME: ChartTheme = {
  line: "#2563eb",
  grid: "#e5e7eb",
  axis: "#6b7280",
  fontSize: 12,
};

export const CHART_MARGIN = { top: 8, right: 16, left: 8, bottom: 0 };

/**
 * The children of the AreaChart: gradient, grid, both axes, the area itself.
 *
 * Returned as an array rather than a fragment because Recharts inspects its
 * direct children to work out what to draw, and a fragment hides them from it.
 */
/**
 * createElement, minus the overload resolution.
 *
 * Recharts declares `defaultProps.type` and `defaultProps.legendType` as plain
 * strings, which do not satisfy its own prop types when a component is passed
 * to createElement rather than written as JSX. The elements are right; only the
 * overload is not, so the cast is confined to this one line rather than spread
 * across five call sites.
 */
const el = createElement as (
  type: unknown,
  props: Record<string, unknown>,
  ...children: unknown[]
) => ReactElement;

export function chartBody(
  theme: ChartTheme,
  formatValue: (v: number) => string,
): ReactElement[] {
  return [
    createElement(
      "defs",
      { key: "defs" },
      createElement(
        "linearGradient",
        { id: "fill-metric", x1: "0", y1: "0", x2: "0", y2: "1" },
        createElement("stop", {
          offset: "5%",
          stopColor: theme.line,
          stopOpacity: 0.5,
        }),
        createElement("stop", {
          offset: "95%",
          stopColor: theme.line,
          stopOpacity: 0.05,
        }),
      ),
    ),
    el(CartesianGrid, {
      key: "grid",
      strokeDasharray: "3 3",
      stroke: theme.grid,
      vertical: false,
    }),
    el(XAxis, {
      key: "x",
      dataKey: "day",
      tickLine: false,
      axisLine: false,
      tickMargin: 8,
      minTickGap: 24,
      fontSize: theme.fontSize,
      stroke: theme.axis,
    }),
    el(YAxis, {
      key: "y",
      tickFormatter: formatValue,
      tickLine: false,
      axisLine: false,
      width: 64,
      fontSize: theme.fontSize,
      stroke: theme.axis,
    }),
    el(Area, {
      key: "area",
      type: "monotone",
      dataKey: "value",
      stroke: theme.line,
      strokeWidth: 2,
      fill: "url(#fill-metric)",
      isAnimationActive: false,
      dot: false,
    }),
  ];
}

/**
 * How a value is written on the axis.
 *
 * Here rather than in `src/ui/format.ts` because the chart endpoint has to
 * import it, and that module reaches for the `@shared/` alias, which Vercel's
 * Node builder does not resolve. Compact on purpose: "1.2M" fits under a tick
 * and "$1,203,411" does not.
 */
export function formatAxis(value: number, unit: MetricUnit): string {
  if (unit === "currency")
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    });
  if (unit === "ratio") return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString("en-US", { notation: "compact" });
}
