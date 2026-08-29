import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/hooks/use-store";
import { setPeriod } from "@/store";
import { ThemeToggle } from "./theme-toggle";

// Contoso orders run 2015-01-01 to 2024-04-20, so these are months with data in
// them. DEMO_PERIOD in shared/metrics.ts decides which one opens.
const PERIODS = ["2023-09", "2023-10", "2023-11", "2023-12"];

export function PeriodBar() {
  const period = useStore((s) => s.period);

  return (
    <>
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="w-36" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODS.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="ms-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </>
  );
}
