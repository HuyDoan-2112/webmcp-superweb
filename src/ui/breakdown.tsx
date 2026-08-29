import type { DimensionId } from "@shared/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchMetric, fetchTrust } from "@/api";
import { useAsync } from "@/hooks/use-async";
import { useStore } from "@/hooks/use-store";
import { setBreakdownDimension } from "@/store";
import { VerdictBadge } from "@/ui/verdict";
import { formatExact } from "@/ui/format";
import { clean } from "@/ui/tiles";

const SPLITTABLE: DimensionId[] = ["country", "channel", "category", "brand", "currency"];

export function Breakdown() {
  const period = useStore((s) => s.period);
  const metricId = useStore((s) => s.metricId);
  const dimension = useStore((s) => s.breakdownDimension);
  const filters = useStore((s) => s.filters);

  const { data, loading } = useAsync(async () => {
    const result = await fetchMetric({
      metric: metricId as never,
      period,
      dimension,
      filters: clean(filters),
    });
    // Each row carries its own verdict, because the FX gap hits some slices and
    // not others. One verdict for the whole table would be a lie either way.
    const verdicts = await Promise.all(
      result.rows.map((row) =>
        fetchTrust({
          metric: metricId as never,
          period,
          filters: { [dimension]: row.label } as never,
        }).then((t) => t.verdict),
      ),
    );
    return { result, verdicts };
  }, [period, metricId, dimension, filters.country, filters.category, filters.channel]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Breakdown</CardTitle>
          <CardDescription>Ranked, with a verdict per slice</CardDescription>
        </div>
        <Select
          value={dimension}
          onValueChange={(v) => setBreakdownDimension(v as DimensionId)}
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPLITTABLE.map((d) => (
              <SelectItem key={d} value={d}>
                By {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="capitalize">{dimension}</TableHead>
              <TableHead className="text-end">Value</TableHead>
              <TableHead className="text-end">Share</TableHead>
              <TableHead className="text-end">Trust</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || !data
              ? Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : data.result.rows.map((row, i) => {
                  const verdict = data.verdicts[i];
                  return (
                    <TableRow key={row.label}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {verdict === "blocked"
                          ? "Withheld"
                          : formatExact(row.value, data.result.unit)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-end tabular-nums">
                        {row.share === undefined ? "" : `${(row.share * 100).toFixed(1)}%`}
                      </TableCell>
                      <TableCell className="text-end">
                        <VerdictBadge verdict={verdict} />
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
