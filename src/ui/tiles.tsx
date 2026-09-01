import { ArrowDown, ArrowUp } from "lucide-react";
import type { MetricId } from "@shared/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchMetric } from "@/api";
import { useAsync } from "@/hooks/use-async";
import { useStore } from "@/hooks/use-store";
import { VerdictBadge } from "@/ui/verdict";
import { formatMetric } from "@/ui/format";

const SHOWN: MetricId[] = ["net_revenue", "gross_margin", "order_count", "units_sold"];

export function Tiles() {
  const period = useStore((s) => s.period);
  const filters = useStore((s) => s.filters);

  const { data, loading } = useAsync(
    () =>
      Promise.all(
        SHOWN.map((metric) => fetchMetric({ metric, period, filters: clean(filters) })),
      ),
    [period, filters.country, filters.category, filters.channel],
  );

  if (loading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SHOWN.map((id) => (
          <Card key={id}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {data.map((result) => {
        // No row means no figure. It used to coerce to zero, so a slice whose
        // rows were all rejected showed a confident 0 with a verdict badge
        // beside it, which is the number this dashboard exists to refuse.
        const row = result.rows[0];
        const value = row?.value;
        const delta = row?.delta;
        const blocked =
          result.verdict === "blocked" ||
          result.verdict === "unchecked" ||
          value === undefined;
        return (
          <Card key={result.metric}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {LABEL[result.metric as MetricId]}
              </CardTitle>
              <VerdictBadge verdict={result.verdict} />
            </CardHeader>
            <CardContent>
              {/* A blocked slice never renders its number. Showing it greyed out
                  would still put it in front of someone about to copy it. */}
              <div className="text-2xl font-bold tabular-nums">
                {blocked ? "Withheld" : formatMetric(value, result.unit)}
              </div>
              {blocked ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  The data behind this did not pass its completeness check.
                </p>
              ) : (
                <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                  {delta === undefined ? (
                    "no prior period"
                  ) : (
                    <>
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1 px-1.5 py-0 font-normal tabular-nums",
                          delta >= 0 ? "text-emerald-600" : "text-rose-600",
                        )}
                      >
                        {delta >= 0 ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )}
                        {Math.abs(delta * 100).toFixed(1)}%
                      </Badge>
                      vs previous period
                    </>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const LABEL: Record<MetricId, string> = {
  net_revenue: "Net Revenue",
  gross_profit: "Gross Profit",
  gross_margin: "Gross Margin",
  units_sold: "Units Sold",
  order_lines: "Order Lines",
  order_count: "Orders",
};

/** Drop the nulls the store carries so they never reach the query string. */
export function clean(filters: Record<string, string | null>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) if (v) out[k] = v;
  return out;
}
