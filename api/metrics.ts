// GET /api/metrics - the registry itself.
//
// main.tsx fetches this before registering tools, so tool schemas carry real
// metric ids as enums rather than free text an agent can typo.

import { DIMENSIONS, METRICS, DEMO_PERIOD } from "../shared/metrics.js";
import { json } from "./_lib/http.js";
import { getSession, wantsTechnicalDetail } from "./_lib/session.js";

export async function GET(request: Request): Promise<Response> {
  const session = getSession(request);
  const technical = wantsTechnicalDetail(session.audience);

  // Everyone gets the same metrics. Only the depth changes: the SQL expression
  // and the lineage internals are noise to someone in Operations.
  const metrics = METRICS.map((m) => ({
    id: m.id,
    label: m.label,
    description: m.description,
    unit: m.unit,
    dimensions: m.dimensions,
    grain: technical ? m.grain : undefined,
    sql: technical ? m.sql : undefined,
    exclusions: m.exclusions,
    definitionVersion: m.definitionVersion,
    lineage: technical ? m.lineage : undefined,
  }));

  return json({
    metrics,
    dimensions: DIMENSIONS,
    demoPeriod: DEMO_PERIOD,
    session,
  });
}
