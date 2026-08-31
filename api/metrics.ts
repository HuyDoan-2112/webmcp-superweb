// GET /api/metrics - the registry itself.
//
// main.tsx fetches this before registering tools, so tool schemas carry real
// metric ids as enums rather than free text an agent can typo.

import { DIMENSIONS, METRICS, DEMO_PERIOD } from "../shared/metrics.js";
import { privateJson } from "./_lib/http.js";
import { getSession, wantsTechnicalDetail } from "./_lib/session.js";

export async function GET(request: Request): Promise<Response> {
  const session = getSession(request);
  const technical = wantsTechnicalDetail(session.audience);

  // Everyone gets the same metrics. Only the depth changes: the SQL expression
  // and the lineage internals are noise to someone in Operations.
  //
  // Redacted fields stay present and empty rather than becoming undefined.
  // shared/types.ts declares them required, and JSON.stringify drops undefined
  // keys, so an undefined here would put a shape on the wire that the client's
  // own Metric type says cannot happen.
  const metrics = METRICS.map((m) => ({
    id: m.id,
    label: m.label,
    description: m.description,
    unit: m.unit,
    dimensions: m.dimensions,
    grain: m.grain,
    sql: technical ? m.sql : "",
    exclusions: m.exclusions,
    definitionVersion: m.definitionVersion,
    lineage: technical
      ? m.lineage
      : { upstream: [], transforms: [], owner: m.lineage.owner, freshness: m.lineage.freshness },
  }));

  return privateJson({
    metrics,
    dimensions: DIMENSIONS,
    demoPeriod: DEMO_PERIOD,
    session,
  });
}
