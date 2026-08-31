// The typed client shared by the UI and WebMCP tools.

import { ofetch } from "ofetch";
import type {
  DimensionId,
  Filters,
  Lineage,
  MetricId,
  MetricResult,
  PipelineRun,
  Product,
  TrustReport,
} from "@shared/types";

type Query = Record<string, string | number | boolean | null | undefined>;

const http = ofetch.create({
  baseURL: "/api",
  headers: { accept: "application/json" },
  responseType: "json",
  retry: 0,
});

function get<T>(path: string, query?: Query): Promise<T> {
  return http<T>(path, {
    query: query
      ? Object.fromEntries(
          Object.entries(query).filter(
            ([, value]) => value !== null && value !== undefined && value !== "",
          ),
        )
      : undefined,
  });
}

export function fetchMetric(args: {
  metric: MetricId;
  period: string;
  dimension?: DimensionId;
  filters?: Filters;
  limit?: number;
}): Promise<MetricResult> {
  const { metric, period, dimension, filters = {}, limit } = args;
  return get<MetricResult>("query", {
    metric,
    period,
    dimension,
    limit,
    ...filters,
  });
}

export type TrustResponse = TrustReport & { metricLabel: string };

export function fetchTrust(args: {
  metric: MetricId;
  period: string;
  filters?: Filters;
}): Promise<TrustResponse> {
  const { metric, period, filters = {} } = args;
  return get<TrustResponse>("trust", { metric, period, ...filters });
}

/** The node the endpoint returns: the contract's, plus the derived rejection. */
export type LineageNodeView = Lineage["nodes"][number] & { rejected?: number };

export type LineageResponse = Omit<Lineage, "nodes"> & {
  nodes: LineageNodeView[];
};

export function fetchLineage(metric?: MetricId): Promise<LineageResponse> {
  return get<LineageResponse>("lineage", { metric });
}

export function fetchRuns(): Promise<{ runs: PipelineRun[] }> {
  return get<{ runs: PipelineRun[] }>("runs");
}

export type Facet = { label: string; n: number };

/** A price bucket the server counted. Labels are formatted client side. */
export type PriceBand = { min: number | null; max: number | null; n: number };

/**
 * A product as the catalogue shows it: every colourway of one thing.
 *
 * Mirrors the shape api/products.ts composes. Deliberately not in
 * shared/types.ts: `Product` is the frozen contract for one SKU and still
 * describes every variant below exactly, so a family is a view over products
 * rather than a new thing the two sides must agree on.
 */
export type ProductFamily = {
  familyKey: string;
  /** The product name with its trailing colour removed. Supplier copy. */
  familyName: string;
  brand: string;
  manufacturer: string;
  categoryName: string;
  subCategoryName: string;
  /** Equal to priceMax for all but 27 of the 885 families. */
  priceMin: number;
  priceMax: number;
  colors: string[];
  /** Every colourway, cheapest first. Never empty. */
  variants: Product[];
};

export type CatalogFacets = {
  categories: Facet[];
  brands: Facet[];
  subcategories: Facet[];
  /** Lower case, folded so "blue" and "Blue" are one option. */
  colors: Facet[];
  priceBands: PriceBand[];
};

export type ProductsResponse = {
  families: ProductFamily[];
  /** How many families match, which is not how many this page returned. */
  total: number;
  offset: number;
  limit: number;
  facets: CatalogFacets;
};

export type ProductQueryArgs = {
  search?: string;
  category?: string | null;
  brand?: string | null;
  subcategory?: string | null;
  color?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  offset?: number;
  limit?: number;
};

export function fetchProducts(args: ProductQueryArgs): Promise<ProductsResponse> {
  return get<ProductsResponse>("products", args);
}

export type ProductDetailResponse = {
  /** The one SKU that was asked for. */
  product: Product;
  /** Its whole family, including the variant above. */
  family: ProductFamily;
  /** Other families in the same subcategory, never this one in other colours. */
  related: ProductFamily[];
};

export function fetchProduct(
  productKey: number,
): Promise<ProductDetailResponse> {
  return get<ProductDetailResponse>("products", { productKey });
}
