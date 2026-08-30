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

/**
 * The dashboard toolbar. It lives inside `Main`, not the header, so its own
 * edges are the content's edges: the period select starts where the tiles and
 * the breakdown table start, and the theme toggle ends where they end. Put this
 * back in the header and it picks up the sidebar trigger's width as a left
 * offset, which is what pushed it out of line with the table before.
 */
export function PeriodBar() {
  const period = useStore((s) => s.period);

  return (
    <div className="mb-4 flex shrink-0 items-center gap-2">
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
    </div>
  );
}
