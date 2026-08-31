// The declarative half of WebMCP, in use.
//
// A form carrying `toolname` and `tooldescription` becomes a registered tool
// with no JavaScript at all. The browser synthesises the JSON Schema from the
// markup: `<select>` options become an enum, `min` becomes `minimum`,
// `type="number"` becomes a number, and `required` on a field becomes the
// schema's required array. None of that is written by hand and none of it can
// drift, because it is generated from the control the person uses.
//
// The attributes below are spread onto the catalogue search form in
// src/ui/public/header.tsx. Chrome 152 registers it as `search_catalog_form`,
// alongside the five imperative public tools, and the round trip is verified:
// calling it fills the real input and the real select, runs the page's own
// submit handler, and answers through `respondWith`.
//
// This is the cheapest layer there is, and where an interaction is genuinely a
// form it is also the most correct one. CLAUDE.md says a tool must drive the UI
// rather than query data, so that it takes the same path a click takes. With a
// declarative tool the browser enforces that instead of us agreeing to it every
// time. There is no second code path to keep honest.
//
// IT ANSWERS WITH COUNTS, NOT WITH PRODUCT ROWS, AND THAT IS DELIBERATE.
//
// Annotations are not expressible declaratively, and supplier product copy is
// exactly what `untrustedContentHint` exists for. So the declarative tool
// reports how many products match and what page the visitor is on, and points
// at `search_products` for the names, codes and prices. That tool is
// imperative, carries the annotation, and drives the same store setters.
//
// The two are not duplicates. The form tool is the interaction a person
// performs; `search_products` is the question an agent asks about the result.
//
// Limits, from the explainer: whether declarative tools support `outputSchema`,
// and how `step`, `min` and `max` map onto every JSON Schema construct, are
// still marked TBD. Cross-page responses are read from the destination page's
// first `<script type="application/ld+json">`, which we do not need because we
// respond on the same page.

import type { ToolResponse } from "./adapter";

/**
 * Attributes that turn a form into a tool. Spread onto a `<form>` element.
 *
 * React 19 passes unknown lowercase attributes straight through to the DOM, so
 * this works from JSX without a wrapper.
 */
export const CATALOG_SEARCH_FORM = {
  toolname: "search_catalog_form",
  tooldescription:
    "Search the Kestrel Supply Co. trade catalogue by keyword and narrow it " +
    "to one category. Moves the catalogue the visitor is looking at.",
  toolautosubmit: "",
} as const;

/** Field level descriptions. One per named input inside the form. */
export const CATALOG_SEARCH_FIELDS = {
  q: {
    toolparamdescription:
      "Free text matched against product name, product code and brand.",
  },
  category: {
    toolparamdescription:
      "Limit to one category. Options come from the catalogue itself.",
  },
} as const;

/**
 * The markup these attach to, kept here so the shape is reviewable without a
 * browser. Chrome 152 turns exactly this into a tool whose inputSchema has `q`
 * as a required string and `category` as a string enum built from the option
 * values. The live version is in src/ui/public/header.tsx.
 *
 *   <form {...CATALOG_SEARCH_FORM} onSubmit={onSubmit}>
 *     <input name="q" {...CATALOG_SEARCH_FIELDS.q} required />
 *     <select name="category" {...CATALOG_SEARCH_FIELDS.category}>
 *       {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
 *     </select>
 *     <button type="submit">Search</button>
 *   </form>
 */

/**
 * Answer a declarative tool call from inside a normal submit handler.
 *
 * The agent's call arrives as a real form submission: the browser fills the DOM
 * fields, submits, and the page's own handler runs. `respondWith` is how the
 * answer travels back. When a person submits the form there is no
 * `respondWith`, the call is a no-op, and the handler carries on.
 *
 * Values arrive as strings, exactly as they do for a human submission, so a
 * number field still needs parsing.
 */
export function respondToToolSubmit(
  event: SubmitEvent,
  produce: () => ToolResponse | Promise<ToolResponse>,
): boolean {
  if (typeof event.respondWith !== "function") return false;
  event.respondWith(Promise.resolve().then(produce));
  return true;
}

/** True when this browser understands declarative tools. */
export function supportsDeclarativeTools(): boolean {
  return (
    typeof SubmitEvent !== "undefined" &&
    "respondWith" in SubmitEvent.prototype
  );
}
