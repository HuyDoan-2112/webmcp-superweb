// Argument coercion shared by the internal tools.
//
// Every tool schema carries real enums built from shared/metrics.ts, so a
// well behaved agent cannot send a metric that does not exist. These narrow
// what arrives anyway, because the schema is a contract with the browser and
// not a guarantee about what reaches `execute`.

import { DEMO_PERIOD, DIMENSION_IDS, METRIC_IDS } from "@shared/metrics";
import type { DimensionId, MetricId } from "@shared/types";

export function asMetricId(value: unknown): MetricId | null {
  const v = String(value ?? "");
  return (METRIC_IDS as string[]).includes(v) ? (v as MetricId) : null;
}

export function asDimensionId(value: unknown): DimensionId | null {
  const v = String(value ?? "");
  return (DIMENSION_IDS as string[]).includes(v) ? (v as DimensionId) : null;
}

/** Period argument, defaulted to the one the pipeline has actually evaluated. */
/**
 * A period, or null when the caller supplied one that is not a period.
 *
 * Defaulting is only correct when the argument is ABSENT. This used to rewrite
 * anything malformed to the demo month, so "2023-1" and "2023-13" both came
 * back as 2023-11 and the agent received credible figures for a month it had
 * not asked about. A typo is not a request for November.
 */
export function asPeriod(value: unknown): string | null {
  if (value === undefined || value === null || String(value).trim() === "")
    return DEMO_PERIOD;
  const v = String(value).trim();
  const match = /^(\d{4})-(\d{2})$/.exec(v);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? v : null;
}

export function asText(value: unknown): string | undefined {
  const v = String(value ?? "").trim();
  return v === "" ? undefined : v;
}

/** Reused across the tool schemas below. Built from the registry, never hand written. */
export const METRIC_ENUM = {
  type: "string",
  enum: [...METRIC_IDS],
} as const;

export const DIMENSION_ENUM = {
  type: "string",
  enum: [...DIMENSION_IDS],
} as const;

/**
 * The axes a trust or report tool may be asked about.
 *
 * Narrower than DIMENSION_IDS on purpose. The dashboard store holds country,
 * category and channel and nothing else, so a verdict about brand or currency
 * could be returned while the page stayed where it was. The whole argument of
 * this build is that the human and the agent are looking at one thing, and a
 * tool that can answer about a slice the page cannot show breaks it quietly.
 */
export const STORE_DIMENSIONS = ["country", "category", "channel"] as const;

export const STORE_DIMENSION_ENUM = {
  type: "string",
  enum: [...STORE_DIMENSIONS],
} as const;

export function asStoreDimension(value: unknown): DimensionId | null {
  const v = String(value ?? "");
  return (STORE_DIMENSIONS as readonly string[]).includes(v)
    ? (v as DimensionId)
    : null;
}
