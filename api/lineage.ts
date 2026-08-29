// GET /api/lineage - where a number came from.
//
// This endpoint never refuses anyone, which matters: refusing the person least
// equipped to catch a bad number would contradict the entire point. It answers
// at the depth that fits who is asking. Operations gets the chain in plain
// language. Data gets the table names and the row counts.

import { readFile } from "node:fs/promises";
import type { Lineage } from "../shared/types";
import { dataPath } from "./_lib/duckdb";
import { json } from "./_lib/http";
import { getSession, wantsTechnicalDetail } from "./_lib/session";

let cached: Promise<Lineage> | null = null;

async function loadLineage(): Promise<Lineage> {
  if (!cached) {
    cached = readFile(dataPath("meta", "lineage.json"), "utf8").then(
      (text) => JSON.parse(text) as Lineage,
    );
  }
  return cached;
}

export default async function handler(request: Request): Promise<Response> {
  const lineage = await loadLineage();
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

  return json({ metric: lineage.metric, nodes });
}
