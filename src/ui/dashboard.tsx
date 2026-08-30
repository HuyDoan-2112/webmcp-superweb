import { useStore } from "@/hooks/use-store";
import { Tiles } from "@/ui/tiles";
import { TrendChart } from "@/ui/chart";
import { Breakdown } from "@/ui/breakdown";

export function Dashboard() {
  const period = useStore((s) => s.period);
  const filters = useStore((s) => s.filters);
  const scope = filters.country ?? filters.channel ?? "all channels";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revenue</h1>
        <p className="text-muted-foreground text-sm">
          Kestrel Supply Co. · {scope} · {period}
        </p>
      </div>
      <Tiles />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TrendChart />
        </div>
        <div className="lg:col-span-2">
          <Breakdown />
        </div>
      </div>
    </div>
  );
}
