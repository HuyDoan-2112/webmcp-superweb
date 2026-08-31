// A hand-rolled outputSchema.
//
// WebMCP validates what goes INTO a tool. `inputSchema` is enforced by the
// browser, so a metric the registry does not know never reaches `execute`.
// Nothing describes what comes OUT. A tool's return is a string, and an agent
// reading "TRUST: BLOCKED for net_revenue" is doing natural language parsing on
// a decision that should have been a field.
//
// So every tool that returns a decision appends one fenced JSON block after its
// prose. The prose is for the reader; the block is for the agent to branch on.
// Both say the same thing, and the block is generated from the same values the
// prose is, so they cannot disagree.
//
// ABSENCE IS THE POINT. A blocked slice carries no `value` key at all, rather
// than a null or a zero. This is the argument we would make to
// https://github.com/webmachinelearning/webmcp/issues/9 if outputSchema is
// specified: "no figure exists" and "the figure is zero" must not serialise the
// same way, because on this data Germany is genuinely both incomplete and
// rendered by the dashboard as $0. A validator that required every declared
// field to be present would force us to lie.
//
// Row counts follow the same rule. /api/trust withholds them from an audience
// that did not ask, and a withheld count is omitted rather than sent as 0.

import { text, type ToolResponse } from "./adapter";

/** Drop keys whose value is undefined, so absence survives serialisation. */
function present(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
}

/**
 * Prose, then the same answer as data.
 *
 * The block goes last because an agent that reads only the head of a long
 * result should get the sentence, and one that parses gets the fields.
 */
export function textWithData(
  prose: string,
  data: Record<string, unknown>,
): ToolResponse {
  return text(
    `${prose}\n\n` +
      "```json\n" +
      `${JSON.stringify(present(data), null, 2)}\n` +
      "```",
  );
}

/**
 * Two timestamps, and they answer different questions.
 *
 * `dataAsOf` is when the pipeline run that produced these numbers finished.
 * That is the one an audit cares about: a passing verdict over three-week-old
 * data is still a verdict about three-week-old data.
 *
 * `answeredAt` is when this tool ran. It is what lets someone reconstruct the
 * order of events later, when the only record left is a report and a chat log.
 *
 * Neither is a signature and we do not offer one. A signature this page
 * computed would prove nothing, because the spec already treats everything a
 * page returns as untrusted content, and the agent holds no key of ours to
 * check it against. What a person can actually verify is `runId` against
 * /api/runs, which is a real audit trail rather than a cryptographic gesture.
 */
export function stamp(dataAsOf?: string): {
  dataAsOf?: string;
  answeredAt: string;
} {
  return { dataAsOf, answeredAt: new Date().toISOString() };
}

/** Row counts, or nothing when the session's answer depth withholds them. */
export function rowFields(
  expectedRows: number,
  rejectedRows: number,
): { expectedRows?: number; rejectedRows?: number } {
  if (expectedRows <= 0) return {};
  return { expectedRows, rejectedRows };
}
