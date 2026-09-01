// Reading the checks the ETL wrote, and turning them into a verdict.
//
// Nothing is computed here. The pipeline already evaluated every check while it
// had the rejected rows in front of it, and data/meta/quality_checks.json is
// that record. Recomputing a verdict from the gold table would be inventing it,
// because the rows that would prove it are the ones that are missing.

import { readFile } from "node:fs/promises";
import type { Check, Filters, MetricId, TrustVerdict } from "../../shared/types.js";
import { dataPath } from "./duckdb.js";

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
    cached = readFile(dataPath("meta", "quality_checks.json"), "utf8")
      .then((text) => JSON.parse(text) as CheckFile)
      // Matches loadRuns. A missing or corrupt artifact must not throw out of
      // GET as a raw 500 when every other failure here answers as ApiError.
      // No checks means no verdict, which the trust endpoint already handles.
      .catch(() => ({ runId: "", period: "", checks: [] }) as CheckFile);
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

  // Exact or nothing. The old code fell back to the unscoped whole-period
  // check when no scoped one matched, so asking about Spain, which has no
  // stores and no check, was answered with November's month-wide verdict
  // wearing Spain's name. Widening a slice the caller named is the same
  // failure as inventing a figure for it.
  return scoped;
}

const RANK: Record<TrustVerdict, number> = {
  ok: 0,
  degraded: 1,
  blocked: 2,
  unchecked: 3,
};

/**
 * The worst verdict across the checks that cover this exact slice.
 *
 * No checks means "unchecked", never "ok". The reduce used to seed with "ok",
 * so an empty set, which is what every metric other than net_revenue produces,
 * came back as a pass. That told an agent gross_profit for Germany was
 * publishable when nothing had ever looked at it.
 */
export async function verdictFor(
  metric: MetricId,
  period: string,
  filters: Filters,
): Promise<TrustVerdict> {
  const checks = await checksFor(metric, period, filters);
  if (checks.length === 0) return "unchecked";
  return checks.reduce<TrustVerdict>(
    (worst, c) => (RANK[c.verdict] > RANK[worst] ? c.verdict : worst),
    "ok",
  );
}
