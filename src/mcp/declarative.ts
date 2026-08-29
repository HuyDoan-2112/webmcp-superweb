// The declarative half of WebMCP, ready for the form that does not exist yet.
//
// A form carrying `toolname` and `tooldescription` becomes a registered tool
// with no JavaScript at all. The browser synthesises the JSON Schema from the
// markup: `<select>` options become an enum, `min` becomes `minimum`,
// `type="number"` becomes a number, `required` becomes the required array.
// Verified end to end in Chrome 152; see scratchpad gate0-webmcp/DECLARATIVE-API.md.
//
// This is the cheapest layer there is, and where an interaction is genuinely a
// form it is also the most correct one, because the schema is generated from
// the control rather than written beside it. It cannot drift, and the agent
// fills the same input a person fills.
//
// WHY THE CATALOGUE SEARCH IS NOT DECLARATIVE TODAY, two reasons:
//
//   1. There is no form. The search control in src/ui/public/header.tsx is a
//      bare <Input> bound to the store, not wrapped in a <form>, and that file
//      belongs to the other track and is being rewritten right now.
//   2. Annotations are not expressible declaratively, and `search_products`
//      returns product names and brand copy, which is third party text. Our own
//      rule puts `untrustedContentHint: true` on every public tool that returns
//      catalogue text, and a declarative tool cannot carry it.
//
// So `search_products` is registered imperatively in src/mcp/tools/catalog.ts
// against the same store setter the input calls. When the header search grows a
// real <form>, spread CATALOG_SEARCH_FORM below onto it and add the
// `toolparamdescription` attributes to its fields. That gives the page a second
// declarative tool alongside the imperative one for the case where the returned
// text is a count rather than product copy.

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
 * The markup the attributes above produce, kept here so the shape is reviewable
 * without a browser. Chrome 152 turns exactly this into a tool whose
 * inputSchema has `q` as a required string and `category` as a string enum
 * built from the option values.
 *
 *   <form {...CATALOG_SEARCH_FORM} onSubmit={onSubmit}>
 *     <input name="q" {...CATALOG_SEARCH_FIELDS.q} required />
 *     <select name="category" {...CATALOG_SEARCH_FIELDS.category}>
 *       {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
 *     </select>
 *     <button type="submit">Search</button>
 *   </form>
 */
export const CATALOG_SEARCH_MARKUP_NOTE =
  "See src/mcp/declarative.ts for the markup this attaches to.";

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
