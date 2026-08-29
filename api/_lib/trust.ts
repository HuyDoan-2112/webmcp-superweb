// Reading the checks the ETL wrote, and turning them into a verdict.
//
// Nothing is computed here. The pipeline already evaluated every check while it
// had the rejected rows in front of it, and data/meta/quality_checks.json is
// that record. Recomputing a verdict from the gold table would be inventing it,
// because the rows that would prove it are the ones that are missing.

import { readFile } from "node:fs/promises";
import type { Check, Filters, MetricId, TrustVerdict } from "../../shared/types";
import { dataPath } from "./duckdb";

type StoredCheck = Check & {
  metric: MetricId;
  period: string;
  dimension: string | null;
  value: string | null;
  verdict: TrustVerdict;
  plainLanguage: string;
};

type CheckFile = { runId: string; period: string; checks: StoredCheck[] };

let cached: Promise<CheckFile> | null = null;

export async function loadChecks(): Promise<CheckFile> {
  if (!cached) {
    cached = readFile(dataPath("meta", "quality_checks.json"), "utf8").then(
      (text) => JSON.parse(text) as CheckFile,
    );
  }
  return cached;
}

/**
 * The checks that apply to exactly this slice.
 *
 * A verdict ranges over metric plus period plus filter, never metric plus
 * period alone. The FX gap hits the European stores while North America is
 * sound, so a verdict that could not see the filter would block four good
 * sections to protect one.
 */
export async function checksFor(
  metric: MetricId,
  period: string,
  filters: Filters,
): Promise<StoredCheck[]> {
  const file = await loadChecks();
  const applicable = file.checks.filter(
    (c) => c.period === period && c.metric === metric,
  );

  // Narrow to the checks whose scope the caller actually asked about. With no
  // filter, that is the unscoped check for the whole period.
  const scoped = applicable.filter((c) => {
    if (c.dimension === null) return Object.keys(filters).length === 0;
    const asked = filters[c.dimension as keyof Filters];
    return asked !== undefined && asked === c.value;
  });

  return scoped.length > 0 ? scoped : applicable.filter((c) => c.dimension === null);
}

const RANK: Record<TrustVerdict, number> = { ok: 0, degraded: 1, blocked: 2 };

export async function verdictFor(
  metric: MetricId,
  period: string,
  filters: Filters,
): Promise<TrustVerdict> {
  const checks = await checksFor(metric, period, filters);
  return checks.reduce<TrustVerdict>(
    (worst, c) => (RANK[c.verdict] > RANK[worst] ? c.verdict : worst),
    "ok",
  );
}
