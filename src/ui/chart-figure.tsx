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
//      Vercel's Node builder, which does not apply Vite's aliases.

import { Area, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ReactElement } from "react";

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
export function chartBody(
  theme: ChartTheme,
  formatValue: (v: number) => string,
): ReactElement[] {
  return [
    <defs key="defs">
      <linearGradient id="fill-metric" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={theme.line} stopOpacity={0.5} />
        <stop offset="95%" stopColor={theme.line} stopOpacity={0.05} />
      </linearGradient>
    </defs>,
    <CartesianGrid
      key="grid"
      strokeDasharray="3 3"
      stroke={theme.grid}
      vertical={false}
    />,
    <XAxis
      key="x"
      dataKey="day"
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      minTickGap={24}
      fontSize={theme.fontSize}
      stroke={theme.axis}
    />,
    <YAxis
      key="y"
      tickFormatter={formatValue}
      tickLine={false}
      axisLine={false}
      width={64}
      fontSize={theme.fontSize}
      stroke={theme.axis}
    />,
    <Area
      key="area"
      type="monotone"
      dataKey="value"
      stroke={theme.line}
      strokeWidth={2}
      fill="url(#fill-metric)"
      isAnimationActive={false}
      dot={false}
    />,
  ];
}
