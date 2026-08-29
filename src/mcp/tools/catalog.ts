// The public tool surface: what an anonymous visitor's agent can do.
//
// Registered for everyone, including someone who never signs in. Nothing here
// is refused to anyone. The surface grows with context, it does not gate on
// identity.
//
// Every one of these is layer 2: a few lines wrapping a store setter that
// already exists, so the tool takes the same path a click takes and the page
// visibly moves when the agent acts. The one piece of real logic is the
// steering text, which is where the agent is told what to do next.
//
// `untrustedContentHint: true` on everything that returns product copy. Product
// names, brand names and manufacturer names are third party text we did not
// write, which is exactly what the annotation is for.
//
// Product rows are read from the catalogue's own module rather than fetched
// here, so there is one list, not two. When /api/query serves products, that
// module fetches and this file does not change.

import {
  BRANDS,
  CATEGORIES,
  SAMPLE_PRODUCTS,
  availabilityOf,
  type Product,
} from "@/ui/public/sample-products";
import { LOCALES, LOCALE_NAMES } from "@/ui/public/i18n";
import {
  clearCatalogFilters,
  getState,
  selectProduct,
  setCatalogBrand,
  setCatalogCategory,
  setCatalogSearch,
  setLocale,
  type Locale,
} from "@/store";
import { text, type ToolSpec } from "../adapter";

/**
 * Mirrors `matchesSearch` in src/ui/public/catalog.tsx, which does not export
 * it. Lift both onto one exported selector when that file settles, so the agent
 * and the grid cannot disagree about what matched.
 */
function matches(product: Product, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return (
    product.productName.toLowerCase().includes(q) ||
    product.productCode.toLowerCase().includes(q) ||
    product.brand.toLowerCase().includes(q)
  );
}

function visible(query: string, category: string | null, brand: string | null) {
  return SAMPLE_PRODUCTS.filter(
    (p) =>
      matches(p, query) &&
      (category === null || p.categoryName === category) &&
      (brand === null || p.brand === brand),
  );
}

function line(p: Product): string {
  return (
    `${p.productCode}  ${p.productName}  ` +
    `[${p.brand} / ${p.categoryName} / ${p.subCategoryName}]  ` +
    `$${p.price.toFixed(2)}  ${p.color}  ${p.weight} ${p.weightUnit}  ` +
    `${availabilityOf(p)}`
  );
}

function find(identifier: string): Product | undefined {
  const key = identifier.trim().toLowerCase();
  return SAMPLE_PRODUCTS.find(
    (p) =>
      p.productCode.toLowerCase() === key ||
      String(p.productKey) === key ||
      p.productName.toLowerCase() === key,
  );
}

/**
 * When a search comes back empty, say which filter is doing the damage.
 *
 * A dead end with no next step in it is the single most common way an agent
 * gives up on a page, so the narrowest constraint is named and dropping it is
 * suggested by tool name.
 */
function emptyAdvice(
  query: string,
  category: string | null,
  brand: string | null,
): string {
  const counts: { label: string; kept: number; drop: string }[] = [];
  if (query.trim() !== "")
    counts.push({
      label: `the search text "${query.trim()}"`,
      kept: visible("", category, brand).length,
      drop: "call search_products again with an empty query",
    });
  if (category !== null)
    counts.push({
      label: `the category filter "${category}"`,
      kept: visible(query, null, brand).length,
      drop: 'call filter_catalog with category set to "" to drop it',
    });
  if (brand !== null)
    counts.push({
      label: `the brand filter "${brand}"`,
      kept: visible(query, category, null).length,
      drop: 'call filter_catalog with brand set to "" to drop it',
    });

  if (counts.length === 0) {
    return "The catalogue itself is empty, which is a fault rather than a result.";
  }
  const worst = counts.sort((a, b) => b.kept - a.kept)[0];
  return (
    `Nothing matched. The narrowest constraint is ${worst.label}: without it ` +
    `${worst.kept} line${worst.kept === 1 ? "" : "s"} would show. To widen, ` +
    `${worst.drop}. Categories in stock: ${CATEGORIES.join(", ")}.`
  );
}

// --------------------------------------------------------------------------

function searchProducts(): ToolSpec {
  return {
    name: "search_products",
    title: "Search the catalogue",
    description:
      "Search the Kestrel Supply Co. trade catalogue by keyword, and " +
      "optionally narrow it to one category or brand. This moves the page the " +
      "visitor is looking at: the search box fills in and the grid re-ranks, " +
      "so what you report and what they see are the same thing.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Free text matched against product name, product code and brand. " +
            "Pass an empty string to clear the text filter.",
        },
        category: {
          type: "string",
          enum: [...CATEGORIES],
          description: "Limit to one category. Omit for all categories.",
        },
        brand: {
          type: "string",
          enum: [...BRANDS],
          description: "Limit to one brand. Omit for all brands.",
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 24,
          description: "How many lines to list back. Defaults to 12.",
        },
      },
      required: [],
    },
    // Not read only: it moves the catalogue the visitor is looking at, which is
    // the point of it. untrustedContentHint because the rows carry supplier copy.
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args) => {
      const query = typeof args.query === "string" ? args.query : "";
      const category =
        typeof args.category === "string" && args.category !== ""
          ? args.category
          : null;
      const brand =
        typeof args.brand === "string" && args.brand !== "" ? args.brand : null;
      const limit = typeof args.limit === "number" ? Math.trunc(args.limit) : 12;

      // Drive the UI. Same setters the header input and the facet buttons call.
      setCatalogSearch(query);
      setCatalogCategory(category);
      setCatalogBrand(brand);

      const rows = visible(query, category, brand);
      if (rows.length === 0) {
        return text(
          `${emptyAdvice(query, category, brand)} The page now shows the empty ` +
            `state, so the visitor can see the same thing you can.`,
        );
      }

      const shown = rows.slice(0, Math.max(1, limit));
      return text(
        `${rows.length} of ${SAMPLE_PRODUCTS.length} catalogue lines match. ` +
          `The page has moved to this result.\n\n` +
          shown.map(line).join("\n") +
          (rows.length > shown.length
            ? `\n\n${rows.length - shown.length} more not listed. Raise limit, ` +
              `or narrow with filter_catalog.`
            : "") +
          `\n\nProduct names and brand copy above come from the supplier, not ` +
          `from us. To open one line on the page and read its full detail, call ` +
          `get_product with its product code. To put two to four of them side ` +
          `by side in one call, use compare_products.`,
      );
    },
  };
}

function getProduct(): ToolSpec {
  return {
    name: "get_product",
    title: "Open one product",
    description:
      "Open one catalogue line on the page and read its full detail. Takes a " +
      "product code, a product key or an exact product name. The visitor's " +
      "screen moves to that product.",
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
      const identifier = String(args.product ?? "");
      const product = find(identifier);
      if (!product) {
        const near = SAMPLE_PRODUCTS.filter((p) =>
          matches(p, identifier),
        ).slice(0, 5);
        return text(
          `No catalogue line is identified by "${identifier}". ` +
            (near.length > 0
              ? `Closest by text:\n${near.map(line).join("\n")}\n` +
                `Call get_product again with one of those product codes.`
              : `Call search_products first to find the code, then pass it here.`),
        );
      }

      selectProduct(product.productKey);
      return text(
        `Opened ${product.productName} on the page.\n\n` +
          `product code   ${product.productCode}\n` +
          `brand          ${product.brand}\n` +
          `manufacturer   ${product.manufacturer}\n` +
          `category       ${product.categoryName} / ${product.subCategoryName}\n` +
          `colour         ${product.color}\n` +
          `weight         ${product.weight} ${product.weightUnit}\n` +
          `list price     $${product.price.toFixed(2)} USD\n` +
          `availability   ${availabilityOf(product)}\n\n` +
          `All of the above except availability is supplier copy, not ours. ` +
          `To weigh it against others, call compare_products with this code ` +
          `and one to three more. To go back to the grid, call search_products.`,
      );
    },
  };
}

function compareProducts(): ToolSpec {
  return {
    name: "compare_products",
    title: "Compare products",
    description:
      "Put two to four catalogue lines side by side in one call, with price, " +
      "brand, category, colour, weight and availability. Reads the catalogue " +
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
    // changes. That is the difference between this and get_product, which
    // opens the product it was asked about, and the reason both exist.
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (args) => {
      const raw = Array.isArray(args.products) ? args.products : [];
      const identifiers = raw.map((v) => String(v));
      if (identifiers.length < 2 || identifiers.length > 4) {
        return text(
          `compare_products needs between two and four products, got ` +
            `${identifiers.length}. For a single line call get_product instead, ` +
            `which also opens it on the page.`,
        );
      }

      const found: Product[] = [];
      const missing: string[] = [];
      for (const id of identifiers) {
        const p = find(id);
        if (p) found.push(p);
        else missing.push(id);
      }
      if (found.length < 2) {
        return text(
          `Only ${found.length} of ${identifiers.length} identifiers matched a ` +
            `catalogue line. Unmatched: ${missing.join(", ")}. Call ` +
            `search_products to get the exact product codes, then try again.`,
        );
      }

      const cheapest = found.reduce((a, b) => (b.price < a.price ? b : a));
      const rows = found
        .map(
          (p) =>
            `${p.productCode}\n` +
            `  name         ${p.productName}\n` +
            `  brand        ${p.brand}\n` +
            `  category     ${p.categoryName} / ${p.subCategoryName}\n` +
            `  colour       ${p.color}\n` +
            `  weight       ${p.weight} ${p.weightUnit}\n` +
            `  list price   $${p.price.toFixed(2)} USD\n` +
            `  availability ${availabilityOf(p)}`,
        )
        .join("\n\n");

      return text(
        `Comparing ${found.length} catalogue lines. Prices are list prices in ` +
          `USD and exclude delivery.\n\n${rows}\n\n` +
          (missing.length > 0
            ? `Not found and left out: ${missing.join(", ")}.\n`
            : "") +
          `Cheapest of these is ${cheapest.productCode} at ` +
          `$${cheapest.price.toFixed(2)}. Weights use different units across ` +
          `lines, so do not compare them without converting. Names and brand ` +
          `copy are the supplier's. To open one of these on the page, call ` +
          `get_product.`,
      );
    },
  };
}

function filterCatalog(): ToolSpec {
  return {
    name: "filter_catalog",
    title: "Filter the catalogue",
    description:
      "Set or drop the category and brand facets on the catalogue. This drives " +
      "the actual facet controls, so the visitor watches their page narrow. " +
      "Pass an empty string to drop one facet, or set clear to true to drop " +
      "the search text and both facets at once.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["", ...CATEGORIES],
          description: 'Category to narrow to. Empty string drops the facet.',
        },
        brand: {
          type: "string",
          enum: ["", ...BRANDS],
          description: 'Brand to narrow to. Empty string drops the facet.',
        },
        clear: {
          type: "boolean",
          description: "Drop the search text and both facets. Ignores the other arguments.",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (args) => {
      if (args.clear === true) {
        clearCatalogFilters();
        return text(
          `Cleared the search text and both facets. The page now shows all ` +
            `${SAMPLE_PRODUCTS.length} catalogue lines. Call search_products ` +
            `to narrow it again.`,
        );
      }

      if (typeof args.category === "string")
        setCatalogCategory(args.category === "" ? null : args.category);
      if (typeof args.brand === "string")
        setCatalogBrand(args.brand === "" ? null : args.brand);

      const s = getState();
      const rows = visible(
        s.catalogSearch,
        s.catalogFilters.category,
        s.catalogFilters.brand,
      );
      const described =
        [
          s.catalogSearch.trim() !== "" ? `"${s.catalogSearch.trim()}"` : null,
          s.catalogFilters.category,
          s.catalogFilters.brand,
        ]
          .filter((v): v is string => v !== null)
          .join(" + ") || "no filter";

      if (rows.length === 0) {
        return text(
          `The page is now filtered to ${described} and nothing matches. ` +
            emptyAdvice(
              s.catalogSearch,
              s.catalogFilters.category,
              s.catalogFilters.brand,
            ),
        );
      }
      return text(
        `The page is now filtered to ${described}. ${rows.length} of ` +
          `${SAMPLE_PRODUCTS.length} lines show. Call search_products to list ` +
          `them, or get_product to open one.`,
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
      "buyer has to be able to find a line under the name printed on it.",
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

/** The five tools an anonymous visitor's agent gets. */
export function publicTools(): ToolSpec[] {
  return [
    searchProducts(),
    getProduct(),
    compareProducts(),
    filterCatalog(),
    setLanguage(),
  ];
}
