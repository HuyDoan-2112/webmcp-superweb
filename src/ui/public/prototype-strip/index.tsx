// PROTOTYPE. Throwaway. Mounted in PublicShell behind ?variant=, dev only.
//
// Three variants of the announcement strip on the real catalogue page, plus the
// readout below: what the page shows versus what check_promotion would return.
// Separating those two is the decision this prototype exists to test.
//
// The app has no router (PublicShell: "Which page shows is store state, not a
// route"), so this reads location.search directly and pushes history itself.
// Prototype licence; the real strip would go through the store.

import { useEffect, useState } from "react";
import { PROMOTIONS, isLive, outcomeFor } from "./data";
import { VARIANTS } from "./variants";

const KEYS = Object.keys(VARIANTS);

function readVariant(): string | null {
  const v = new URLSearchParams(window.location.search).get("variant");
  return v && KEYS.includes(v) ? v : null;
}

function setVariant(v: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("variant", v);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event("prototype-variant"));
}

/** What check_promotion would hand back. Text, never painted on the page. */
function toolText(code: string): string {
  const p = PROMOTIONS.find((x) => x.code === code);
  if (!p) return "";
  const { outcome, plainLanguage } = outcomeFor(p);
  const head = `${p.code} - selected on the strip. Claim: "${p.claim.assertion}"`;
  const steer: Record<string, string> = {
    ok: "This claim stands. Every order line behind it was counted, so it can be repeated as it is.",
    degraded:
      "This claim can be repeated only with the gap attached. Say the figure is short and by how much, in the same breath.",
    blocked:
      "Do not repeat this figure. It was never counted, and it reads as entirely ordinary. Talk about the products instead: search_products or get_product.",
    unchecked:
      "Nobody checked this slice. That is not approval. The slices that were checked are country and channel; a category claim has no verdict behind it.",
  };
  const window_ = isLive(p)
    ? ""
    : ` This promotion has not started yet: it runs ${p.validFrom} to ${p.validTo}. Call the reminder tool for a window you can schedule against.`;
  return `${head}\n\n${outcome.toUpperCase()}: ${plainLanguage}\n\n${steer[outcome]}${window_}`;
}

export function PrototypeStrip() {
  const [variant, setV] = useState<string | null>(readVariant);
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const sync = () => setV(readVariant());
    window.addEventListener("popstate", sync);
    window.addEventListener("prototype-variant", sync);
    const key = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (!variant) return;
      const i = KEYS.indexOf(variant);
      if (e.key === "ArrowRight") setVariant(KEYS[(i + 1) % KEYS.length]!);
      if (e.key === "ArrowLeft") setVariant(KEYS[(i - 1 + KEYS.length) % KEYS.length]!);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("prototype-variant", sync);
      window.removeEventListener("keydown", key);
    };
  }, [variant]);

  if (!variant) return null;
  const i = KEYS.indexOf(variant);

  return (
    <>
      {VARIANTS[variant]!.render({ selected, onSelect: setSelected, cursor, onCursor: setCursor })}

      {/* The readout: page state on the left, tool text on the right. */}
      <div className="bg-muted/40 border-b">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-3 text-xs sm:px-6 md:grid-cols-2">
          <div>
            <div className="text-muted-foreground mb-1 font-medium">What the page shows</div>
            <pre className="whitespace-pre-wrap">
              {selected ? `selected: ${selected}\nverdict painted: ${variant === "C" ? "yes" : "no"}` : "nothing selected"}
            </pre>
          </div>
          <div>
            <div className="text-muted-foreground mb-1 font-medium">What check_promotion returns</div>
            <pre className="whitespace-pre-wrap">{selected ? toolText(selected) : "call it with a code"}</pre>
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-xs text-white shadow-lg">
        <button onClick={() => setVariant(KEYS[(i - 1 + KEYS.length) % KEYS.length]!)}>&larr;</button>
        <span>
          {variant} ({VARIANTS[variant]!.name})
        </span>
        <button onClick={() => setVariant(KEYS[(i + 1) % KEYS.length]!)}>&rarr;</button>
      </div>
    </>
  );
}
