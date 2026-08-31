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

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { selectPromotion } from "@/store";
import { isLive, readPromotions, today } from "@/promotions";
import { t } from "./i18n";

const PROMOTIONS = readPromotions();

export function AnnouncementStrip() {
  const selected = useStore((s) => s.selectedPromotionCode);
  const locale = useStore((s) => s.locale);
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
                  className={cn(
                    "hover:bg-muted/40 group/promo flex w-full items-center gap-3 px-4 py-3 text-left transition",
                    open && "bg-muted/60",
                  )}
                  onClick={() => selectPromotion(open ? null : p.code)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {p.headline}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {running
                        ? t(locale, "promoOnNow")
                        : t(locale, "promoFrom", { date: p.validFrom })}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "text-muted-foreground size-4 shrink-0 transition-transform",
                      open && "rotate-180",
                    )}
                  />
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
                      {p.code} · {p.validFrom} to {p.validTo}
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
