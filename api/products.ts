// GET /api/products - the public catalogue.
//
// The only endpoint an anonymous visitor reaches. It exposes price and never
// cost, which is why it selects columns explicitly rather than SELECT *.
//
// Filtering, paging and counting all happen here rather than in the browser, so
// that a WebMCP tool setting a filter takes exactly the path a click takes: the
// tool moves the store, the UI refetches, and the visitor watches their own
// page change.
//
// THE CATALOGUE IS A LIST OF FAMILIES, NOT OF SKUs.
//
// Contoso ships one row per colourway, so a nine-colour camera is nine rows at
// one identical price. The full warehouse dimension has 2,517 rows across 885
// families; this endpoint first narrows it to the photographed storefront
// manifest, then groups any selected colourways of one product. Product code,
// colour and price stay on the variant where they belong.
//
// A family matches a filter when any one of its variants does. Colour and price
// are the only fields that vary inside a family, so this is the rule that makes
// "families available in Blue" mean what a buyer expects, while still showing
// the whole colour range on the card once it is found.

import type { Product } from "../shared/types.js";
import catalogCodes from "../data/catalog-products.json";
import { query } from "./_lib/duckdb.js";
import { json, params } from "./_lib/http.js";

const COLUMNS = `
  product_key       AS productKey,
  product_code      AS productCode,
  product_name      AS productName,
  brand             AS brand,
  manufacturer      AS manufacturer,
  color             AS color,
  weight            AS weight,
  weight_unit       AS weightUnit,
  price             AS price,
  category_name     AS categoryName,
  subcategory_name  AS subCategoryName
`;

/** One SKU, plus the two grouping columns the contract does not carry. */
type VariantRow = Product & { familyKey: string; familyName: string };

/**
 * A product as the catalogue shows it: every colourway of one thing.
 *
 * Deliberately declared here and mirrored in src/api.ts rather than added to
 * shared/types.ts. `Product` is the frozen contract for a single SKU and it
 * still describes every variant below exactly; a family is a view over
 * products, not a new kind of thing the server and the client must agree on.
 */
export type ProductFamily = {
  familyKey: string;
  /** The product name with its trailing colour removed. Supplier copy. */
  familyName: string;
  brand: string;
  manufacturer: string;
  categoryName: string;
  subCategoryName: string;
  /** Equal to priceMax whenever the selected colourways share one price. */
  priceMin: number;
  priceMax: number;
  /** Distinct colours across the variants, cheapest variant first. */
  colors: string[];
  /** Every colourway, ordered by price then colour. Never empty. */
  variants: Product[];
};

/**
 * Price bands, defined once on the server so the UI renders what it is given
 * rather than a second copy of the boundaries. Labels are not sent: the public
 * surface speaks five languages and formats its own currency.
 */
const PRICE_BANDS: { min: number | null; max: number | null }[] = [
  { min: null, max: 50 },
  { min: 50, max: 200 },
  { min: 200, max: 500 },
  { min: 500, max: 1000 },
  { min: 1000, max: null },
];

const PAGE_DEFAULT = 24;
const RELATED_LIMIT = 4;

type Clause = { sql: string; values: unknown[] };

// The warehouse keeps the full Contoso dimension for analysis. The storefront
// is the smaller photographed range in data/catalog-products.json, so every
// card, swatch, facet count, detail page and related item uses the same scope.
const CATALOG: Clause = {
  sql: `product_code IN (${catalogCodes.map(() => "?").join(", ")})`,
  values: catalogCodes,
};

function and(...clauses: (Clause | null)[]): Clause {
  const live = clauses.filter((c): c is Clause => c !== null);
  return {
    sql: live.length ? `WHERE ${live.map((c) => c.sql).join(" AND ")}` : "",
    values: live.flatMap((c) => c.values),
  };
}

function eq(column: string, value: string | null): Clause | null {
  return value ? { sql: `${column} = ?`, values: [value] } : null;
}

function num(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function whole(value: string | null, fallback: number, max: number): number {
  const n = num(value);
  if (n === null) return fallback;
  return Math.min(Math.max(Math.trunc(n), 0), max);
}

// --------------------------------------------------------------- composing

/**
 * Turn variant rows into families, in the order the page query decided.
 *
 * The page query settles which families show and in what order; this fills them
 * in. Two queries rather than one aggregate with list() because the variant
 * rows are the honest shape and nothing has to be parsed back out of a string.
 */
function toFamilies(order: string[], rows: VariantRow[]): ProductFamily[] {
  const byKey = new Map<string, VariantRow[]>();
  for (const row of rows) {
    const bucket = byKey.get(row.familyKey);
    if (bucket) bucket.push(row);
    else byKey.set(row.familyKey, [row]);
  }

  const families: ProductFamily[] = [];
  for (const key of order) {
    const variants = byKey.get(key);
    if (!variants || variants.length === 0) continue;
    const first = variants[0];
    const prices = variants.map((v) => v.price);
    families.push({
      familyKey: key,
      familyName: first.familyName,
      brand: first.brand,
      manufacturer: first.manufacturer,
      categoryName: first.categoryName,
      subCategoryName: first.subCategoryName,
      priceMin: Math.min(...prices),
      priceMax: Math.max(...prices),
      colors: [...new Set(variants.map((v) => v.color))],
      // Strip the two grouping columns back off, so what the client receives is
      // exactly the frozen `Product` contract.
      variants: variants.map(
        ({ familyKey: _k, familyName: _n, ...product }) => product,
      ),
    });
  }
  return families;
}

/** Every variant of the given families, ordered so the cheapest leads. */
async function variantsOf(keys: string[]): Promise<VariantRow[]> {
  if (keys.length === 0) return [];
  const holes = keys.map(() => "?").join(", ");
  const scoped = and(CATALOG, {
    sql: `family_key IN (${holes})`,
    values: keys,
  });
  return query<VariantRow>(
    `SELECT ${COLUMNS}, family_key AS familyKey, family_name AS familyName
     FROM dim_product ${scoped.sql}
     ORDER BY price, color, product_key`,
    scoped.values,
  );
}

async function familiesFor(keys: string[]): Promise<ProductFamily[]> {
  return toFamilies(keys, await variantsOf(keys));
}

// ----------------------------------------------------------------- handler

export async function GET(request: Request): Promise<Response> {
  const p = params(request);

  const key = p.get("productKey");
  if (key) return detail(Number(key));

  const search = p.get("search")?.trim() ?? "";
  const category = p.get("category");
  const brand = p.get("brand");
  const subcategory = p.get("subcategory");
  const color = p.get("color");
  const minPrice = num(p.get("minPrice"));
  const maxPrice = num(p.get("maxPrice"));

  const limit = Math.max(whole(p.get("limit"), PAGE_DEFAULT, 200), 1);
  const offset = whole(p.get("offset"), 0, 100000);

  // Free text narrows everything. Someone reading off a purchase order searches
  // by the product code, so that is matched too, and the family name is matched
  // so that a search for the thing finds it whatever colour it comes in.
  const base: (Clause | null)[] = [CATALOG];
  if (search) {
    const like = `%${search.toLowerCase()}%`;
    base.push({
      sql:
        "(lower(product_name) LIKE ? OR lower(family_name) LIKE ?" +
        " OR lower(brand) LIKE ? OR lower(product_code) LIKE ?)",
      values: [like, like, like, like],
    });
  }

  // Colour is stored inconsistently - 3 rows say "blue" where 602 say "Black" -
  // so the facet and the filter are both folded to lower case. Normalising one
  // side only would make those rows unreachable. The client capitalises the
  // label for display; the variant's own colour is shown exactly as recorded.
  const colorClause = color
    ? { sql: "lower(color) = ?", values: [color.toLowerCase()] }
    : null;
  const priceClause: Clause | null =
    minPrice === null && maxPrice === null
      ? null
      : {
          sql: [
            minPrice === null ? null : "price >= ?",
            maxPrice === null ? null : "price < ?",
          ]
            .filter(Boolean)
            .join(" AND "),
          values: [minPrice, maxPrice].filter((v): v is number => v !== null),
        };

  const categoryClause = eq("category_name", category);
  const brandClause = eq("brand", brand);
  const subcategoryClause = eq("subcategory_name", subcategory);

  const all = and(
    ...base,
    categoryClause,
    brandClause,
    subcategoryClause,
    colorClause,
    priceClause,
  );

  // Order is category then family name, with the key as a tiebreaker so that
  // page 2 cannot repeat or skip a row that page 1 already showed.
  const page = await query<{ familyKey: string }>(
    `SELECT family_key AS familyKey FROM dim_product ${all.sql}
     GROUP BY family_key
     ORDER BY any_value(category_name), any_value(family_name), family_key
     LIMIT ${limit} OFFSET ${offset}`,
    all.values,
  );

  const families = await familiesFor(page.map((r) => r.familyKey));

  // Each facet is counted with every filter applied except its own, so a count
  // never promises a page that turns out empty once you click it. Counts are of
  // families rather than rows, because families are what the grid lists.
  const forCategories = and(...base, brandClause, subcategoryClause, colorClause, priceClause);
  const forBrands = and(...base, categoryClause, subcategoryClause, colorClause, priceClause);
  const forSubcategories = and(...base, categoryClause, brandClause, colorClause, priceClause);
  const forColors = and(...base, categoryClause, brandClause, subcategoryClause, priceClause);
  const forPrices = and(...base, categoryClause, brandClause, subcategoryClause, colorClause);

  const facetSql = (expression: string, where: string) =>
    `SELECT ${expression} AS label, count(DISTINCT family_key) AS n
     FROM dim_product ${where} GROUP BY 1 ORDER BY 1`;

  // The band boundaries come from PRICE_BANDS above, never from the request, so
  // this interpolation carries no user input.
  const bandCase =
    "CASE " +
    PRICE_BANDS.slice(0, -1)
      .map((b, i) => `WHEN price < ${b.max} THEN ${i}`)
      .join(" ") +
    ` ELSE ${PRICE_BANDS.length - 1} END`;

  const [categories, brands, subcategories, colors, bandRows, total] =
    await Promise.all([
      query<{ label: string; n: number }>(
        facetSql("category_name", forCategories.sql),
        forCategories.values,
      ),
      query<{ label: string; n: number }>(
        facetSql("brand", forBrands.sql),
        forBrands.values,
      ),
      query<{ label: string; n: number }>(
        facetSql("subcategory_name", forSubcategories.sql),
        forSubcategories.values,
      ),
      query<{ label: string; n: number }>(
        facetSql("lower(color)", forColors.sql),
        forColors.values,
      ),
      query<{ band: number; n: number }>(
        `SELECT ${bandCase} AS band, count(DISTINCT family_key) AS n
         FROM dim_product ${forPrices.sql} GROUP BY 1 ORDER BY 1`,
        forPrices.values,
      ),
      query<{ n: number }>(
        `SELECT count(DISTINCT family_key) AS n FROM dim_product ${all.sql}`,
        all.values,
      ),
    ]);

  const counted = new Map(bandRows.map((r) => [Number(r.band), r.n]));
  const priceBands = PRICE_BANDS.map((band, i) => ({
    ...band,
    n: counted.get(i) ?? 0,
  }));

  return json({
    families,
    total: total[0]?.n ?? 0,
    offset,
    limit,
    facets: { categories, brands, subcategories, colors, priceBands },
  });
}

/**
 * One SKU, its whole family, and neighbouring families.
 *
 * Keyed by ProductKey rather than by family, because opening a product is
 * `selectProduct(productKey)` in the store and picking a different colour on
 * the page is the same call with a different key. One door for both.
 */
async function detail(productKey: number): Promise<Response> {
  const selected = and(CATALOG, { sql: "product_key = ?", values: [productKey] });
  const rows = await query<VariantRow>(
    `SELECT ${COLUMNS}, family_key AS familyKey, family_name AS familyName
     FROM dim_product ${selected.sql}`,
    selected.values,
  );
  if (rows.length === 0) return json({ error: "No such product" }, 404);

  const row = rows[0];
  const [family] = await familiesFor([row.familyKey]);

  // Related is other families in the same subcategory. Excluding the family
  // rather than the key matters now: excluding the key alone would fill the row
  // with the same product in four other colours.
  const related = and(CATALOG, {
    sql: "subcategory_name = ? AND family_key <> ?",
    values: [row.subCategoryName, row.familyKey],
  });
  const near = await query<{ familyKey: string }>(
    `SELECT family_key AS familyKey FROM dim_product ${related.sql}
     GROUP BY family_key
     ORDER BY min(price), family_key LIMIT ${RELATED_LIMIT}`,
    related.values,
  );

  const { familyKey: _k, familyName: _n, ...product } = row;
  return json({
    product,
    family,
    related: await familiesFor(near.map((r) => r.familyKey)),
  });
}
