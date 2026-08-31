// GET /api/runs - which pipeline execution produced the current data.
//
// A failed run is still a run this has to be able to report on.

import { privateJson } from "./_lib/http.js";
import { loadRuns } from "./_lib/runs.js";
import { getSession, wantsTechnicalDetail } from "./_lib/session.js";

export async function GET(request: Request): Promise<Response> {
  const runs = await loadRuns();
  const technical = wantsTechnicalDetail(getSession(request).audience);

  // Redacted fields stay present and empty. shared/types.ts declares both as
  // required, and an undefined would be dropped by JSON.stringify, putting a
  // shape on the wire the client's PipelineRun type says cannot happen.
  return privateJson({
    runs: runs.map((r) => ({
      id: r.id,
      startedUtc: r.startedUtc,
      finishedUtc: r.finishedUtc,
      status: r.status,
      checkNames: technical ? r.checkNames : [],
      rowCounts: technical ? r.rowCounts : {},
    })),
  });
}
