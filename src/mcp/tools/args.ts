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
export function asPeriod(value: unknown): string {
  const v = String(value ?? "").trim();
  return /^\d{4}-\d{2}$/.test(v) ? v : DEMO_PERIOD;
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
