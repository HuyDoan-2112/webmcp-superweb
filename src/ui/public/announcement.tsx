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

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { selectPromotion } from "@/store";
import { isLive, readPromotions, today } from "@/promotions";

const PROMOTIONS = readPromotions();

export function AnnouncementStrip() {
  const selected = useStore((s) => s.selectedPromotionCode);
  const day = today();

  return (
    <section aria-label="Announcements" className="bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PROMOTIONS.map((p) => {
            const running = isLive(p, day);
            const open = selected === p.code;
            return (
              <button
                key={p.code}
                type="button"
                aria-expanded={open}
                onClick={() => selectPromotion(open ? null : p.code)}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                  open ? "ring-primary bg-background ring-2" : "hover:bg-background/60",
                  !running && "opacity-60",
                )}
              >
                <div className="text-muted-foreground flex items-center gap-1 text-[11px] tracking-wide uppercase">
                  <Sparkles className="size-3" />
                  {running ? "Now on" : `From ${p.validFrom}`}
                </div>
                <div className={cn("mt-1 text-sm font-medium", !open && "truncate")}>
                  {p.headline}
                </div>
                {open && (
                  <div className="mt-2 border-t pt-2 text-xs">
                    <p className="text-muted-foreground">{p.body}</p>
                    <p className="mt-1">
                      <span className="text-muted-foreground">Claim: </span>
                      {p.claim.assertion}
                    </p>
                    <p className="text-muted-foreground mt-1">
                      Code {p.code}, {p.validFrom} to {p.validTo}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
