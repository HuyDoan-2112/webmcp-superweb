// The single source of UI state.
//
// Deliberately framework-agnostic plain TypeScript. WebMCP tools in src/mcp/
// mutate it by calling the setters below; React reads it through
// src/hooks/use-store.ts. That keeps one state path shared by the human and
// the agent, which is the property the whole demo rests on.

import { DEMO_PERIOD } from "@shared/metrics";
import type { Audience, DimensionId, Surface, TrustVerdict } from "@shared/types";

export type { Audience };

export type View = "dashboard" | "report" | "lineage";

/**
 * Which face of the same origin is showing. Defined in shared/types.ts.
 *
 * "public" is the catalogue an anonymous visitor sees. "internal" is the
 * signed-in dashboard. Same page, same store, two tool surfaces: the public
 * tools stay registered on the public surface, the full internal set replaces
 * them once someone signs in. That switch is the demo beat.
 */
export type { Surface };

export type Filters = {
  country: string | null;
  category: string | null;
  channel: string | null;
};

/**
 * The language the public surface speaks.
 *
 * Store state rather than a header sniff, so a visitor whose agent is working
 * in Japanese can be given a Japanese page by asking for one. Product names and
 * brand names are never translated; only the interface around them is.
 */
export type Locale = "en" | "es" | "fr" | "de" | "ja";

/**
 * Facets on the public catalogue. Separate from the internal `Filters`.
 *
 * Category, brand and subcategory hold the exact value the server sends back in
 * its facet counts. Colour holds the folded lower case value, because the data
 * records the same colour as both "Blue" and "blue" and one option is honest
 * where two are not.
 *
 * The price bounds are a half open range, min inclusive and max exclusive, and
 * either end may be null for "no bound". The band buttons set both at once, but
 * the field is a pair of numbers so an agent can ask for any range rather than
 * only the five the page happens to draw.
 */
export type CatalogFilters = {
  category: string | null;
  brand: string | null;
  subcategory: string | null;
  color: string | null;
  minPrice: number | null;
  maxPrice: number | null;
};

/** Families per page. One number, so the grid and a tool cannot disagree. */
export const CATALOG_PAGE_SIZE = 24;

/** No facet set. Named so "clear" and "initial" cannot drift apart. */
const NO_CATALOG_FILTERS: CatalogFilters = {
  category: null,
  brand: null,
  subcategory: null,
  color: null,
  minPrice: null,
  maxPrice: null,
};

export type State = {
  surface: Surface;
  view: View;
  period: string;
  metricId: string;
  filters: Filters;
  audience: Audience | null;
  /** True once a trust check has failed, which registers the diagnostic tools. */
  hasFailedCheck: boolean;
  reportOpen: boolean;
  /** Which dimension the dashboard breakdown table is split along. */
  breakdownDimension: DimensionId;
  /**
   * The report as drafted. Empty until draft_report writes into it, which is
   * the moment the agent's work becomes something the human can see and copy.
   * A blocked section keeps its heading and carries no figure.
   */
  reportSections: ReportSection[];

  // --- public catalogue ---
  locale: Locale;
  /** Free text over product name, code and brand. Case-insensitive. */
  catalogSearch: string;
  catalogFilters: CatalogFilters;
  /**
   * Which page of the family list is showing, counting from 1. 885 families do
   * not fit on a page, and the page is store state rather than local component
   * state so a tool can turn it the way a visitor clicks it.
   */
  catalogPage: number;
  /** ProductKey of the open product, or null for the grid. */
  selectedProductKey: number | null;
  /**
   * Which promotion is open on the announcement strip, by code, or null.
   *
   * Selection only. The strip never shows whether the claim behind a promotion
   * survived its check: a page that told a shopper the number was bad would
   * make check_promotion redundant, and the point is that the page looks
   * entirely fine and only the agent can tell you otherwise.
   */
  selectedPromotionCode: string | null;
  /**
   * Which country the visitor is shopping from, or null for all of them.
   *
   * Null is the default and stays the default. A promotion hidden by default is
   * a claim check_promotion could answer about while it is not on screen, which
   * is the one thing the announcement strip exists to avoid.
   */
  shopCountry: string | null;

  // --- the signed-in customer, all of it client side ---
  customer: Customer | null;
  cart: CartLine[];
  wishlist: number[];
  enquiries: Enquiry[];
};

const initial: State = {
  surface: "public",
  view: "dashboard",
  period: DEMO_PERIOD,
  metricId: "net_revenue",
  filters: { country: null, category: null, channel: null },
  audience: null,
  hasFailedCheck: false,
  reportOpen: false,
  breakdownDimension: "country",
  reportSections: [],
  locale: "en",
  catalogSearch: "",
  catalogFilters: NO_CATALOG_FILTERS,
  catalogPage: 1,
  selectedProductKey: null,
  selectedPromotionCode: null,
  shopCountry: null,
  customer: null,
  cart: [],
  wishlist: [],
  enquiries: [],
};

let state: State = initial;
const listeners = new Set<() => void>();

export function getState(): State {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Merge a patch into state and notify. The only way state ever changes. */
export function setState(patch: Partial<State>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function setView(view: View): void {
  setState({ view });
}

export function setPeriod(period: string): void {
  setState({ period });
}

export function setMetric(metricId: string): void {
  setState({ metricId });
}

export function setFilters(patch: Partial<Filters>): void {
  setState({ filters: { ...state.filters, ...patch } });
}

/**
 * One section of a drafted report.
 *
 * The verdict travels with the section rather than being looked up again at
 * render time. The gate that produced it had the rejected rows in front of it;
 * the renderer does not, and would have to guess.
 */
export type ReportSection = {
  heading: string;
  body: string;
  verdict: TrustVerdict;
};

export function setReportSections(reportSections: ReportSection[]): void {
  setState({ reportSections, reportOpen: true, view: "report" });
}

export function setBreakdownDimension(breakdownDimension: DimensionId): void {
  setState({ breakdownDimension });
}

export function openReport(): void {
  setState({ reportOpen: true, view: "report" });
}

// ---------------------------------------------------------------------------
// Public surface
//
// Seams for the public WebMCP tools, which live in src/mcp/ and are not written
// here. Every interaction an anonymous visitor can perform with a click is
// reachable by calling one of these, so a tool takes the same path a click does
// and the page visibly moves when the agent acts.
//
//   search_catalog       -> setCatalogSearch(query)
//   filter_catalog       -> setCatalogCategory(name) / setCatalogBrand(name)
//                           setCatalogSubcategory(name) / setCatalogColor(name)
//                           setCatalogPriceRange(min, max)
//                           pass null to drop one facet
//   clear_catalog_filters-> clearCatalogFilters()  (clears search and every facet)
//   turn_catalog_page    -> setCatalogPage(n), 1 based, CATALOG_PAGE_SIZE a page
//   open_product         -> selectProduct(productKey)
//   back_to_catalog      -> selectProduct(null)
//   set_language         -> setLocale("en" | "es" | "fr" | "de" | "ja")
//   check_promotion      -> selectPromotion(code), null closes it
//
// Every setter that changes what matches also resets catalogPage to 1. Page 7
// of a result that is now two pages long is an empty grid, and an agent that
// filtered and then read an empty page would report that nothing matched.
//
// set_language is the one that is not a shortcut for a click. An agent working
// in Japanese can put the page into Japanese rather than the site guessing from
// an Accept-Language header, and the human sees the switch happen.
//
// Enum values for the category and brand schemas come from the catalogue's own
// facet counts, read live from /api/products rather than hardcoded, so the
// agent cannot typo a facet that does not exist.
//
// setSurface is deliberately not a tool. Signing in is the human's move, and it
// is what swaps the registered tool set from the public one to the internal one.
// ---------------------------------------------------------------------------

/** Switch between the public catalogue and the signed-in dashboard. */
export function setSurface(surface: Surface): void {
  setState({ surface });
}

/** Where the visitor is shopping from. Null means every location. */
export function setShopCountry(shopCountry: string | null): void {
  setState({ shopCountry, selectedPromotionCode: null });
}

/** Set the language of the public interface. Product data is never translated. */
export function setLocale(locale: Locale): void {
  setState({ locale });
}

/**
 * Open one promotion on the announcement strip, or null to close it.
 *
 * Closes any open product for the same reason every other setter here does:
 * the strip only renders while `selectedProductKey` is null, so setting a code
 * without this would leave check_promotion telling an agent the promotion is
 * open on the page while the strip is not even in the DOM.
 */
export function selectPromotion(code: string | null): void {
  setState({ selectedPromotionCode: code, selectedProductKey: null });
}

/**
 * Narrow the catalogue by one facet and go back to page one.
 *
 * Every facet setter goes through here, so none of them can forget the reset.
 */
function narrow(patch: Partial<CatalogFilters>): void {
  setState({
    catalogFilters: { ...state.catalogFilters, ...patch },
    catalogPage: 1,
    selectedProductKey: null,
  });
}

/** Set the catalogue search text. Empty string means no text filter. */
export function setCatalogSearch(catalogSearch: string): void {
  setState({ catalogSearch, catalogPage: 1, selectedProductKey: null });
}

/**
 * Narrow the catalogue to one category, or null for all categories.
 *
 * Drops the subcategory with it. A subcategory belongs to exactly one category,
 * so keeping it across a category change guarantees an empty grid.
 */
export function setCatalogCategory(category: string | null): void {
  narrow({ category, subcategory: null });
}

/** Narrow the catalogue to one brand, or null for all brands. */
export function setCatalogBrand(brand: string | null): void {
  narrow({ brand });
}

/** Narrow the catalogue to one subcategory, or null for all of them. */
export function setCatalogSubcategory(subcategory: string | null): void {
  narrow({ subcategory });
}

/**
 * Narrow to families available in one colour, or null for any colour.
 *
 * Folded to lower case, because the data records the same colour both ways. A
 * family matches when any of its colourways does, so the card still shows the
 * whole range once it is found.
 */
export function setCatalogColor(color: string | null): void {
  narrow({ color: color === null ? null : color.toLowerCase() });
}

/**
 * Narrow to a price range: min inclusive, max exclusive, either end null for
 * no bound. Passing null for both drops the filter.
 */
export function setCatalogPriceRange(
  minPrice: number | null,
  maxPrice: number | null,
): void {
  narrow({ minPrice, maxPrice });
}

/** Show page `page` of the family list, counting from 1. */
export function setCatalogPage(page: number): void {
  setState({
    catalogPage: Math.max(1, Math.trunc(page)),
    selectedProductKey: null,
  });
}

/** Drop the search text and every facet, and return to page one. */
export function clearCatalogFilters(): void {
  setState({
    catalogSearch: "",
    catalogFilters: NO_CATALOG_FILTERS,
    catalogPage: 1,
    selectedProductKey: null,
  });
}

/** Open one product by ProductKey, or null to return to the grid. */
export function selectProduct(selectedProductKey: number | null): void {
  setState({ selectedProductKey });
}


// ---------------------------------------------------------------------------
// The signed-in customer
//
// A customer is not a fourth staff account and does not get an `audience`.
// Audience is the server's answer-depth dial and lives in the frozen contract;
// a customer asks the catalogue nothing that needs depth, so identity here is
// client side only and no cookie is written. Signing in as a customer changes
// what the page can do for you, not what the server will tell you.
//
// NOTHING HERE IS FABRICATED. The cart, the wishlist and the enquiries all
// start empty and only ever hold what someone did in this session. That is the
// difference between this and inventing a customer list: the owner sees real
// actions taken in front of them, not seeded records dressed up as history.

export type Customer = { name: string };

/** One line of the basket. The price is captured when it was added. */
export type CartLine = {
  productKey: number;
  productCode: string;
  name: string;
  color: string;
  /** USD at the moment it went in the basket, not at render time. */
  price: number;
  quantity: number;
};

/** A question a customer sent about a product. Written, never seeded. */
export type Enquiry = {
  id: string;
  customerName: string;
  productKey: number | null;
  productName: string | null;
  message: string;
  sentUtc: string;
  answered: boolean;
};

export function signInCustomer(name: string): void {
  setState({ customer: { name: name.trim() || "Guest" } });
}

export function signOutCustomer(): void {
  setState({ customer: null });
}

/** Add a line, or raise the quantity of one already in the basket. */
export function addToCart(line: Omit<CartLine, "quantity">, quantity = 1): void {
  const existing = state.cart.find((l) => l.productKey === line.productKey);
  setState({
    cart: existing
      ? state.cart.map((l) =>
          l.productKey === line.productKey
            ? { ...l, quantity: l.quantity + quantity }
            : l,
        )
      : [...state.cart, { ...line, quantity }],
  });
}

/** Set a line's quantity. Zero or less removes it. */
export function setCartQuantity(productKey: number, quantity: number): void {
  setState({
    cart:
      quantity <= 0
        ? state.cart.filter((l) => l.productKey !== productKey)
        : state.cart.map((l) =>
            l.productKey === productKey ? { ...l, quantity } : l,
          ),
  });
}

export function clearCart(): void {
  setState({ cart: [] });
}

/** In or out. Returns what the list now says, so a tool can report it. */
export function toggleWishlist(productKey: number): boolean {
  const has = state.wishlist.includes(productKey);
  setState({
    wishlist: has
      ? state.wishlist.filter((k) => k !== productKey)
      : [...state.wishlist, productKey],
  });
  return !has;
}

export function sendEnquiry(enquiry: Omit<Enquiry, "id" | "sentUtc" | "answered">): Enquiry {
  const created: Enquiry = {
    ...enquiry,
    id: `enq_${state.enquiries.length + 1}_${Math.random().toString(36).slice(2, 8)}`,
    sentUtc: new Date().toISOString(),
    answered: false,
  };
  setState({ enquiries: [...state.enquiries, created] });
  return created;
}

export function markEnquiryAnswered(id: string): void {
  setState({
    enquiries: state.enquiries.map((e) =>
      e.id === id ? { ...e, answered: true } : e,
    ),
  });
}
