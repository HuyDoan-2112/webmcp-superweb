// The read seam between the tool layer and the pipeline's own answers.
//
// WHERE THE LINE IS, because CLAUDE.md says "a tool never queries data itself"
// and this file calls fetch, and the next person to read both will think the
// two contradict each other. They do not. The line has two halves:
//
//   A tool that MOVES THE PAGE must go through the store, never around it.
//   Every setter a tool calls is one a click already calls, so the human and
//   the agent share one state path and the page visibly moves when the agent
//   acts. There is no second code path to keep honest.
//
//   A tool ANSWERING A QUESTION about data the page is already showing may read
//   the same endpoint the page read. docs/PLAN.md section 5 specifies exactly
//   this for the trust gate: per section, GET /api/query then GET /api/trust.
//   The dashboard renders a verdict for the slice it is on; it cannot render a
//   verdict for a slice nobody asked for, and the gate has to check every
//   section before it writes one.
//
// Neither half may touch DuckDB or compose SQL. That is the thing the rule was
// written to prevent, because a tool running its own query would just be a
// badly hosted MCP server wearing a browser as a costume. There is no DuckDB
// import here, no SQL, and no database connection.
//
// The endpoints answer under `npm run dev`, which serves api/ in process
// and during the build week that is often not the case. So every reader tries
// /api/* first and falls back to the committed artifact under data/meta/ that
// the endpoint itself reads: api/_lib/trust.ts loads exactly this file. The
// verdict therefore cannot change depending on whether the function was up, and
// every tool that fell back says which source answered rather than passing an
// artifact read off as a live one.
//
// This file does not import src/api.ts. That module is the UI's fetch layer and
// says so at the top; the two stay separate so a change to the dashboard's
// loading behaviour cannot silently change what a tool reports.
//
// Owner note: once /api is reliably up in the demo environment, delete the
// fallbacks and the `source` field. Nothing else in src/mcp/ changes.

import type {
  DimensionId,
  Lineage,
  MetricId,
  MetricResult,
  PipelineRun,
  Product,
  Promotion,
  PromotionOutcome,
  TrustReport,
  TrustVerdict,
} from "@shared/types";

// The pipeline artifacts, committed by etl/run.py. Three small JSON files,
// about 8 KB together, so bundling them costs nothing measurable.
import qualityChecks from "../../data/meta/quality_checks.json";
import lineageDoc from "../../data/meta/lineage.json";
import runsDoc from "../../data/meta/pipeline_runs.json";

/** Where an answer came from. Reported to the agent, never hidden. */
export type ReadSource = "api" | "pipeline artifact";

export type Sourced<T> = { value: T; source: ReadSource };

/**
 * One evaluated check, as etl/checks.py writes it.
 *
 * Wider than `Check` in shared/types.ts, because the artifact carries the slice
 * the check was evaluated over. That is the whole reason check_data_trust can
 * accept a filter: the verdict ranges over metric plus period plus filter, and
 * a verdict that could not see the filter would block four sound sections to
 * protect one broken one.
 */
export type CheckRow = {
  name: string;
  metric: MetricId;
  period: string;
  dimension: DimensionId | null;
  value: string | null;
  passed: boolean;
  verdict: TrustVerdict;
  expectedRows: number;
  rejectedRows: number;
  detail: string;
  plainLanguage: string;
  /** The run that produced the data. Present when /api/trust answered. */
  runId?: string;
};

export type QualityDoc = {
  runId: string;
  period: string;
  checks: CheckRow[];
};

const ARTIFACT_QUALITY = qualityChecks as unknown as QualityDoc;
const ARTIFACT_LINEAGE = lineageDoc as unknown as Lineage;
const ARTIFACT_RUNS = runsDoc as unknown as PipelineRun[];

/**
 * Try one endpoint. Returns null on anything that is not a JSON 200, which
 * covers the stub endpoints today: the dev server answers /api/* with the SPA
 * index when nothing is proxying, and that is an HTML 200, not an answer.
 */
async function tryJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("json")) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const body = search.toString();
  return body === "" ? "" : `?${body}`;
}

// ------------------------------------------------------------------- trust

/**
 * The slice a verdict is asked about. `dimension` plus `value` is the filter:
 * country = Germany, channel = Online, or neither for the whole period.
 */
export type TrustSlice = {
  metric: MetricId;
  period: string;
  dimension?: DimensionId;
  value?: string;
};

/**
 * Fold a TrustReport into the flat check row the tools read.
 *
 * /api/trust answers in the frozen `TrustReport` shape from shared/types.ts,
 * and the depth of its `checks` depends on who is asking: someone in Operations
 * gets "completeness" where an engineer gets "fx_rate_not_null". That is the
 * server's decision and it is passed through untouched rather than reversed
 * here.
 */
function fromTrustReport(report: TrustReport, slice: TrustSlice): CheckRow {
  const worst =
    report.checks.find((c) => !c.passed) ?? report.checks[0] ?? null;
  return {
    name: worst?.name ?? "completeness",
    metric: report.metric,
    period: report.period,
    dimension: slice.dimension ?? null,
    value: slice.value ?? null,
    passed: worst ? worst.passed : report.verdict === "ok",
    verdict: report.verdict,
    expectedRows: worst?.expectedRows ?? 0,
    rejectedRows: worst?.rejectedRows ?? 0,
    detail: worst?.detail ?? "",
    runId: report.runId,
    plainLanguage:
      report.plainLanguage ??
      (report.verdict === "ok"
        ? "Every row that should be behind this figure was counted."
        : "Some of the rows behind this figure were never counted."),
  };
}

/**
 * Read the check that governs one slice.
 *
 * Returns null when the pipeline recorded nothing for that slice, which is a
 * different answer from "it passed" and is reported as such.
 */
export async function readCheck(
  slice: TrustSlice,
): Promise<Sourced<CheckRow | null>> {
  const live = await tryJson<TrustReport>(
    `/api/trust${qs({
      metric: slice.metric,
      period: slice.period,
      // Filters travel as dimension-named query keys, which is what
      // api/_lib/compose.ts parseFilters reads.
      ...(slice.dimension ? { [slice.dimension]: slice.value } : {}),
    })}`,
  );
  if (live && typeof live.verdict === "string") {
    return { value: fromTrustReport(live, slice), source: "api" };
  }

  const wanted = ARTIFACT_QUALITY.checks.filter(
    (c) => c.period === slice.period,
  );
  const match = wanted.find(
    (c) =>
      c.dimension === (slice.dimension ?? null) &&
      (c.value ?? null) === (slice.value ?? null),
  );
  return { value: match ?? null, source: "pipeline artifact" };
}

/**
 * Every check recorded for a period.
 *
 * There is no endpoint that lists slices, and there should not be one: it is
 * the pipeline's record, not a query. Read straight from the artifact the
 * server reads.
 */
export async function readChecks(period: string): Promise<Sourced<CheckRow[]>> {
  return {
    value: ARTIFACT_QUALITY.checks.filter((c) => c.period === period),
    source: "pipeline artifact",
  };
}

/** The period the pipeline last evaluated checks over. */
export function checkedPeriod(): string {
  return ARTIFACT_QUALITY.period;
}

/** The run that produced the numbers the checks were evaluated against. */
export function checkedRunId(): string {
  return ARTIFACT_QUALITY.runId;
}

/**
 * The filter values the pipeline actually evaluated on one axis, sorted.
 *
 * Synchronous, because tool schemas are built at registration time and an enum
 * cannot wait on a fetch. Reading it from the pipeline artifact rather than
 * hardcoding a country list means the agent cannot name a slice that has no
 * verdict behind it.
 */
export function recordedValues(dimension: DimensionId): string[] {
  return [
    ...new Set(
      ARTIFACT_QUALITY.checks
        .filter((c) => c.dimension === dimension && c.value !== null)
        .map((c) => c.value as string),
    ),
  ].sort();
}

// ----------------------------------------------------------------- lineage

export async function readLineage(metric: MetricId): Promise<Sourced<Lineage>> {
  const live = await tryJson<Lineage>(`/api/lineage${qs({ metric })}`);
  if (live) return { value: live, source: "api" };
  return { value: ARTIFACT_LINEAGE, source: "pipeline artifact" };
}

// -------------------------------------------------------------------- runs

export async function readRuns(): Promise<Sourced<PipelineRun[]>> {
  const live = await tryJson<PipelineRun[]>("/api/runs");
  if (live) return { value: live, source: "api" };
  return { value: ARTIFACT_RUNS, source: "pipeline artifact" };
}

// ------------------------------------------------------------------- query

/**
 * Metric values. api/query.ts is a stub, so this returns null today and every
 * caller says plainly that the figure is not available rather than inventing
 * one. A tool that guesses a number is the exact failure this project exists
 * to surface.
 */
export type QueryRow = {
  label?: string;
  value: number;
  delta?: number;
  share?: number;
};

export async function readQuery(params: {
  metric: MetricId;
  period: string;
  dimension?: DimensionId;
  filters?: Record<string, string>;
}): Promise<{ rows: QueryRow[]; source: ReadSource } | null> {
  const live = await tryJson<MetricResult>(
    `/api/query${qs({
      metric: params.metric,
      period: params.period,
      dimension: params.dimension,
      ...params.filters,
    })}`,
  );
  if (!live || !Array.isArray(live.rows)) return null;
  return { rows: live.rows, source: "api" };
}

/** One sentence naming why a figure is missing, and what still works. */
export const NO_QUERY_ENDPOINT =
  "No figure is available: /api/query did not answer, so there is no real " +
  "number to report and none will be invented. The dashboard is showing its " +
  "seeded placeholder values. Everything below about the definition and the " +
  "data quality is real and comes from the pipeline run that produced the " +
  "current data.";

// ---------------------------------------------------------------- products

/**
 * The public catalogue, read from the same endpoint the catalogue page reads.
 *
 * This is the second half of the boundary at the top of this file. A tool must
 * not hold its own copy of the product list: it did once, 24 hardcoded rows
 * against the page's 885 families, and the agent and the page disagreed about
 * what the shop stocked. One endpoint, one answer, or the whole argument for
 * driving the UI collapses.
 *
 * The types below mirror what api/products.ts composes, and are declared here
 * rather than imported from src/api.ts so the tool layer and the dashboard's
 * fetch layer stay separable. `Product` itself comes from the frozen contract.
 */

export type Facet = { label: string; n: number };

export type PriceBand = { min: number | null; max: number | null; n: number };

/**
 * A product as the catalogue shows it: every colourway of one thing.
 *
 * Contoso ships one row per colourway, so 2,517 SKUs are 885 products. Tool
 * output has to say "products with colourways" and never "lines", because the
 * page says products and the two must agree word for word.
 */
export type ProductFamily = {
  familyKey: string;
  familyName: string;
  brand: string;
  manufacturer: string;
  categoryName: string;
  subCategoryName: string;
  priceMin: number;
  priceMax: number;
  colors: string[];
  variants: Product[];
};

export type CatalogFacets = {
  categories: Facet[];
  brands: Facet[];
  subcategories: Facet[];
  /** Folded to lower case, because the data records both "Blue" and "blue". */
  colors: Facet[];
  priceBands: PriceBand[];
};

export type ProductsResponse = {
  families: ProductFamily[];
  /** How many families match. Not how many this page returned. */
  total: number;
  offset: number;
  limit: number;
  facets: CatalogFacets;
};

export type ProductDetailResponse = {
  product: Product;
  family: ProductFamily;
  related: ProductFamily[];
};

/** Exactly the arguments src/ui/public/catalog.tsx passes. */
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

function productQs(args: ProductQueryArgs): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const body = search.toString();
  return body === "" ? "" : `?${body}`;
}

/**
 * Read the catalogue. Returns null when the endpoint did not answer, so the
 * caller can say the shop is unreachable rather than report a count of zero,
 * which would read as "we stock nothing".
 */
export async function readProducts(
  args: ProductQueryArgs,
): Promise<ProductsResponse | null> {
  const body = await tryJson<ProductsResponse>(
    `/api/products${productQs(args)}`,
  );
  return body && Array.isArray(body.families) ? body : null;
}

/** One SKU by product key, with its whole family and its neighbours. */
export async function readProduct(
  productKey: number,
): Promise<ProductDetailResponse | null> {
  const body = await tryJson<ProductDetailResponse>(
    `/api/products?productKey=${encodeURIComponent(String(productKey))}`,
  );
  return body && body.product ? body : null;
}

/** How many products match, without pulling a page of rows back. */
export async function countProducts(
  args: ProductQueryArgs,
): Promise<number | null> {
  const body = await readProducts({ ...args, offset: 0, limit: 1 });
  return body ? body.total : null;
}

/** One sentence for when the catalogue endpoint is down. */
export const NO_PRODUCTS_ENDPOINT =
  "The catalogue did not answer, so there is no count to report and none will " +
  "be invented. /api/products is what the page itself reads, so the visitor " +
  "is most likely looking at an error too. Say so rather than describing a " +
  "catalogue you cannot see.";


// ------------------------------------------------------------- promotions
//
// The record itself lives in src/promotions.ts, which both lanes read. Only the
// join belongs here, because reading the check that governs a claim is a read
// through the seam and that is what this module is.

export { findPromotion, isLive, readPromotions } from "@/promotions";

/**
 * The join this whole feature rests on: a claim's slice against the verdict the
 * pipeline recorded for it.
 *
 * A slice the pipeline never evaluated comes back `unchecked`, never `blocked`.
 * "Nobody looked" and "we looked and it failed" are different sentences that
 * call for different actions, and collapsing them would be the same lie the
 * dashboard exists to stop.
 */
export async function readClaimOutcome(
  p: Promotion,
): Promise<{ outcome: PromotionOutcome; check: Sourced<CheckRow | null> }> {
  const s = p.claim.slice;
  const check = await readCheck({
    metric: s.metric,
    period: s.period,
    ...(s.dimension ? { dimension: s.dimension, value: s.value ?? undefined } : {}),
  });
  return { outcome: check.value ? check.value.verdict : "unchecked", check };
}
