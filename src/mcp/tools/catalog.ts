// The public tool surface: what an anonymous visitor's agent can do.
//
// Registered for everyone, including someone who never signs in. Nothing here
// is refused to anyone. The surface grows with context, it does not gate on
// identity.
//
// EVERY COUNT THESE TOOLS QUOTE COMES FROM /api/products, THE SAME ENDPOINT AND
// THE SAME QUERY THE CATALOGUE PAGE RUNS.
//
// That is not a stylistic preference. These tools once held their own copy of
// the product list, 24 hardcoded rows, while the page had moved to 885 families
// from the gold table. The agent said "3 of 24 match" over a screen showing
// hundreds. A second code path that happens to agree with the first is the
// failure this whole architecture exists to avoid, and that one did not even
// agree. So: the tool moves the store, then reads the endpoint with exactly the
// state the page will render from, and quotes the number the visitor can see.
//
// THE CATALOGUE IS A LIST OF PRODUCTS, NOT OF SKUs. Contoso ships one row per
// colourway, so 2,517 SKUs are 885 products. The page says "products" and shows
// a row of colour swatches; these tools say products and colourways and never
// "lines", because the two have to match word for word.
//
// `untrustedContentHint: true` on everything that returns product copy. Product
// names, brand names and manufacturer names are third party text we did not
// write, which is exactly what the annotation is for.

import { LOCALES, LOCALE_NAMES } from "@/ui/public/i18n";
import {
  CATALOG_PAGE_SIZE,
  clearCatalogFilters,
  getState,
  selectProduct,
  setCatalogBrand,
  setCatalogCategory,
  setCatalogColor,
  setCatalogPage,
  setCatalogPriceRange,
  setCatalogSearch,
  setCatalogSubcategory,
  setLocale,
  type Locale,
  type State,
} from "@/store";
import {
  NO_PRODUCTS_ENDPOINT,
  countProducts,
  readProduct,
  readProducts,
  type CatalogFacets,
  type ProductDetailResponse,
  type ProductFamily,
  type ProductQueryArgs,
} from "../api";
import { text, type ToolSpec } from "../adapter";

// --------------------------------------------------------------- the query

/**
 * The query the catalogue page is about to run, built from the same store
 * fields src/ui/public/catalog.tsx reads. Every tool goes through this, so a
 * tool's count and the grid's count are the same number by construction rather
 * than by agreement.
 */
function pageQuery(state: State = getState()): ProductQueryArgs {
  const f = state.catalogFilters;
  return {
    search: state.catalogSearch,
    category: f.category,
    brand: f.brand,
    subcategory: f.subcategory,
    color: f.color,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    offset: (state.catalogPage - 1) * CATALOG_PAGE_SIZE,
    limit: CATALOG_PAGE_SIZE,
  };
}

/** How the page words its own filter summary, for the tool to echo back. */
function describeFilters(state: State = getState()): string {
  const f = state.catalogFilters;
  const parts: string[] = [];
  if (state.catalogSearch.trim() !== "")
    parts.push(`"${state.catalogSearch.trim()}"`);
  if (f.category) parts.push(f.category);
  if (f.brand) parts.push(f.brand);
  if (f.subcategory) parts.push(f.subcategory);
  if (f.color) parts.push(f.color);
  if (f.minPrice !== null || f.maxPrice !== null) {
    const lo = f.minPrice === null ? "any" : `$${f.minPrice}`;
    const hi = f.maxPrice === null ? "any" : `under $${f.maxPrice}`;
    parts.push(`price ${lo} to ${hi}`);
  }
  return parts.length === 0 ? "no filter" : parts.join(" + ");
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** One product line, worded the way the card is: the family, then its colours. */
function line(family: ProductFamily): string {
  const price =
    family.priceMin === family.priceMax
      ? money(family.priceMin)
      : `${money(family.priceMin)} to ${money(family.priceMax)}`;
  const colours =
    family.colors.length === 1
      ? family.colors[0]
      : `${family.colors.length} colourways: ${family.colors.join(", ")}`;
  return (
    `${family.familyName}\n` +
    `  ${family.brand} · ${family.categoryName} / ${family.subCategoryName}\n` +
    `  ${price} · ${colours}\n` +
    `  codes: ${family.variants.map((v) => v.productCode).join(", ")}`
  );
}

function paging(total: number, page: number): string {
  const pages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  return `page ${page} of ${pages}`;
}

// ------------------------------------------------------- empty state advice

/**
 * When nothing matches, name the constraint that is actually doing the damage.
 *
 * Each candidate is counted by dropping exactly that one constraint and asking
 * the server, so the number quoted is the number the visitor would see if they
 * dropped it. Only runs on an empty result, so the extra round trips cost
 * nothing in the common case.
 */
async function narrowestConstraint(state: State): Promise<string> {
  const base = pageQuery(state);
  const f = state.catalogFilters;

  const candidates: { label: string; drop: ProductQueryArgs; how: string }[] =
    [];
  if (state.catalogSearch.trim() !== "")
    candidates.push({
      label: `the search text "${state.catalogSearch.trim()}"`,
      drop: { ...base, search: "" },
      how: "call search_products again with an empty query",
    });
  for (const [key, value, noun] of [
    ["category", f.category, "category"],
    ["brand", f.brand, "brand"],
    ["subcategory", f.subcategory, "subcategory"],
    ["color", f.color, "colour"],
  ] as const) {
    if (value === null) continue;
    candidates.push({
      label: `the ${noun} filter "${value}"`,
      drop: { ...base, [key]: null },
      how: `call filter_catalog with ${key} set to "" to drop it`,
    });
  }
  if (f.minPrice !== null || f.maxPrice !== null)
    candidates.push({
      label: "the price range",
      drop: { ...base, minPrice: null, maxPrice: null },
      how: "call filter_catalog with clear_price set to true",
    });

  if (candidates.length === 0)
    return (
      "No filter is set and nothing matched, which is a fault rather than a " +
      "result. Say so rather than telling the visitor the shop is empty."
    );

  const counts = await Promise.all(
    candidates.map((c) => countProducts({ ...c.drop, offset: 0, limit: 1 })),
  );
  const scored = candidates
    .map((c, i) => ({ ...c, kept: counts[i] ?? 0 }))
    .sort((a, b) => b.kept - a.kept);
  const worst = scored[0];

  return (
    `Nothing matched. The narrowest constraint is ${worst.label}: without it ` +
    `${worst.kept} product${worst.kept === 1 ? "" : "s"} would show. To widen, ` +
    `${worst.how}. To drop everything at once, call filter_catalog with clear ` +
    `set to true.`
  );
}

// ------------------------------------------------------------ facet lookup

/**
 * What a product identifier turned out to mean.
 *
 * "not in the catalogue" and "the catalogue did not answer" are different
 * answers and the agent has to be told which one it got. Collapsing them would
 * have an agent tell a visitor we do not stock something during an outage.
 */
type Resolution =
  | { kind: "found"; detail: ProductDetailResponse }
  | { kind: "missing" }
  | { kind: "unreachable" };

/**
 * Resolve a product code, product key or exact name to one product.
 *
 * The order matters and is not the obvious one. Product codes are all digits
 * with a leading zero, "0106046", so a naive "is it numeric, then it is a key"
 * test turns every code into a key that does not exist. Text is matched first
 * and only an exact code or name wins outright; a bare number falls through to
 * the key lookup that /api/products keys detail on, which is the same call
 * selectProduct takes when someone clicks a colour swatch.
 */
async function resolveProduct(identifier: string): Promise<Resolution> {
  const trimmed = identifier.trim();
  const needle = trimmed.toLowerCase();

  const found = await readProducts({ search: trimmed, limit: 5 });

  if (found) {
    for (const family of found.families) {
      const exact = family.variants.find(
        (v) =>
          v.productCode.toLowerCase() === needle ||
          v.productName.toLowerCase() === needle,
      );
      if (exact) {
        const detail = await readProduct(exact.productKey);
        if (detail) return { kind: "found", detail };
        return { kind: "unreachable" };
      }
    }
  }

  if (/^\d+$/.test(trimmed)) {
    const detail = await readProduct(Number(trimmed));
    if (detail) return { kind: "found", detail };
  }

  // No exact hit. Take the best text match rather than refusing, because an
  // agent asking for "Contoso Coffee Maker" should land on it.
  const first = found?.families[0]?.variants[0];
  if (first) {
    const detail = await readProduct(first.productKey);
    if (detail) return { kind: "found", detail };
  }

  return found ? { kind: "missing" } : { kind: "unreachable" };
}

// ------------------------------------------------------------------- tools

function searchProducts(facets: CatalogFacets | null): ToolSpec {
  return {
    name: "search_products",
    title: "Search the catalogue",
    description:
      "Search the Kestrel Supply Co. trade catalogue by keyword, and " +
      "optionally narrow it to one category or brand. This moves the page the " +
      "visitor is looking at: the search box fills in and the grid re-runs, " +
      "so the count you report is the count on their screen. Each result is " +
      "one product with every colourway on it, not one row per colour.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Free text matched against product name, product code and brand. " +
            "Pass an empty string to clear the text filter.",
        },
        category: enumOrText(
          facets?.categories,
          "Limit to one category. Empty string drops the filter.",
        ),
        brand: enumOrText(
          facets?.brands,
          "Limit to one brand. Empty string drops the filter.",
        ),
        limit: {
          type: "number",
          minimum: 1,
          maximum: CATALOG_PAGE_SIZE,
          description: `How many of the page's products to list back. The page shows ${CATALOG_PAGE_SIZE}.`,
        },
      },
      required: [],
    },
    // Not read only: it moves the catalogue the visitor is looking at, which is
    // the point of it. untrustedContentHint because the rows carry supplier copy.
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args) => {
      // Drive the UI first. Same setters the header form and the facet buttons
      // call, and each of them resets the page to 1 on its own.
      if (typeof args.query === "string") setCatalogSearch(args.query);
      if (typeof args.category === "string")
        setCatalogCategory(args.category === "" ? null : args.category);
      if (typeof args.brand === "string")
        setCatalogBrand(args.brand === "" ? null : args.brand);

      const state = getState();
      const found = await readProducts(pageQuery(state));
      if (!found) return text(NO_PRODUCTS_ENDPOINT);

      if (found.total === 0) {
        return text(
          `${await narrowestConstraint(state)}\n\nThe page is showing its ` +
            `empty state, so the visitor can see the same thing you can.`,
        );
      }

      const limit =
        typeof args.limit === "number"
          ? Math.max(1, Math.trunc(args.limit))
          : found.families.length;
      const shown = found.families.slice(0, limit);

      return text(
        `${found.families.length} of ${found.total} products, ` +
          `${paging(found.total, state.catalogPage)}, filtered to ` +
          `${describeFilters(state)}. The page has moved to this result and ` +
          `shows the same numbers.\n\n` +
          shown.map(line).join("\n\n") +
          (found.families.length > shown.length
            ? `\n\n${found.families.length - shown.length} more on this page ` +
              `are not listed above. Raise limit to see them.`
            : "") +
          (found.total > found.families.length
            ? `\n\n${found.total - found.families.length} further products ` +
              `match but are on other pages. Call filter_catalog with a page ` +
              `number to turn the page, or narrow with brand, subcategory, ` +
              `colour or price.`
            : "") +
          `\n\nProduct names and brand copy above come from the supplier, not ` +
          `from us. To open one product on the page, call get_product with any ` +
          `of its codes. To weigh two to four against each other in one call, ` +
          `use compare_products.`,
      );
    },
  };
}

function getProduct(): ToolSpec {
  return {
    name: "get_product",
    title: "Open one product",
    description:
      "Open one catalogue product on the page and read its full detail: every " +
      "colourway with its own code and price, and the nearest other products " +
      "in the same subcategory. Takes a product code, a product key or an " +
      "exact product name. The visitor's screen moves to that product.",
    inputSchema: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description:
            'Product code such as "0106046", the numeric product key, or the ' +
            "exact product name.",
        },
      },
      required: ["product"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args) => {
      const identifier = String(args.product ?? "").trim();
      if (identifier === "")
        return text(
          "No product was named. Call search_products first to find a code, " +
            "then pass it here.",
        );

      const resolution = await resolveProduct(identifier);
      if (resolution.kind === "unreachable") return text(NO_PRODUCTS_ENDPOINT);
      if (resolution.kind === "missing") {
        return text(
          `Nothing in the catalogue is identified by "${identifier}". The ` +
            `catalogue answered, so this is a product we do not stock rather ` +
            `than an outage. Call search_products with a looser keyword to ` +
            `find the code, then call get_product with it.`,
        );
      }
      const detail = resolution.detail;

      // Same call a click on a colour swatch makes. One door for both.
      selectProduct(detail.product.productKey);

      const { product, family, related } = detail;
      return text(
        `Opened ${family.familyName} on the page, showing the ` +
          `${product.color} colourway.\n\n` +
          `product code   ${product.productCode}\n` +
          `product key    ${product.productKey}\n` +
          `brand          ${product.brand}\n` +
          `manufacturer   ${product.manufacturer}\n` +
          `category       ${product.categoryName} / ${product.subCategoryName}\n` +
          `colour         ${product.color}\n` +
          `weight         ${product.weight} ${product.weightUnit}\n` +
          `list price     ${money(product.price)} USD\n\n` +
          `This product comes in ${family.variants.length} colourway` +
          `${family.variants.length === 1 ? "" : "s"}:\n` +
          family.variants
            .map(
              (v) =>
                `  ${v.color.padEnd(12)} ${v.productCode}  ${money(v.price)}`,
            )
            .join("\n") +
          (related.length > 0
            ? `\n\nOthers in ${product.subCategoryName}:\n` +
              related
                .map((r) => `  ${r.familyName}  from ${money(r.priceMin)}`)
                .join("\n")
            : "") +
          `\n\nEverything above is supplier copy, not ours. Prices are list ` +
          `prices in USD and exclude delivery. To weigh this against others, ` +
          `call compare_products with this code and one to three more. To go ` +
          `back to the grid, call search_products.`,
      );
    },
  };
}

function compareProducts(): ToolSpec {
  return {
    name: "compare_products",
    title: "Compare products",
    description:
      "Put two to four catalogue products side by side in one call, with " +
      "price, brand, category, colourways and weight. Reads the catalogue " +
      "without moving the page, so the visitor keeps whatever they were " +
      "looking at.",
    inputSchema: {
      type: "object",
      properties: {
        products: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: { type: "string" },
          description:
            "Two to four product codes, product keys or exact product names.",
        },
      },
      required: ["products"],
    },
    // Genuinely read only: it calls no store setter and nothing on the page
    // changes. That is the difference between this and get_product, which opens
    // the product it was asked about, and the reason both exist.
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (args) => {
      const identifiers = (Array.isArray(args.products) ? args.products : []).map(
        (v) => String(v),
      );
      if (identifiers.length < 2 || identifiers.length > 4) {
        return text(
          `compare_products needs between two and four products, got ` +
            `${identifiers.length}. For a single one call get_product instead, ` +
            `which also opens it on the page.`,
        );
      }

      const resolved = await Promise.all(
        identifiers.map(async (id) => ({ id, r: await resolveProduct(id) })),
      );

      if (resolved.some(({ r }) => r.kind === "unreachable"))
        return text(NO_PRODUCTS_ENDPOINT);

      const found = resolved
        .filter(
          (x): x is { id: string; r: Extract<Resolution, { kind: "found" }> } =>
            x.r.kind === "found",
        )
        .map(({ id, r }) => ({ id, detail: r.detail }));
      const missing = resolved
        .filter(({ r }) => r.kind !== "found")
        .map(({ id }) => id);

      if (found.length < 2) {
        return text(
          `Only ${found.length} of ${identifiers.length} identifiers matched a ` +
            `catalogue product. Unmatched: ${missing.join(", ")}. The ` +
            `catalogue answered, so those are products we do not stock. Call ` +
            `search_products to get the exact codes, then try again.`,
        );
      }

      const rows = found
        .map(({ detail }) => {
          const { product, family } = detail;
          return (
            `${product.productCode}\n` +
            `  name         ${family.familyName}\n` +
            `  brand        ${product.brand}\n` +
            `  category     ${product.categoryName} / ${product.subCategoryName}\n` +
            `  colourways   ${family.colors.join(", ")}\n` +
            `  this one     ${product.color}\n` +
            `  weight       ${product.weight} ${product.weightUnit}\n` +
            `  list price   ${money(product.price)} USD` +
            (family.priceMin === family.priceMax
              ? ""
              : `  (family ranges ${money(family.priceMin)} to ${money(family.priceMax)})`)
          );
        })
        .join("\n\n");

      const cheapest = found.reduce((a, b) =>
        b.detail.product.price < a.detail.product.price ? b : a,
      );

      return text(
        `Comparing ${found.length} catalogue products. Prices are list prices ` +
          `in USD and exclude delivery.\n\n${rows}\n\n` +
          (missing.length > 0
            ? `Not found and left out: ${missing.join(", ")}.\n`
            : "") +
          `Cheapest of these is ${cheapest.detail.product.productCode} at ` +
          `${money(cheapest.detail.product.price)}. Weights use different ` +
          `units across products, so do not compare them without converting. ` +
          `Names and brand copy are the supplier's. To open one of these on ` +
          `the page, call get_product.`,
      );
    },
  };
}

/**
 * A facet argument. Carries a real enum read from the catalogue when the
 * endpoint answered at registration time, and degrades to free text when it did
 * not, rather than shipping a schema that promises values it cannot vouch for.
 */
function enumOrText(
  facet: { label: string }[] | undefined,
  description: string,
): Record<string, unknown> {
  if (!facet || facet.length === 0 || facet.length > 60)
    return { type: "string", description };
  return {
    type: "string",
    enum: ["", ...facet.map((f) => f.label)],
    description,
  };
}

function filterCatalog(facets: CatalogFacets | null): ToolSpec {
  const bands = facets?.priceBands ?? [];
  const bandHint =
    bands.length > 0
      ? " The page draws bands at " +
        bands
          .map((b) =>
            b.min === null
              ? `under $${b.max}`
              : b.max === null
                ? `$${b.min} and up`
                : `$${b.min} to $${b.max}`,
          )
          .join(", ") +
        ", but any range works."
      : "";

  return {
    name: "filter_catalog",
    title: "Filter the catalogue",
    description:
      "Set or drop any of the catalogue's facets and turn its pages. Category, " +
      "brand, subcategory, colour and a price range, all driving the real " +
      "controls, so the visitor watches their own page narrow. Pass an empty " +
      "string to drop one facet, or clear to drop the search text and every " +
      "facet at once.",
    inputSchema: {
      type: "object",
      properties: {
        category: enumOrText(
          facets?.categories,
          "Category to narrow to. Empty string drops the facet.",
        ),
        brand: enumOrText(
          facets?.brands,
          "Brand to narrow to. Empty string drops the facet.",
        ),
        subcategory: enumOrText(
          facets?.subcategories,
          "Subcategory to narrow to. Empty string drops the facet.",
        ),
        color: enumOrText(
          facets?.colors,
          "Colour to narrow to, lower case. A product matches when any of its " +
            "colourways does. Empty string drops the facet.",
        ),
        min_price: {
          type: "number",
          minimum: 0,
          description: `Lowest price to include, inclusive.${bandHint}`,
        },
        max_price: {
          type: "number",
          minimum: 0,
          description: "Highest price to include, exclusive.",
        },
        clear_price: {
          type: "boolean",
          description: "Drop the price range and leave the other facets alone.",
        },
        page: {
          type: "number",
          minimum: 1,
          description:
            `Which page of results to show, counting from 1. ` +
            `${CATALOG_PAGE_SIZE} products a page. Setting any facet returns ` +
            `to page 1 on its own.`,
        },
        clear: {
          type: "boolean",
          description:
            "Drop the search text and every facet. Ignores the other arguments.",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (args) => {
      if (args.clear === true) {
        clearCatalogFilters();
        const all = await readProducts(pageQuery());
        return text(
          all
            ? `Cleared the search text and every facet. The page now shows all ` +
                `${all.total} products, ${paging(all.total, 1)}. Call ` +
                `search_products to list them, or filter_catalog to narrow ` +
                `again.`
            : NO_PRODUCTS_ENDPOINT,
        );
      }

      const moved: string[] = [];
      const set = (
        value: unknown,
        apply: (v: string | null) => void,
        noun: string,
      ) => {
        if (typeof value !== "string") return;
        apply(value === "" ? null : value);
        moved.push(value === "" ? `${noun} dropped` : `${noun} ${value}`);
      };

      set(args.category, setCatalogCategory, "category");
      set(args.brand, setCatalogBrand, "brand");
      set(args.subcategory, setCatalogSubcategory, "subcategory");
      set(args.color, setCatalogColor, "colour");

      if (args.clear_price === true) {
        setCatalogPriceRange(null, null);
        moved.push("price range dropped");
      } else if (
        typeof args.min_price === "number" ||
        typeof args.max_price === "number"
      ) {
        const min =
          typeof args.min_price === "number" ? args.min_price : null;
        const max =
          typeof args.max_price === "number" ? args.max_price : null;
        setCatalogPriceRange(min, max);
        moved.push(
          `price ${min === null ? "any" : `$${min}`} to ` +
            `${max === null ? "any" : `under $${max}`}`,
        );
      }

      // Paging last, because every facet setter above resets it to 1.
      if (typeof args.page === "number") {
        const page = Math.max(1, Math.trunc(args.page));
        setCatalogPage(page);
        moved.push(`page ${page}`);
      }

      const state = getState();
      const found = await readProducts(pageQuery(state));
      if (!found) return text(NO_PRODUCTS_ENDPOINT);

      if (moved.length === 0) {
        return text(
          `Nothing was passed, so nothing moved. The page is filtered to ` +
            `${describeFilters(state)} and shows ${found.families.length} of ` +
            `${found.total} products, ${paging(found.total, state.catalogPage)}.`,
        );
      }

      if (found.total === 0) {
        return text(
          `The page is now filtered to ${describeFilters(state)}. ` +
            `${await narrowestConstraint(state)}`,
        );
      }

      const pages = Math.max(1, Math.ceil(found.total / CATALOG_PAGE_SIZE));
      return text(
        `The catalogue moved: ${moved.join(", ")}.\n\n` +
          `It is now filtered to ${describeFilters(state)} and shows ` +
          `${found.families.length} of ${found.total} products, ` +
          `${paging(found.total, state.catalogPage)}. That is what is on the ` +
          `visitor's screen.\n\n` +
          (state.catalogPage > pages
            ? `Page ${state.catalogPage} is past the end, so the page has ` +
                `settled back on ${pages}.\n\n`
            : "") +
          `Call search_products to list what is showing, or get_product to ` +
          `open one. Facet counts on the page are computed with every other ` +
          `filter applied, so a count there never promises an empty result.`,
      );
    },
  };
}

function setLanguage(): ToolSpec {
  return {
    name: "set_language",
    title: "Set the page language",
    description:
      "Switch the language of the Kestrel catalogue interface. Use this when " +
      "the person you are working for is not reading English, so the page in " +
      "front of them matches the conversation. Product names, brands and " +
      "colours stay in the supplier's own words in every language, because a " +
      "buyer has to be able to find a product under the name printed on it.",
    inputSchema: {
      type: "object",
      properties: {
        locale: {
          type: "string",
          enum: [...LOCALES],
          description:
            "Language code. en English, es Spanish, fr French, de German, ja Japanese.",
        },
      },
      required: ["locale"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (args) => {
      const wanted = String(args.locale ?? "");
      if (!(LOCALES as readonly string[]).includes(wanted)) {
        return text(
          `"${wanted}" is not one of the languages this catalogue speaks. ` +
            `Available: ${LOCALES.map((l) => `${l} (${LOCALE_NAMES[l]})`).join(", ")}.`,
        );
      }
      const locale = wanted as Locale;
      setLocale(locale);
      return text(
        `The catalogue is now in ${LOCALE_NAMES[locale]}. Prices stay in USD ` +
          `and only the number format changes. Product and brand names are ` +
          `unchanged by design. Everything else you can do here works the same ` +
          `in this language: search_products, filter_catalog, get_product, ` +
          `compare_products.`,
      );
    },
  };
}

/**
 * The five tools an anonymous visitor's agent gets.
 *
 * Async because the facet lists are read from the catalogue before the schemas
 * are built, so category, brand, subcategory and colour carry enums taken from
 * the data rather than free text an agent can typo. If the endpoint does not
 * answer, the schemas fall back to plain strings and everything still works.
 *
 * A sixth public tool, `search_catalog_form`, is registered by the browser
 * itself from the markup in src/ui/public/header.tsx. See src/mcp/declarative.ts.
 */
export async function publicTools(): Promise<ToolSpec[]> {
  const probe = await readProducts({ limit: 1 });
  const facets = probe ? probe.facets : null;
  return [
    searchProducts(facets),
    getProduct(),
    compareProducts(),
    filterCatalog(facets),
    setLanguage(),
  ];
}
