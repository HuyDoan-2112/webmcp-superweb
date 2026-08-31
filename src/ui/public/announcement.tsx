// The announcement ticker: every promotion, scrolling right to left.
//
// This replaced a static rail of four cards. The rail existed because a
// rotating ribbon shows one promotion at a time, which leaves the broken claim
// two clicks away, and the demo is an agent checking a claim the page states
// plainly. A ticker has the same risk, so it is mitigated rather than ignored:
// hover slows it to a crawl, keyboard focus stops it, selecting a promotion
// pins it, and under prefers-reduced-motion it never moves. Every claim stays
// reachable, which is the property that actually mattered.
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
import { selectPromotion, type Locale } from "@/store";
import { isLive, readPromotions, today } from "@/promotions";
import { t } from "./i18n";

const PROMOTIONS = readPromotions();

export function AnnouncementStrip() {
  const selected = useStore((s) => s.selectedPromotionCode);
  const locale = useStore((s) => s.locale);
  const day = today();
  const open = PROMOTIONS.find((p) => p.code === selected) ?? null;

  return (
    <section aria-label="Announcements" className="border-b">
      <div
        className="ticker relative mx-auto w-full max-w-7xl"
        data-paused={open !== null}
      >
        <div className="ticker-mask">
          {/* Two copies, and only the first is announced. The second exists so
              the loop has something to run into, and a screen reader reading
              every promotion twice would be a bug rather than a feature. */}
          <div className="ticker-track flex w-max">
            <TickerRun day={day} locale={locale} selected={selected} />
            <TickerRun day={day} locale={locale} selected={selected} duplicate />
          </div>
        </div>

        {/* Pinned under the whole strip rather than under one item, because the
            item is moving and an anchored panel would slide off with it. Still
            absolutely positioned: rendered in flow it pushed the catalogue down
            the page on every click. */}
        {open !== null && (
          <div
            id={`promo-${open.code}`}
            className="bg-background absolute inset-x-0 top-full z-20 border-b p-4 text-xs shadow-md"
          >
            <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
              <p className="text-muted-foreground">{open.body}</p>
              <p className="mt-2">
                <span className="text-muted-foreground">Claim. </span>
                {open.claim.assertion}
              </p>
              <p className="text-muted-foreground mt-2 font-mono text-[11px]">
                {open.code} · {open.validFrom} to {open.validTo}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** One pass of every promotion. Rendered twice to make the loop seamless. */
function TickerRun({
  day,
  locale,
  selected,
  duplicate,
}: {
  day: string;
  locale: Locale;
  selected: string | null;
  duplicate?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={duplicate}>
      {PROMOTIONS.map((p) => {
        const running = isLive(p, day);
        const isOpen = selected === p.code;
        return (
          <button
            key={p.code}
            type="button"
            tabIndex={duplicate ? -1 : undefined}
            aria-expanded={isOpen}
            aria-controls={`promo-${p.code}`}
            onClick={() => selectPromotion(isOpen ? null : p.code)}
            className="group/promo flex shrink-0 items-center gap-3 py-1.5 ps-1 pe-4 text-sm whitespace-nowrap"
          >
            {/* The pill is the hover state, not an underline. Underlining text
                that is already sliding sideways reads as a link that got away
                from you. */}
            <span
              className={cn(
                "flex items-baseline gap-2 rounded-full px-3 py-1 transition-colors",
                isOpen
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground group-hover/promo:bg-muted group-hover/promo:text-foreground",
              )}
            >
              {p.headline}
              {!running && (
                <span className="text-[11px] opacity-70">
                  {t(locale, "promoFrom", { date: p.validFrom })}
                </span>
              )}
            </span>
            <span
              aria-hidden="true"
              className="bg-border h-3 w-px shrink-0"
            />
          </button>
        );
      })}
    </div>
  );
}
