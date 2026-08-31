// The announcement strip: a rail of headline cards above the catalogue grid.
//
// Chosen over a rotating ribbon in issue #30, and not on looks. A ribbon shows
// one promotion at a time, so the sound claim is what loads and the broken one
// sits two clicks away. Every claim stays on screen here, which is the property
// the demo needs.
//
// THE STRIP NEVER SHOWS A VERDICT. Painted verdict badges were built and
// rejected: a page that already tells a shopper the number is bad makes
// check_promotion redundant, and the whole point is that the page looks
// entirely ordinary and only the agent can tell you otherwise. Selection is the
// only state a tool moves here; the verdict is the tool's return value.
//
// Promotion copy is ours, unlike product and brand copy, which is the
// supplier's. That is why the tools over this carry untrustedContentHint:
// false.

import { cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { selectPromotion } from "@/store";
import { isLive, readPromotions, today } from "@/promotions";

const PROMOTIONS = readPromotions();

export function AnnouncementStrip() {
  const selected = useStore((s) => s.selectedPromotionCode);
  const day = today();

  return (
    <section aria-label="Announcements" className="border-b">
      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="divide-border grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 sm:divide-x">
          {PROMOTIONS.map((p) => {
            const running = isLive(p, day);
            const open = selected === p.code;
            return (
              <div key={p.code} className="relative">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`promo-${p.code}`}
                  onClick={() => selectPromotion(open ? null : p.code)}
                  className={cn(
                    "hover:bg-muted/40 flex w-full items-baseline gap-2 px-3 py-2.5 text-left transition",
                    open && "bg-muted/60",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      running ? "bg-foreground" : "border-muted-foreground/50 border",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{p.headline}</span>
                    <span className="text-muted-foreground block font-mono text-[11px]">
                      {running ? p.code : `${p.code} from ${p.validFrom}`}
                    </span>
                  </span>
                </button>

                {/*
                  Absolutely positioned, and that is the whole point. Rendered
                  in flow it grew the grid row and shoved the catalogue down the
                  page on every click, so the thing the visitor was reading
                  moved out from under them. The card keeps its height, the
                  detail floats over what is below it, and nothing reflows.
                */}
                {open && (
                  <div
                    id={`promo-${p.code}`}
                    className="bg-background absolute inset-x-0 top-full z-20 border-x border-b p-3 text-xs shadow-md"
                  >
                    <p className="text-muted-foreground">{p.body}</p>
                    <p className="mt-2">
                      <span className="text-muted-foreground">Claim. </span>
                      {p.claim.assertion}
                    </p>
                    <p className="text-muted-foreground mt-2 font-mono text-[11px]">
                      {p.validFrom} to {p.validTo}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
