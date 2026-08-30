// PROTOTYPE. Throwaway. Three structurally different answers to "where does an
// announcement live on the catalogue", plus one control.
//
// A  Ribbon      one promotion at a time, thin bar under the header
// B  Rail        four cards in a row above the grid, headline only until
//                selected. THE WINNER (#30): every claim stays on screen, at a
//                third of the height. A lost because the ribbon hides the
//                blocked claim behind two clicks.
// C  In-grid     promotions as tiles among the products, WITH verdict badges
//
// C is the control. Issue #25 decided the page never paints a verdict and the
// tool returns it as text; C shows what that decision rules out, so it can be
// looked at rather than reasoned about.

import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROMOTIONS, isLive, outcomeFor, type Promotion } from "./data";

type Props = {
  selected: string | null;
  onSelect: (code: string) => void;
  cursor: number;
  onCursor: (n: number) => void;
};

const live = () => PROMOTIONS.filter((p) => isLive(p));

// ------------------------------------------------------------------ A: ribbon

export function VariantA({ selected, onSelect, cursor, onCursor }: Props) {
  const shown = live();
  if (shown.length === 0) return null;
  const p = shown[cursor % shown.length]!;
  const open = selected === p.code;

  return (
    <div className="bg-primary text-primary-foreground border-b">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2 text-sm sm:px-6">
        <button
          className="opacity-70 hover:opacity-100"
          onClick={() => onCursor((cursor - 1 + shown.length) % shown.length)}
          aria-label="Previous announcement"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button className="flex-1 text-center" onClick={() => onSelect(p.code)}>
          <span className="font-medium">{p.headline}</span>
          <span className="ml-2 opacity-80">{open ? p.body : "Tap for details"}</span>
        </button>
        <button
          className="opacity-70 hover:opacity-100"
          onClick={() => onCursor((cursor + 1) % shown.length)}
          aria-label="Next announcement"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      {open && (
        <div className="bg-primary/90 border-t border-white/20">
          <div className="mx-auto w-full max-w-7xl px-4 py-2 text-xs sm:px-6">
            <span className="opacity-80">Claim: </span>
            {p.claim.assertion}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------- B: rail

export function VariantB({ selected, onSelect }: Props) {
  return (
    <div className="border-b">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROMOTIONS.map((p) => {
            const running = isLive(p);
            return (
              <button
                key={p.code}
                onClick={() => onSelect(p.code)}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                  selected === p.code ? "ring-primary bg-accent ring-2" : "hover:bg-accent/50",
                  !running && "opacity-60",
                )}
              >
                <div className="text-muted-foreground flex items-center gap-1 text-[11px] tracking-wide uppercase">
                  <Sparkles className="size-3" />
                  {running ? "Now on" : `From ${p.validFrom}`}
                </div>
                <div className="mt-1 truncate text-sm font-medium">{p.headline}</div>
                {selected === p.code && (
                  <div className="mt-2 border-t pt-2 text-xs">
                    <div className="text-muted-foreground">{p.body}</div>
                    <div className="mt-1">
                      <span className="text-muted-foreground">Claim: </span>
                      {p.claim.assertion}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------- C: in-grid, verdicts painted

const BADGE: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  degraded: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  blocked: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  unchecked: "bg-muted text-muted-foreground",
};

export function VariantC({ selected, onSelect }: Props) {
  return (
    <div className="border-b">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
        <p className="text-muted-foreground mb-3 text-xs">
          Control variant: the page paints the verdict. #25 ruled this out - look at it before agreeing.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROMOTIONS.map((p) => {
            const { outcome, plainLanguage } = outcomeFor(p);
            return (
              <button
                key={p.code}
                onClick={() => onSelect(p.code)}
                className={cn(
                  "rounded-lg border p-3 text-left",
                  selected === p.code && "ring-primary ring-2",
                )}
              >
                <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", BADGE[outcome])}>
                  {outcome}
                </span>
                <div className="mt-2 text-sm font-medium">{p.headline}</div>
                <div className="text-muted-foreground mt-1 text-xs">{plainLanguage}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const VARIANTS: Record<string, { name: string; render: (p: Props) => React.ReactNode }> = {
  A: { name: "Ribbon, one at a time", render: (p) => <VariantA {...p} /> },
  B: { name: "Rail of four cards", render: (p) => <VariantB {...p} /> },
  C: { name: "In-grid, verdicts painted (control)", render: (p) => <VariantC {...p} /> },
};

export type { Promotion };
