// check_data_trust, explain_data_issue, trace_lineage.
//
// check_data_trust is the one that matters. Everything else on the page is a
// dashboard; this is the tool that decides whether a number has earned the
// right to be written down.
//
// It takes a filter. The verdict ranges over metric plus period plus filter,
// never metric plus period alone, and this is not a theoretical nicety: for
// 2023-11 the pipeline recorded Germany, France, Italy and the Netherlands as
// 100 per cent rejected and blocked, Online as 25.4 per cent rejected and
// degraded, and the United States, Canada, the United Kingdom and Australia as
// entirely clean. A verdict that could not see the filter would block four
// sound sections to protect one broken one, and the demo would be a tool that
// refuses everything.
//
// explain_data_issue and trace_lineage register only after a check has come
// back not-ok. They are the answer to a question that has not been asked yet
// until then, and Chrome's own guidance is that every registered tool costs
// context and that overlapping tools make selection worse.

import { getMetric } from "@shared/metrics";
import type { LineageNode, MetricId, TrustVerdict } from "@shared/types";
import { setFilters, setMetric, setPeriod, setState, setView } from "@/store";
import {
  checkedPeriod,
  checkedRunId,
  readCheck,
  readChecks,
  readLineage,
  readRuns,
  type CheckRow,
  type Sourced,
} from "../api";
import { text, type ToolSpec } from "../adapter";
import { asDimensionId, asMetricId, asPeriod, asText, DIMENSION_ENUM, METRIC_ENUM } from "./args";

/**
 * The check the pipeline recorded is `fx_rate_not_null` against `net_revenue`.
 * Every metric on gold.fact_sales_daily carries the same FX exclusion, so the
 * same rejected rows are missing from all of them. Say that out loud rather
 * than silently reporting a net_revenue verdict under another metric's name.
 */
function coverageNote(asked: MetricId, recorded: MetricId): string {
  if (asked === recorded) return "";
  const a = getMetric(asked);
  const r = getMetric(recorded);
  if (a.grain !== r.grain) {
    return (
      ` Read this carefully: the check was evaluated against ${recorded}, which ` +
      `is counted on ${r.grain}, and you asked about ${asked}, counted on ` +
      `${a.grain}. Different grain, different row population. Treat this as ` +
      `indicative and not as a verdict on ${asked}.`
    );
  }
  return (
    ` The check was evaluated against ${recorded}. ${asked} is counted on the ` +
    `same table and removes the same rows for the same reason, so the same ` +
    `lines are missing from it.`
  );
}

/**
 * The row counts, or an honest account of why there are none.
 *
 * /api/trust withholds row counts and the real check name from an audience
 * that did not ask for them: Operations gets "completeness" and a sentence,
 * Data Platform gets `fx_rate_not_null` and the counts. That is the server's
 * decision about depth, not a gap in the answer, so this reports which of the
 * two happened rather than printing "0 of 0".
 */
function rowsClause(row: CheckRow): string {
  if (row.expectedRows > 0) {
    const pct = ((row.rejectedRows / row.expectedRows) * 100).toFixed(1);
    return row.rejectedRows === 0
      ? `All ${row.expectedRows.toLocaleString("en-US")} order lines behind it were counted.`
      : `${row.rejectedRows.toLocaleString("en-US")} of ` +
          `${row.expectedRows.toLocaleString("en-US")} order lines (${pct} per cent) ` +
          `were never counted, because the exchange rate needed to convert them ` +
          `was missing.`;
  }
  return row.verdict === "ok"
    ? `No rows are missing from it.`
    : `Row counts are withheld at this session's answer depth, so the sentence ` +
        `below is the whole answer here.`;
}

/** One line an agent can paste into its own reasoning without decoding it. */
export function verdictLine(
  check: Sourced<CheckRow | null>,
  metric: MetricId,
  period: string,
  dimension: string | undefined,
  value: string | undefined,
): string {
  const slice =
    dimension && value ? `${metric} for ${period} where ${dimension} = ${value}` : `${metric} for ${period}`;

  if (!check.value) {
    return (
      `TRUST: no check recorded for ${slice}. The pipeline evaluated ` +
      `${checkedPeriod()} only, so a different period has no verdict rather ` +
      `than a passing one. Do not read silence as approval.`
    );
  }

  const row = check.value;
  const verdict = row.verdict.toUpperCase();
  return (
    `TRUST: ${verdict} for ${slice}. ${rowsClause(row)} ` +
    `Check "${row.name}", run ${row.runId ?? checkedRunId()}, ` +
    `read from the ${check.source}.` +
    coverageNote(metric, row.metric)
  );
}

function advice(verdict: TrustVerdict): string {
  if (verdict === "blocked")
    return (
      `Do not publish this figure. It is not low, it is incomplete, and it ` +
      `reads as entirely ordinary. Call explain_data_issue to get one sentence ` +
      `you can say to a non-technical person, and trace_lineage to show where ` +
      `it broke. The page now carries a failed check, so those two are ` +
      `relevant here; re-read the available tools before calling them.`
    );
  if (verdict === "degraded")
    return (
      `This figure can stand, but it must carry the gap alongside it. It is ` +
      `the more dangerous of the two bad states, because a blocked section ` +
      `cannot be pasted into a deck and this one can. Call explain_data_issue ` +
      `for the sentence to attach to it.`
    );
  return (
    `This slice is clean and can be published as it stands. Every row that ` +
    `should be behind it is behind it.`
  );
}

function checkDataTrust(): ToolSpec {
  return {
    name: "check_data_trust",
    title: "Check whether a number can be published",
    description:
      "Ask whether one metric, for one period, under one filter, has earned " +
      "the right to be written down. Returns ok, degraded or blocked, with " +
      "the rows that are missing and the run that produced the data. Always " +
      "pass the filter you actually intend to publish: the verdict ranges " +
      "over metric plus period plus filter, and on this data some countries " +
      "are entirely sound while others have no rows behind them at all. " +
      "Checking the whole period instead would either block everything or " +
      "approve something broken.",
    inputSchema: {
      type: "object",
      properties: {
        metric: { ...METRIC_ENUM, description: "Which metric." },
        period: {
          type: "string",
          description: `Month as YYYY-MM. Defaults to ${checkedPeriod()}.`,
        },
        dimension: {
          ...DIMENSION_ENUM,
          description:
            "The axis the filter is on, such as country or channel. Omit for " +
            "the whole period.",
        },
        value: {
          type: "string",
          description:
            'The filter value, such as "Germany" or "Online". Required when ' +
            "dimension is given.",
        },
      },
      required: ["metric"],
    },
    // Not read only, twice over. It moves the dashboard to the slice it
    // checked, so the verdict and the figure on screen are about one thing
    // rather than two. And a non-ok verdict sets hasFailedCheck, which makes
    // explain_data_issue and trace_lineage relevant: changing which tools
    // exist is itself a change to the environment.
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (args) => {
      const metric = asMetricId(args.metric);
      if (!metric)
        return text(
          `"${args.metric}" is not a metric. Call list_metrics for the real list.`,
        );
      const period = asPeriod(args.period);
      const dimension = asDimensionId(args.dimension) ?? undefined;
      const value = asText(args.value);

      // A dimension the registry does not know would fall through to undefined
      // and quietly become a whole-period check. Refuse: a month-wide verdict
      // returned to an agent that asked about one slice is a wrong answer that
      // looks like a right one.
      if (args.dimension !== undefined && dimension === undefined) {
        return text(
          `"${args.dimension}" is not a dimension, so nothing was checked. ` +
            `Dropping it would have checked the whole of ${period} and ` +
            `answered as though it were your slice. Call describe_metric to ` +
            `see which axes ${metric} splits by.`,
        );
      }

      if (value && !dimension) {
        return text(
          `value "${value}" was given with no dimension, so there is no axis ` +
            `to apply it on and nothing was checked. Pass dimension as well, ` +
            `for example dimension "country" with value "${value}".`,
        );
      }

      if (dimension && !value) {
        const all = await readChecks(period);
        const options = all.value
          .filter((c) => c.dimension === dimension)
          .map((c) => `${c.value} (${c.verdict})`)
          .join(", ");
        return text(
          `dimension "${dimension}" was given without a value, so there is no ` +
            `slice to check. Values evaluated for ${period} on that axis: ` +
            `${options || "none"}. Call again with one of them, or drop ` +
            `dimension to ask about the whole period.`,
        );
      }

      const check = await readCheck({ metric, period, dimension, value });

      // Move the page to the slice that was checked, so the verdict in the
      // agent's reply and the figure in front of the person are about the same
      // thing. A chat answer naming Germany while the screen still shows the
      // whole month is two different claims that look like one.
      setMetric(metric);
      setPeriod(period);
      setFilters({
        country: dimension === "country" ? (value ?? null) : null,
        channel: dimension === "channel" ? (value ?? null) : null,
        category: dimension === "category" ? (value ?? null) : null,
      });

      if (check.value && check.value.verdict !== "ok") {
        // A failed check is what registers explain_data_issue and trace_lineage.
        // The surface grows with context; nothing is refused to anyone.
        setState({ hasFailedCheck: true });
      }

      const head = verdictLine(check, metric, period, dimension, value);
      if (!check.value) {
        return text(
          `${head}\n\nSlices the pipeline did evaluate for ${checkedPeriod()}: ` +
            (await readChecks(checkedPeriod())).value
              .map((c) =>
                c.dimension === null
                  ? "the whole period"
                  : `${c.dimension} = ${c.value}`,
              )
              .join(", ") +
            `.\n\nAsk again for one of those, or accept that this slice has no ` +
            `verdict and say so rather than publishing it.`,
        );
      }

      return text(
        `${head}\n\n${check.value.plainLanguage}\n\n${advice(check.value.verdict)}`,
      );
    },
  };
}

function explainDataIssue(): ToolSpec {
  return {
    name: "explain_data_issue",
    title: "Explain the problem in plain language",
    description:
      "Turn a failed data check into one or two sentences a person who has " +
      "never heard of an exchange rate join can act on. No table names, no " +
      "check names, no jargon. Use this when you have to tell someone why " +
      "their number is not going in the deck.",
    inputSchema: {
      type: "object",
      properties: {
        metric: { ...METRIC_ENUM, description: "Which metric." },
        period: {
          type: "string",
          description: `Month as YYYY-MM. Defaults to ${checkedPeriod()}.`,
        },
        dimension: {
          ...DIMENSION_ENUM,
          description: "The axis the filter is on. Omit for the whole period.",
        },
        value: { type: "string", description: "The filter value." },
      },
      required: [],
    },
    // Read only, verified by inspection: this calls no store setter and moves
    // nothing on screen. Only the tools that read without moving the page qualify.
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async (args) => {
      const metric = asMetricId(args.metric) ?? "net_revenue";
      const period = asPeriod(args.period);
      const dimension = asDimensionId(args.dimension) ?? undefined;
      const value = asText(args.value);
      const check = await readCheck({ metric, period, dimension, value });

      if (!check.value) {
        const all = await readChecks(checkedPeriod());
        const bad = all.value.filter((c) => c.verdict !== "ok");
        return text(
          `There is no recorded problem for that exact slice. What did go ` +
            `wrong in ${checkedPeriod()}, in plain language:\n\n` +
            bad
              .map(
                (c) =>
                  `${c.dimension === null ? "Overall" : `${c.value}`}: ${c.plainLanguage}`,
              )
              .join("\n\n") +
            `\n\nCall check_data_trust with one of those slices for the full ` +
            `verdict, or trace_lineage to show where it broke.`,
        );
      }

      const row = check.value;
      const plain = row.plainLanguage;
      const whatToSay =
        row.verdict === "blocked"
          ? `Say: the figure cannot be published for this period, and it will ` +
            `be right again once the missing rates load and the pipeline runs ` +
            `next. Do not offer the number with a caveat, because the number ` +
            `itself is the thing that is wrong.`
          : row.verdict === "degraded"
            ? `Say: the figure is usable but understated, and by roughly how ` +
              `much. Attach that sentence to the number wherever it goes, ` +
              `because on its own it reads as completely normal.`
            : `Nothing is wrong with this slice. Say so plainly and publish it.`;

      return text(
        `${plain}\n\n${whatToSay}\n\n` +
          `If they want to see it rather than be told it, call trace_lineage: ` +
          `it walks the chain from the number on the dashboard back to the ` +
          `system the rates arrive from, and marks the rung that broke.`,
      );
    },
  };
}

/**
 * One rung of the ladder.
 *
 * /api/lineage answers at the depth that fits who is asking: someone in
 * Operations gets the plain sentence in the `node` field where an engineer gets
 * `silver.fct_order_lines`. When the two are the same the sentence is not
 * printed twice.
 */
function stageLine(node: LineageNode): string {
  const rows =
    node.rowsIn !== undefined && node.rowsOut !== undefined
      ? `  ${node.rowsIn.toLocaleString("en-US")} in, ${node.rowsOut.toLocaleString("en-US")} out, ` +
        `${(node.rowsIn - node.rowsOut).toLocaleString("en-US")} rejected`
      : node.rowsOut !== undefined
        ? `  ${node.rowsOut.toLocaleString("en-US")} rows`
        : "";
  const summary =
    node.summary && node.summary !== node.node ? ` ${node.summary}` : "";
  return (
    `${node.failed ? "BROKE HERE  " : "            "}${node.node}\n` +
    `            [${node.stage}]${summary}\n` +
    (rows === "" ? "" : `          ${rows}\n`)
  );
}

function traceLineage(): ToolSpec {
  return {
    name: "trace_lineage",
    title: "Trace a number to its source",
    description:
      "Walk the chain from a dashboard number back to the operational system " +
      "the data came from, one labelled stage at a time, and mark the rung " +
      "where rows were lost. Opens the lineage ladder on the page, so the " +
      "person at the screen sees the same chain you are reading.",
    inputSchema: {
      type: "object",
      properties: {
        metric: { ...METRIC_ENUM, description: "Which metric to trace." },
      },
      required: [],
    },
    // Not read only. It calls setView to put the lineage ladder on screen,
    // which modifies the environment. Reading a chain the pipeline already
    // recorded would be read only on its own; showing it is not.
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (args) => {
      const metric = asMetricId(args.metric) ?? "net_revenue";
      const lineage = await readLineage(metric);
      const runs = await readRuns();
      const latest = runs.value[0];

      setView("lineage");

      const failed = lineage.value.nodes.find((n) => n.failed);
      // The pipeline records one chain, against net_revenue. Reporting it under
      // another metric's name would be this project's own failure mode: a
      // number presented as traced when nothing traced it.
      const recorded = lineage.value.metric as MetricId;
      const note =
        metric === recorded
          ? ""
          : `The chain below was recorded against ${recorded}, not ${metric}. ` +
            `Nothing is traced for ${metric} on its own.` +
            coverageNote(metric, recorded);
      return text(
        `The lineage ladder is now open on the page. Read it upward: the ` +
          `dashboard number is at the top and the system it came from is at ` +
          `the bottom.\n\n` +
          (note ? `${note}\n\n` : "") +
          lineage.value.nodes.map(stageLine).join("\n") +
          `\n` +
          (latest
            ? `Produced by run ${latest.id}, status ${latest.status}, finished ` +
              `${latest.finishedUtc ?? "not yet"}.\n\n`
            : "") +
          (failed
            ? `The break is at: ${failed.node}` +
              (failed.summary && failed.summary !== failed.node
                ? ` ${failed.summary}`
                : "") +
              ` Everything above that rung inherits the loss, which is why the ` +
              `dashboard figure looks ordinary rather than obviously wrong.\n\n`
            : `No rung on this chain lost rows.\n\n`) +
          `Read from the ${lineage.source}. To say this to someone who does ` +
          `not know what a join is, call explain_data_issue. To decide whether ` +
          `a particular slice can still be published, call check_data_trust ` +
          `with that slice's filter, because not every country on this metric ` +
          `is affected.`,
      );
    },
  };
}

/** Registered once a session exists. */
export function trustTools(): ToolSpec[] {
  return [checkDataTrust()];
}

/** Registered only after a check has come back not-ok. */
export function diagnosticTools(): ToolSpec[] {
  return [explainDataIssue(), traceLineage()];
}
