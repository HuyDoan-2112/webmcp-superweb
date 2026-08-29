// GET /api/runs - which pipeline execution produced the current data.
//
// A failed run is still a run this has to be able to report on.

import { json } from "./_lib/http";
import { loadRuns } from "./_lib/runs";
import { getSession, wantsTechnicalDetail } from "./_lib/session";

export default async function handler(request: Request): Promise<Response> {
  const runs = await loadRuns();
  const technical = wantsTechnicalDetail(getSession(request).audience);

  return json({
    runs: runs.map((r) => ({
      id: r.id,
      startedUtc: r.startedUtc,
      finishedUtc: r.finishedUtc,
      status: r.status,
      checkNames: technical ? r.checkNames : undefined,
      rowCounts: technical ? r.rowCounts : undefined,
    })),
  });
}
