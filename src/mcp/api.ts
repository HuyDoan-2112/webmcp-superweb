// Tools reuse the UI's typed API client. UI-changing actions still go through
// the store; data reads use the same endpoints the visible page uses. Pipeline
// artifacts remain a read-only fallback when an endpoint is unavailable.

import {
  fetchLineage,
  fetchMetric,
  fetchProduct,
  fetchProducts,
  fetchRuns,
  fetchTrust,
  type ProductDetailResponse,
  type ProductQueryArgs,
  type ProductsResponse,
} from "@/api";
export type {
  CatalogFacets,
  ProductDetailResponse,
  ProductFamily,
  ProductQueryArgs,
} from "@/api";

import type {
  DimensionId,
  Lineage,
  MetricId,
  PipelineRun,
  Promotion,
  PromotionOutcome,
  TrustReport,
  TrustVerdict,
} from "@shared/types";

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
  /**
   * When that run finished, UTC. The audit question is not only whether the
   * number passed its check, it is how old the answer is: a verdict from a run
   * three weeks ago is a verdict about three-week-old data.
   */
  dataAsOf?: string;
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
 * Read, or null when the endpoint could not answer.
 *
 * Null means unavailable, and only unavailable. A 4xx means the request was
 * wrong and a 5xx means the server broke, and neither is a reason to fall back
 * to a committed artifact: doing so answered a malformed question with stale
 * data and called it success. Those rethrow so the caller reports the fault
 * instead of hiding it behind a fallback.
 */
async function optional<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    // ofetch attaches the response status. A 4xx means the request was wrong
    // and a 5xx means the server broke; both are faults to report, not reasons
    // to answer from a committed artifact. Only a request that never got a
    // response, which is what unavailable actually means, falls back.
    const status = statusOf(error);
    if (status !== null && status >= 400) throw error;
    return null;
  }
}

function statusOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const e = error as { statusCode?: unknown; response?: { status?: unknown } };
  if (typeof e.statusCode === "number") return e.statusCode;
  if (typeof e.response?.status === "number") return e.response.status;
  return null;
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
    dataAsOf: report.freshnessUtc,
    plainLanguage:
      report.plainLanguage ??
      (report.verdict === "ok"
        ? "Every row that should be behind this figure was counted."
        : // An unchecked slice must not borrow the language of a failed one.
          // "Some of the rows were never counted" is a claim about rows, and
          // for a slice nobody evaluated there is no such claim to make.
          report.verdict === "unchecked"
          ? "No data quality check covers this slice, so there is no evidence either way."
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
  const live = await optional(() =>
    fetchTrust({
      metric: slice.metric,
      period: slice.period,
      filters:
        slice.dimension && slice.value
          ? { [slice.dimension]: slice.value }
          : undefined,
    }),
  );
  if (live && typeof live.verdict === "string") {
    return { value: fromTrustReport(live, slice), source: "api" };
  }

  // Match the metric too. Without it a gross_profit question fell through to
  // net_revenue's check and came back as a verdict about gross_profit, which
  // is the same silent substitution the server was doing with slices.
  const wanted = ARTIFACT_QUALITY.checks.filter(
    (c) => c.period === slice.period && c.metric === slice.metric,
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
  const live = await optional(() => fetchLineage(metric));
  if (live) return { value: live, source: "api" };
  return { value: ARTIFACT_LINEAGE, source: "pipeline artifact" };
}

// -------------------------------------------------------------------- runs

export async function readRuns(): Promise<Sourced<PipelineRun[]>> {
  const live = await optional(fetchRuns);
  if (live) return { value: live.runs, source: "api" };
  return { value: ARTIFACT_RUNS, source: "pipeline artifact" };
}

// ------------------------------------------------------------------- query

/**
 * Metric values, read back from the same endpoint the dashboard reads.
 *
 * Null when /api/query does not answer, and every caller then says plainly that
 * the figure is not available rather than inventing one. A tool that guesses a
 * number is the exact failure this project exists to surface.
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
  const live = await optional(() =>
    fetchMetric({
      metric: params.metric,
      period: params.period,
      dimension: params.dimension,
      filters: params.filters,
    }),
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

export async function readProducts(
  args: ProductQueryArgs,
): Promise<ProductsResponse | null> {
  const body = await optional(() => fetchProducts(args));
  return body && Array.isArray(body.families) ? body : null;
}

export async function readProduct(
  productKey: number,
): Promise<ProductDetailResponse | null> {
  const body = await optional(() => fetchProduct(productKey));
  return body && body.product ? body : null;
}

export async function countProducts(
  args: ProductQueryArgs,
): Promise<number | null> {
  const body = await readProducts({ ...args, offset: 0, limit: 1 });
  return body ? body.total : null;
}

export const NO_PRODUCTS_ENDPOINT =
  "The catalogue did not answer, so there is no count to report and none will " +
  "be invented. /api/products is what the page itself reads, so the visitor " +
  "is most likely looking at an error too. Say so rather than describing a " +
  "catalogue you cannot see.";
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
