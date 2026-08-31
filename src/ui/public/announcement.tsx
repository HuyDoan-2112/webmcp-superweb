// The announcement ticker: every promotion, scrolling right to left.
//
// This replaced a static rail of four cards. The rail existed because a
// rotating ribbon shows one promotion at a time, which leaves the broken claim
// two clicks away, and the demo is an agent checking a claim the page states
// plainly. A ticker has the same risk, so it is mitigated rather than ignored:
// hover slows it to a crawl, keyboard focus stops it, selecting a promotion
// pins it, and under prefers-reduced-motion it never moves. Every claim stays
// reachable, which is the property that actually mattered. Because it stops
// when something is open, the detail card can be measured into place under the
// promotion it belongs to and stay there.
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

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { selectPromotion, type Locale } from "@/store";
import { appliesIn, isLive, readPromotions, today } from "@/promotions";
import { t } from "./i18n";

const PROMOTIONS = readPromotions();

/** Width of the open panel. Shared by the layout and the clamp that keeps it on screen. */
const PANEL_WIDTH = 360;

export function AnnouncementStrip() {
  const selected = useStore((s) => s.selectedPromotionCode);
  const locale = useStore((s) => s.locale);
  const country = useStore((s) => s.shopCountry);
  const day = today();
  const shown = PROMOTIONS.filter((p) => appliesIn(p, country));
  const open = shown.find((p) => p.code === selected) ?? null;

  if (shown.length === 0) return null;

  const strip = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<number | null>(null);

  /**
   * Line the panel up under the promotion it belongs to.
   *
   * Measured from the DOM rather than from a click, because check_promotion
   * selects a promotion too and there is no pointer event to read in that case.
   * The ticker is stopped whenever something is open, so one measurement holds.
   */
  useLayoutEffect(() => {
    if (open === null || strip.current === null) {
      setAnchor(null);
      return;
    }
    const button = strip.current.querySelector(
      `[aria-controls="promo-${open.code}"]:not([tabindex="-1"])`,
    );
    if (!(button instanceof HTMLElement)) return;
    const left =
      button.getBoundingClientRect().left -
      strip.current.getBoundingClientRect().left;
    const max = strip.current.clientWidth - PANEL_WIDTH;
    setAnchor(Math.max(0, Math.min(left, Math.max(0, max))));
  }, [open]);

  return (
    <section aria-label="Announcements" className="border-b">
      <div
        ref={strip}
        className="ticker relative mx-auto w-full max-w-7xl"
        data-paused={open !== null}
      >
        <div className="ticker-mask">
          {/* Two copies, and only the first is announced. The second exists so
              the loop has something to run into, and a screen reader reading
              every promotion twice would be a bug rather than a feature. */}
          <div className="ticker-track flex w-max">
            <TickerRun promotions={shown} day={day} locale={locale} selected={selected} />
            <TickerRun promotions={shown} day={day} locale={locale} selected={selected} duplicate />
          </div>
        </div>

        {/* A card under the promotion it belongs to, not a full width bar. It
            lives outside .ticker-mask because that clips, and it is positioned
            by measurement rather than by nesting for the same reason. Absolute,
            so opening one does not push the catalogue down the page. */}
        {open !== null && anchor !== null && (
          <div
            id={`promo-${open.code}`}
            className="bg-popover text-popover-foreground absolute top-full z-20 mt-1 rounded-lg border p-3 text-xs shadow-lg"
            style={{ left: anchor, width: PANEL_WIDTH }}
          >
            <p className="text-muted-foreground">{open.body}</p>
            <p className="mt-2">
              <span className="text-muted-foreground">Claim. </span>
              {open.claim.assertion}
            </p>
            <p className="text-muted-foreground mt-2 font-mono text-[11px]">
              {open.code} · {open.validFrom} to {open.validTo}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/** One pass of every promotion. Rendered twice to make the loop seamless. */
function TickerRun({
  promotions,
  day,
  locale,
  selected,
  duplicate,
}: {
  promotions: readonly ReturnType<typeof readPromotions>[number][];
  day: string;
  locale: Locale;
  selected: string | null;
  duplicate?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={duplicate}>
      {promotions.map((p) => {
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
              {/* Who the offer is for. Every promotion is already scoped in the
                  data by claim.slice, and without it on screen a visitor in
                  Canada reads a German offer as one aimed at them. */}
              {p.claim.slice.value !== null && (
                <span className="text-[11px] opacity-70">
                  {p.claim.slice.value}
                </span>
              )}
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
