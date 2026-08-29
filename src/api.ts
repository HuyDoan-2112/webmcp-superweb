// Typed fetch wrappers around /api/*.
//
// The UI calls these. WebMCP tools do not: a tool drives the UI, and the UI
// calls the API, which is the same path a click takes. If you are importing
// this file from src/mcp/, you are writing the wrong layer.

import type {
  Dimension,
  DimensionId,
  Filters,
  Lineage,
  Metric,
  MetricId,
  MetricResult,
  PipelineRun,
  Product,
  Session,
  TrustReport,
} from "@shared/types";

export class ApiFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
  }
}

function search(params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string; detail?: string })
    | null;

  if (!response.ok || body === null) {
    throw new ApiFailure(
      body?.error ?? `Request failed with ${response.status}`,
      response.status,
      body?.detail,
    );
  }
  return body;
}

// ---------------------------------------------------------------- registry

export type MetricsResponse = {
  metrics: Metric[];
  dimensions: Dimension[];
  demoPeriod: string;
  session: Session;
};

/** Fetched during boot. Tools register only after this resolves. */
export function fetchMetrics(): Promise<MetricsResponse> {
  return get<MetricsResponse>("/api/metrics");
}

// ------------------------------------------------------------------ query

export function fetchMetric(args: {
  metric: MetricId;
  period: string;
  dimension?: DimensionId;
  filters?: Filters;
  limit?: number;
}): Promise<MetricResult> {
  const { metric, period, dimension, filters = {}, limit } = args;
  return get<MetricResult>(
    `/api/query${search({ metric, period, dimension, limit, ...filters })}`,
  );
}

// ------------------------------------------------------------------ trust

export type TrustResponse = TrustReport & { metricLabel: string };

export function fetchTrust(args: {
  metric: MetricId;
  period: string;
  filters?: Filters;
}): Promise<TrustResponse> {
  const { metric, period, filters = {} } = args;
  return get<TrustResponse>(`/api/trust${search({ metric, period, ...filters })}`);
}

// ---------------------------------------------------------------- lineage

/** The node the endpoint returns: the contract's, plus the derived rejection. */
export type LineageNodeView = Lineage["nodes"][number] & { rejected?: number };

export type LineageResponse = Omit<Lineage, "nodes"> & {
  nodes: LineageNodeView[];
};

export function fetchLineage(): Promise<LineageResponse> {
  return get<LineageResponse>("/api/lineage");
}

// ------------------------------------------------------------------- runs

export function fetchRuns(): Promise<{ runs: PipelineRun[] }> {
  return get<{ runs: PipelineRun[] }>("/api/runs");
}

// --------------------------------------------------------------- products

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

export function fetchProducts(args: {
  search?: string;
  category?: string | null;
  brand?: string | null;
  subcategory?: string | null;
  color?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  offset?: number;
  limit?: number;
}): Promise<ProductsResponse> {
  return get<ProductsResponse>(`/api/products${search({ ...args })}`);
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
  return get<ProductDetailResponse>(`/api/products${search({ productKey })}`);
}
