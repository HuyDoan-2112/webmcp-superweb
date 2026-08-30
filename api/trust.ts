// GET /api/trust - can this number be published?
//
// The answer is scoped to metric plus period plus filter, and its depth depends
// on who is asking. Nobody is refused. Someone in Operations gets the sentence
// they can act on; someone in Data gets the check name and the row counts.

import { getMetric } from "../shared/metrics.js";
import type { TrustReport } from "../shared/types.js";
import { isMetricId, parseFilters } from "./_lib/compose.js";
import { fail, json, params } from "./_lib/http.js";
import { getSession, wantsTechnicalDetail } from "./_lib/session.js";
import { checksFor, verdictFor } from "./_lib/trust.js";
import { latestRun } from "./_lib/runs.js";

export async function GET(request: Request): Promise<Response> {
  const p = params(request);
  const metricId = p.get("metric") ?? "";
  const period = p.get("period") ?? "";

  if (!isMetricId(metricId)) return fail(`Unknown metric "${metricId}"`, 400);

  const filters = parseFilters(Object.fromEntries(p.entries()));
  const session = getSession(request);
  const technical = wantsTechnicalDetail(session.audience);

  const checks = await checksFor(metricId, period, filters);
  const verdict = await verdictFor(metricId, period, filters);
  const run = await latestRun();

  const worst = checks.find((c) => c.verdict === verdict);

  const report: TrustReport = {
    metric: metricId,
    period,
    filters,
    verdict,
    // The check name is jargon on purpose and is never shown to someone who
    // did not ask for it. fx_rate_not_null means nothing to Operations.
    checks: checks.map((c) => ({
      name: technical ? c.name : "completeness",
      passed: c.passed,
      detail: technical ? c.detail : c.plainLanguage,
      rejectedRows: technical ? c.rejectedRows : undefined,
      expectedRows: technical ? c.expectedRows : undefined,
    })),
    runId: run?.id ?? "unknown",
    freshnessUtc: run?.finishedUtc ?? run?.startedUtc ?? "unknown",
    plainLanguage: verdict === "ok" ? undefined : worst?.plainLanguage,
  };

  return json({
    ...report,
    metricLabel: getMetric(metricId).label,
  });
}
