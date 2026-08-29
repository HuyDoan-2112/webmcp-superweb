import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMetric } from "@/api";
import { useAsync } from "@/hooks/use-async";
import { useStore } from "@/hooks/use-store";
import { formatMetric } from "@/ui/format";
import { clean } from "@/ui/tiles";

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
            <AreaChart data={series} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="fill-metric" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                className="text-xs"
                stroke="var(--muted-foreground)"
              />
              <YAxis
                tickFormatter={(v: number) => formatMetric(v, unit)}
                tickLine={false}
                axisLine={false}
                width={64}
                className="text-xs"
                stroke="var(--muted-foreground)"
              />
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
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#fill-metric)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
