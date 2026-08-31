// GET /api/lineage - where a number came from.
//
// This endpoint never refuses anyone, which matters: refusing the person least
// equipped to catch a bad number would contradict the entire point. It answers
// at the depth that fits who is asking. Operations gets the chain in plain
// language. Data gets the table names and the row counts.

import { readFile } from "node:fs/promises";
import type { Lineage } from "../shared/types.js";
import { dataPath } from "./_lib/duckdb.js";
import { fail, params, privateJson } from "./_lib/http.js";
import { getSession, wantsTechnicalDetail } from "./_lib/session.js";

let cached: Promise<Lineage | null> | null = null;

async function loadLineage(): Promise<Lineage | null> {
  if (!cached) {
    cached = readFile(dataPath("meta", "lineage.json"), "utf8")
      .then((text) => JSON.parse(text) as Lineage)
      // A missing or corrupt artifact is an outage, not an empty chain. Fall
      // back to null so the endpoint can say which one it is.
      .catch(() => null);
  }
  return cached;
}

export async function GET(request: Request): Promise<Response> {
  const lineage = await loadLineage();
  if (!lineage) return fail("Lineage is unavailable", 503);

  // The pipeline records one chain today. Answering a request for any other
  // metric with this one, labelled as this one, would be the exact failure the
  // app exists to catch: a number reported as traced when it was not.
  const asked = params(request).get("metric");
  if (asked !== null && asked !== lineage.metric) {
    return fail(
      `No lineage recorded for "${asked}"`,
      404,
      `The pipeline records lineage for ${lineage.metric} only. Nothing is ` +
        `traced for ${asked}, so no chain can be shown for it.`,
    );
  }

  const technical = wantsTechnicalDetail(getSession(request).audience);

  const nodes = lineage.nodes.map((n) => ({
    // Someone in Operations should not have to know what silver means to find
    // out that the conversion step lost rows.
    node: technical ? n.node : (n.summary ?? n.node),
    stage: n.stage,
    failed: n.failed,
    summary: n.summary,
    rowsIn: technical ? n.rowsIn : undefined,
    rowsOut: technical ? n.rowsOut : undefined,
    // Only the rung that failed reports a rejection. Elsewhere a difference
    // between rowsIn and rowsOut is grouping, not loss, and labelling it
    // "rejected" would invent a second failure beside the real one.
    rejected:
      technical && n.failed && n.rowsIn !== undefined && n.rowsOut !== undefined
        ? n.rowsIn - n.rowsOut
        : undefined,
  }));

  return privateJson({ metric: lineage.metric, nodes });
}
