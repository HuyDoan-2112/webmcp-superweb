// shared/types.ts - the contract.
//
// Imported by the server (api/, to build SQL) and the client (src/, to shape
// WebMCP tool inputSchema enums). Defined once so the two cannot drift.
//
// Changing this file means saying so out loud first. See CLAUDE.md.

// ---------------------------------------------------------------- identity

/**
 * The depth of answer a person should receive. Carried by the demo session.
 * It changes how much detail an answer contains, never whether they may ask.
 *
 * `public` is the anonymous visitor. They are not signed in, so the server has
 * no one to tailor to and answers at catalogue depth.
 */
export type Audience = "public" | "ops" | "analyst" | "engineer";

/** Which shell the browser is showing. Decides which tools are registered. */
export type Surface = "public" | "internal";

export type User = {
  id: string;
  name: string;
  /** Job title as a person would say it, shown in the UI. */
  role: string;
  audience: Audience;
};

/**
 * What the server knows about who is asking. The anonymous visitor gets
 * `user: null` and `audience: "public"`, never an error.
 */
export type Session = {
  user: User | null;
  audience: Audience;
};

// ----------------------------------------------------------------- metrics

export type MetricId =
  | "net_revenue"
  | "gross_profit"
  | "gross_margin"
  | "units_sold"
  | "order_lines"
  | "order_count";

export type DimensionId =
  | "date"
  | "country"
  | "channel"
  | "category"
  | "subcategory"
  | "brand"
  | "store"
  | "currency";

export type MetricUnit = "currency" | "count" | "ratio";

/**
 * The row level a metric aggregates over. Two metrics at different grains
 * cannot be compared without saying so, which is why `describe_metric` reports
 * it and why `order_count` is not defined on the sales fact.
 */
export type Grain = "gold.fact_sales_daily" | "gold.fact_orders_daily";

export type Metric = {
  id: MetricId;
  label: string;
  /** Plain language. Read aloud by describe_metric to a non-technical person. */
  description: string;
  unit: MetricUnit;
  /** Aggregate expression over `grain`. The server composes SQL from this. */
  sql: string;
  grain: Grain;
  /** Only these dimensions are answerable for this metric. */
  dimensions: DimensionId[];
  /** Rows the pipeline removes before this metric is computed. */
  exclusions: string[];
  /** Bumped when the definition changes, so a stale figure is detectable. */
  definitionVersion: string;
  lineage: MetricLineage;
};

export type MetricLineage = {
  upstream: string[];
  transforms: string[];
  owner: string;
  freshness: string;
};

export type Dimension = {
  id: DimensionId;
  label: string;
  description: string;
  /** Column on the gold fact, or the dimension table it joins to. */
  column: string;
};

// -------------------------------------------------------------- questions

/** A span of time. A metric without a period is not an answer. */
export type Period = string;

export type Filters = Partial<Record<DimensionId, string>>;

export type MetricQuery = {
  metric: MetricId;
  period: Period;
  dimension?: DimensionId;
  filters?: Filters;
  limit?: number;
};

export type Row = {
  /** Absent when the query was not broken down by a dimension. */
  label?: string;
  value: number;
  /** Change against the preceding period of equal length, as a fraction. */
  delta?: number;
  share?: number;
};

export type MetricResult = {
  metric: MetricId;
  period: Period;
  dimension?: DimensionId;
  filters: Filters;
  unit: MetricUnit;
  rows: Row[];
  /** Verdict for exactly this slice. Never for the metric in the abstract. */
  verdict: TrustVerdict;
};

// ------------------------------------------------------------------ trust

/**
 * Whether a number has earned publication.
 *
 * Ranges over metric + period + filter, never metric + period alone. The FX gap
 * hits Europe while North America is sound, so a verdict that could not see the
 * filter would block four good sections to protect one.
 *
 * See docs/adr/0002-trust-verdict-has-three-values.md.
 */
export type TrustVerdict = "ok" | "degraded" | "blocked";

/**
 * A named assertion about data quality, evaluated during a run. Its name is
 * jargon by design and is never shown to a non-technical user.
 */
export type Check = {
  name: string;
  passed: boolean;
  /** Technical detail. Suppressed for the `public` and `ops` audiences. */
  detail: string;
  /** Rows that should have been behind the number and were not. */
  rejectedRows?: number;
  /** Rows that were. */
  expectedRows?: number;
};

export type TrustReport = {
  metric: MetricId;
  period: Period;
  filters: Filters;
  verdict: TrustVerdict;
  checks: Check[];
  /** The run that produced the data behind this slice. */
  runId: string;
  freshnessUtc: string;
  /**
   * One sentence, no jargon, safe to show anyone. Present whenever the verdict
   * is not `ok`. This is what explain_data_issue returns.
   */
  plainLanguage?: string;
};

// --------------------------------------------------------------- lineage

/**
 * One rung of the chain from a dashboard metric back to the system the data
 * came from. The label is what makes the chain legible to someone who does not
 * know the table names.
 */
export type LineageStage =
  | "dashboard metric"
  | "curated table"
  | "transformation"
  | "warehouse"
  | "operational system";

export type LineageNode = {
  node: string;
  stage: LineageStage;
  rowsIn?: number;
  rowsOut?: number;
  /** True on the rung where a check failed. At most one per chain. */
  failed?: boolean;
  /** Plain language for this rung. Shown instead of the node name to `ops`. */
  summary?: string;
};

/** Ordered from the dashboard metric upstream to the operational system. */
export type Lineage = {
  metric: MetricId;
  nodes: LineageNode[];
};

// -------------------------------------------------------------------- runs

export type RunStatus = "success" | "failed" | "running";

/**
 * One execution of the pipeline. A failed run is still a run the API has to be
 * able to report on.
 */
export type PipelineRun = {
  id: string;
  startedUtc: string;
  finishedUtc: string | null;
  status: RunStatus;
  rowCounts: Record<string, number>;
  checkNames: string[];
};

// ---------------------------------------------------- the public surface

/**
 * A catalogue item as an anonymous visitor sees it. Field names mirror the
 * Contoso `product` table so the mapping stays mechanical.
 */
export type Product = {
  productKey: number;
  productCode: string;
  productName: string;
  brand: string;
  manufacturer: string;
  color: string;
  weight: number;
  weightUnit: string;
  /** List price in USD. Cost is never exposed on the public surface. */
  price: number;
  categoryName: string;
  subCategoryName: string;
};

export type ProductQuery = {
  search?: string;
  category?: string;
  brand?: string;
  limit?: number;
};

// ------------------------------------------------------------- transport

export type ApiError = { error: string; detail?: string };

export type ApiResult<T> = T | ApiError;

// ------------------------------------------------------------- promotions

/**
 * The checkable assertion inside a promotion's copy, bound to the one slice
 * that would prove or disprove it.
 *
 * The slice mirrors what the pipeline records a verdict against. A looser
 * binding would make the tool infer which number the copy is about, and an
 * inferred binding produces a verdict about a slice nobody chose, which is the
 * failure this project exists to surface.
 */
export type PromotionClaim = {
  assertion: string;
  slice: {
    metric: MetricId;
    period: Period;
    dimension: DimensionId | null;
    value: string | null;
  };
};

/**
 * One synthetic marketing offer, carrying exactly one claim.
 *
 * The promotion is invented; the verdict under it is read from the pipeline.
 * If a promotion needs two claims it is two promotions, because composing a
 * blocked claim with two sound ones has no honest single answer.
 *
 * No locale field: promotion copy is not translated yet, and inventing the
 * field would guess at a decision nobody has made. No structured discount
 * either, because the discount is not the checkable part and a field for it
 * implies the tool verifies it.
 */
export type Promotion = {
  code: string;
  headline: string;
  body: string;
  /** Inclusive YYYY-MM-DD bounds of the window the promotion runs in. */
  validFrom: string;
  validTo: string;
  claim: PromotionClaim;
};

/**
 * What a claim's slice came back as.
 *
 * `unchecked` is deliberately NOT a fourth TrustVerdict. Nobody looked is not
 * the same answer as looked and failed, and it calls for a different action, so
 * it sits above the verdict rather than inside it. The three verdicts stay
 * three and nothing in api/ has to change.
 */
export type PromotionOutcome = TrustVerdict | "unchecked";
