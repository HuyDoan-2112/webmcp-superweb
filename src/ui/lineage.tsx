import { ArrowUp, CircleAlert, CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchLineage, fetchRuns } from "@/api";
import { useAsync } from "@/hooks/use-async";

const num = (n: number) => n.toLocaleString("en-US");

export function Lineage() {
  const { data, loading } = useAsync(
    async () => ({
      lineage: await fetchLineage(),
      runs: await fetchRuns(),
    }),
    [],
  );

  const run = data?.runs.runs[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lineage</h1>
        <p className="text-muted-foreground text-sm">
          {data?.lineage.metric ?? "net_revenue"}, traced back to the system it came from
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stage ladder</CardTitle>
          <CardDescription>
            {run
              ? `Run ${run.id}, ${run.status}, finished ${run.finishedUtc ?? "unknown"}`
              : "Upstream from the dashboard metric"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {loading || !data
            ? Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="mb-2 h-12 w-full" />
              ))
            : data.lineage.nodes.map((node, i) => (
                <div key={`${node.node}-${i}`}>
                  {i > 0 && (
                    <div className="text-muted-foreground ms-3 flex h-6 items-center">
                      <ArrowUp className="size-4" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3",
                      node.failed && "border-destructive/50 bg-destructive/5",
                    )}
                  >
                    {node.failed ? (
                      <CircleAlert className="text-destructive size-4 shrink-0" />
                    ) : (
                      <CircleCheck className="size-4 shrink-0 text-emerald-600" />
                    )}
                    <code className="text-sm font-medium">{node.node}</code>
                    <Badge variant="secondary" className="font-normal">
                      {node.stage}
                    </Badge>
                    {node.rejected !== undefined && node.rejected > 0 && (
                      <span className="text-destructive ms-auto text-xs tabular-nums">
                        {num(node.rowsIn ?? 0)} in · {num(node.rowsOut ?? 0)} out ·{" "}
                        <strong>{num(node.rejected)} rejected</strong>
                      </span>
                    )}
                  </div>
                </div>
              ))}
        </CardContent>
      </Card>
    </div>
  );
}
