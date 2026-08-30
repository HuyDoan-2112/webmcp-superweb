import { AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMetric } from "@/api";
import { useAsync } from "@/hooks/use-async";
import { useStore } from "@/hooks/use-store";
import { formatMetric } from "@/ui/format";
import { clean } from "@/ui/tiles";
import {
  CHART_MARGIN,
  chartBody,
  formatAxis,
  type ChartTheme,
} from "@/ui/chart-figure";

/**
 * The page's own theme values, passed into the shared drawing.
 *
 * These are CSS variables, which resolve in a browser and to nothing in a
 * standalone SVG. That is exactly why the drawing takes them as props: the
 * chart endpoint passes literal colours instead and gets the same axes.
 */
const PAGE_THEME: ChartTheme = {
  line: "var(--chart-1)",
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
  fontSize: 12,
};

export function TrendChart() {
  const period = useStore((s) => s.period);
  const metricId = useStore((s) => s.metricId);
  const filters = useStore((s) => s.filters);

  const { data, loading } = useAsync(
    () =>
      fetchMetric({
        metric: metricId as never,
        period,
        dimension: "date",
        filters: clean(filters),
        limit: 400,
      }),
    [period, metricId, filters.country, filters.category, filters.channel],
  );

  const series = (data?.rows ?? [])
    .slice()
    .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""))
    .map((r) => ({ day: (r.label ?? "").slice(5), value: r.value }));

  const unit = data?.unit ?? "currency";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trend</CardTitle>
        <CardDescription>Daily, {period}</CardDescription>
      </CardHeader>
      <CardContent className="h-72 ps-0">
        {loading ? (
          <div className="flex h-full items-end gap-2 px-6 pb-6">
            {Array.from({ length: 24 }, (_, i) => (
              <Skeleton key={i} className="w-full" style={{ height: `${20 + (i % 7) * 10}%` }} />
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={CHART_MARGIN}>
              {chartBody(PAGE_THEME, (v: number) => formatAxis(v, unit))}
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
                formatter={(v: number) => [formatMetric(v, unit), "Value"]}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
