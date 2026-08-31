// GET /api/metrics - the registry itself, at the depth the session earns.
//
// Nothing in this repo calls this endpoint today. Tool schemas get their
// metric ids from a static import of shared/metrics.ts (src/mcp/register.ts),
// which resolves before any fetch could, so registration never waits on this.
// This is the same registry shaped for a caller over HTTP, at the audience
// depth every other endpoint answers at.

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
