// The internal read tools: list_metrics, get_metric, breakdown_metric,
// describe_metric.
//
// Registered once a session exists, which on this build means once someone has
// signed in and the surface has switched to the dashboard.
//
// Capability scales through arguments rather than registrations.
// breakdown_metric alone answers roughly forty questions, six metrics against
// eight dimensions, from one registration. Forty named tools would answer the
// same questions and make the agent worse at choosing between them.
//
// Every schema enum here is built from METRIC_IDS and DIMENSION_IDS in
// shared/metrics.ts, at registration time, after the registry has loaded. The
// agent cannot name a metric that does not exist, because the browser will not
// let it.
//
// find_drivers is deliberately absent. It overlaps breakdown_metric and
// docs/PLAN.md ranks it cut-first.
//
// breakdown_metric returns a pipe table rather than hand-aligned lines. That
// was a change to the return value, not to the schema: a `format` enum would
// have been one more thing for the agent to get wrong, for output it can have
// for free. See issue #27.

import {
  DEMO_PERIOD,
  DIMENSION_IDS,
  METRICS,
  METRIC_IDS,
  getDimension,
  getMetric,
  supportsDimension,
} from "@shared/metrics";
import { getState, setMetric, setPeriod, setView } from "@/store";
import { NO_QUERY_ENDPOINT, readCheck, readQuery } from "../api";
import { text, type ToolSpec } from "../adapter";
import { verdictLine } from "./trust";
import { asDimensionId, asMetricId, asPeriod, METRIC_ENUM } from "./args";
import type { MetricUnit } from "@shared/types";

/**
 * Render a value in its own unit. A ratio printed as a currency, or a currency
 * printed bare, is the kind of small wrongness that survives into a deck.
 */
function format(value: number, unit: MetricUnit): string {
  if (unit === "currency")
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  if (unit === "ratio") return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString("en-US");
}

/**
 * The rows as a table an agent can re-read without parsing prose.
 *
 * A pipe table, and only a pipe table. The hand-formatted lines this replaced
 * could not be re-sorted, summed or filtered without guessing at a shape
 * nothing promised, and keeping both renderings would be the drift problem this
 * repo keeps warning about at a smaller scale: two spellings of the same rows,
 * free to disagree.
 *
 * Both numbers travel. `value` is rendered in the metric's own unit, because a
 * ratio printed as a currency survives into a deck; `raw` is the unformatted
 * number, because an agent that sums or re-sorts a formatted string gets it
 * wrong. One number rendered twice is safe in a way two row sets would not be.
 *
 * No verdict column. The verdict ranges over metric plus period plus filter,
 * never over one row, so a per-row column would invent verdicts the pipeline
 * never recorded. It stays in the prose below, where re-sorting the rows cannot
 * detach it from what it governs.
 */
function table(
  rows: { label?: string | null; value: number; share?: number }[],
  dimensionLabel: string,
  unit: MetricUnit,
): string {
  const head = `| ${dimensionLabel} | value | raw | share |\n| --- | ---: | ---: | ---: |`;
  const body = rows
    .map((r) => {
      const share = r.share !== undefined ? `${(r.share * 100).toFixed(1)}%` : "";
      return (
        `| ${r.label ?? "(unlabelled)"} | ${format(r.value, unit)} | ` +
        `${r.value} | ${share} |`
      );
    })
    .join("\n");
  return `${head}\n${body}`;
}

/**
 * A link to the chart the dashboard is showing, drawn server side.
 *
 * A capability the agent gets as an argument rather than as a `chart_metric`
 * tool. A tool would duplicate metric, period and dimension on every call and
 * overlap breakdown_metric completely, which is how tool selection degrades.
 * See issue #22.
 *
 * On get_metric only. A breakdown has no chart to link to: the page renders a
 * breakdown as a TABLE (src/ui/breakdown.tsx), so an endpoint that drew bars
 * for it would be a second drawing with nothing on screen to agree with, which
 * is the drift issue #29 exists to prevent. The breakdown's machine-readable
 * form is the pipe table above.
 *
 * The picture is the page's picture: /api/chart renders the same Recharts
 * module TrendChart renders, from the same rows, under the same store filters
 * the page is showing, and stamps the trust verdict into the image itself. That last part matters more than it looks. An image
 * travels in a way a transcript does not, so a chart of an incomplete figure
 * that carried no verdict would be the failure this project exists to stop,
 * made more pasteable.
 */
function chartUrl(metric: string, period: string): string {
  const filters = getState().filters;
  const query = new URLSearchParams({ metric, period });
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string" && value !== "") query.set(key, value);
  }
  const origin =
    typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/api/chart?${query.toString()}`;
}

const CHART_ARG = {
  type: "boolean" as const,
  description:
    "Return a link to the chart as well as the figures. The image is drawn " +
    "from the same rows the page draws and carries the trust verdict stamped " +
    "into it, so it stays honest when it is pasted somewhere else. Ask for it " +
    "when a person is going to look at this, not when only you are.",
};

function chartLine(metric: string, period: string): string {
  return (
    `

Chart: ${chartUrl(metric, period)}
` +
    `That link opens the trend for this slice as an image. If the figures ` +
    `behind it were not fully counted, the picture says so on its face, so it ` +
    `can be handed to someone else without this conversation going with it.`
  );
}

function listMetrics(): ToolSpec {
  return {
    name: "list_metrics",
    title: "List metrics",
    description:
      "List every business quantity this dashboard can answer for, with the " +
      "unit it is measured in, the table it is counted on and the dimensions " +
      "it can be split along. Start here: it tells you which arguments the " +
      "other tools will accept.",
    inputSchema: { type: "object", properties: {}, required: [] },
    // Read only, verified by inspection: this calls no store setter and moves
    // nothing on screen. Only the tools that read without moving the page qualify.
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () =>
      text(
        `${METRICS.length} metrics are defined. The demo period is ` +
          `${DEMO_PERIOD}.\n\n` +
          METRICS.map(
            (m) =>
              `${m.id}  (${m.label}, ${m.unit})\n` +
              `  ${m.description}\n` +
              `  counted on   ${m.grain}\n` +
              `  splits by    ${m.dimensions.join(", ")}`,
          ).join("\n\n") +
          `\n\nTwo grains, not one. order_count lives on ` +
          `gold.fact_orders_daily because one order spans several products, ` +
          `and everything else lives on gold.fact_sales_daily. Dividing one by ` +
          `the other without saying so produces a wrong ratio, so call ` +
          `describe_metric before you compare across grains.\n\n` +
          `Next: get_metric for one figure, breakdown_metric to split one ` +
          `along a dimension, describe_metric for the definition, and ` +
          `check_data_trust before you write any of it down.`,
      ),
  };
}

function getMetricTool(): ToolSpec {
  return {
    name: "get_metric",
    title: "Get one metric",
    description:
      "Move the dashboard to one metric for one period and read what it says. " +
      "Returns the figure together with the trust verdict for that exact " +
      "slice, because a number without a verdict is the thing this dashboard " +
      "exists to stop being pasted into a deck.",
    inputSchema: {
      type: "object",
      properties: {
        metric: { ...METRIC_ENUM, description: "Which metric to read." },
        period: {
          type: "string",
          description: `Month as YYYY-MM. Defaults to ${DEMO_PERIOD}.`,
        },
        chart: CHART_ARG,
      },
      required: ["metric"],
    },
    // Not read only. The MCP schema defines readOnlyHint as "the tool does not
    // modify its environment", and this calls setMetric, setPeriod and setView.
    // The page is the environment. Whether the change is reversible, or whether
    // anyone could be held responsible for it, is a different question that the
    // hint does not ask.
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (args) => {
      const metric = asMetricId(args.metric);
      if (!metric) {
        return text(
          `"${args.metric}" is not a metric. Call list_metrics for the ` +
            `${METRIC_IDS.length} that exist.`,
        );
      }
      const period = asPeriod(args.period);
      const definition = getMetric(metric);

      setMetric(metric);
      setPeriod(period);
      setView("dashboard");

      const query = await readQuery({ metric, period });
      const figure =
        query && query.rows.length > 0
          ? `${definition.label} for ${period} is ` +
            `${format(query.rows[0].value, definition.unit)}.` +
            (query.rows[0].delta !== undefined
              ? ` That is ${(query.rows[0].delta * 100).toFixed(1)} per cent ` +
                `against the preceding period of equal length.`
              : "")
          : NO_QUERY_ENDPOINT;

      const check = await readCheck({ metric, period });
      return text(
        `The dashboard is now on ${definition.label} for ${period}.\n\n` +
          `${figure}\n\n` +
          `${verdictLine(check, metric, period, undefined, undefined)}\n\n` +
          `Next: breakdown_metric to see which countries or channels make it ` +
          `up, describe_metric for what is excluded from it, and ` +
          `check_data_trust with a filter before publishing any single slice. ` +
          `The whole-period verdict does not carry down to every slice inside ` +
          `it, and on this period it genuinely does not.` +
          (args.chart === true ? chartLine(metric, period) : ""),
      );
    },
  };
}

function breakdownMetric(): ToolSpec {
  return {
    name: "breakdown_metric",
    title: "Break a metric down",
    description:
      "Split one metric along one dimension for one period and rank the " +
      "result. This is the workhorse: six metrics against eight dimensions " +
      "from one tool. It refuses combinations that do not exist at the " +
      "metric's grain rather than returning a plausible wrong answer.",
    inputSchema: {
      type: "object",
      properties: {
        metric: { ...METRIC_ENUM, description: "Which metric to split." },
        dimension: {
          type: "string",
          enum: [...DIMENSION_IDS],
          description: "Which axis to split it along.",
        },
        period: {
          type: "string",
          description: `Month as YYYY-MM. Defaults to ${DEMO_PERIOD}.`,
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 50,
          description: "How many rows to return. Defaults to 10.",
        },
      },
      required: ["metric", "dimension"],
    },
    // Not read only, for the same reason as get_metric: setMetric, setPeriod
    // and setView all modify the environment the tool runs in.
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (args) => {
      const metric = asMetricId(args.metric);
      const dimension = asDimensionId(args.dimension);
      if (!metric)
        return text(
          `"${args.metric}" is not a metric. Call list_metrics for the real list.`,
        );
      if (!dimension)
        return text(
          `"${args.dimension}" is not a dimension. Call list_metrics to see ` +
            `which dimensions each metric splits along.`,
        );

      const definition = getMetric(metric);
      if (!supportsDimension(metric, dimension)) {
        return text(
          `${metric} cannot be split by ${dimension}. It is counted on ` +
            `${definition.grain}, and ${dimension} does not exist at that ` +
            `grain. For order_count specifically: one order covers several ` +
            `products, so there is no single category, subcategory or brand to ` +
            `attribute it to. Splitting it anyway would attribute the same ` +
            `order to several rows.\n\n` +
            `${metric} splits by: ${definition.dimensions.join(", ")}. ` +
            `Call describe_metric for the grain in full, or breakdown_metric ` +
            `again with one of those dimensions.`,
        );
      }

      const period = asPeriod(args.period);
      const limit = typeof args.limit === "number" ? Math.trunc(args.limit) : 10;

      setMetric(metric);
      setPeriod(period);
      setView("dashboard");

      const query = await readQuery({ metric, period, dimension });
      const dim = getDimension(dimension);
      const rows =
        query && query.rows.length > 0
          ? table(query.rows.slice(0, limit), dim.label, definition.unit)
          : NO_QUERY_ENDPOINT;

      return text(
        `The dashboard is now showing ${definition.label} for ${period}, ` +
          `split by ${dim.label}.\n\n${rows}\n\n` +
          `${dim.description}\n\n` +
          `Do not publish any row above before calling check_data_trust with ` +
          `dimension "${dimension}" and the row's own value. The verdict ` +
          `ranges over metric plus period plus filter, and on this period some ` +
          `rows of this very breakdown are sound while others have no data ` +
          `behind them at all.`,
      );
    },
  };
}

function describeMetric(): ToolSpec {
  return {
    name: "describe_metric",
    title: "Describe a metric",
    description:
      "The full definition of one metric: what it means in plain language, " +
      "the table it is counted on, which rows the pipeline removes before it " +
      "is computed, the dimensions it can be split along, its definition " +
      "version, and the chain of transformations that produce it. Ask this " +
      "before comparing two metrics, because two metrics at different grains " +
      "cannot be divided without saying so.",
    inputSchema: {
      type: "object",
      properties: {
        metric: { ...METRIC_ENUM, description: "Which metric to describe." },
        compare_with: {
          ...METRIC_ENUM,
          description:
            "Optional second metric. Returns whether the two share a grain " +
            "and can therefore be combined.",
        },
      },
      required: ["metric"],
    },
    // Read only, verified by inspection: this calls no store setter and moves
    // nothing on screen. Only the tools that read without moving the page qualify.
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async (args) => {
      const metric = asMetricId(args.metric);
      if (!metric)
        return text(
          `"${args.metric}" is not a metric. Call list_metrics for the real list.`,
        );
      const m = getMetric(metric);

      const body =
        `${m.id}  (${m.label})\n\n` +
        `meaning            ${m.description}\n` +
        `unit               ${m.unit}\n` +
        `grain              ${m.grain}\n` +
        `definition version ${m.definitionVersion}\n` +
        `owner              ${m.lineage.owner}\n` +
        `freshness          ${m.lineage.freshness}\n` +
        `splits by          ${m.dimensions.join(", ")}\n\n` +
        `Rows removed before this is computed:\n` +
        m.exclusions.map((e) => `  - ${e}`).join("\n") +
        `\n\nUpstream:\n` +
        m.lineage.upstream.map((u) => `  ${u}`).join("\n") +
        `\n\nTransformations:\n` +
        m.lineage.transforms.map((t) => `  - ${t}`).join("\n");

      const other = asMetricId(args.compare_with);
      let grainNote =
        `\n\nGrain matters here. ${m.id} is counted on ${m.grain}. A metric ` +
        `on gold.fact_orders_daily counts orders and one order spans several ` +
        `products; a metric on gold.fact_sales_daily counts order lines. ` +
        `Dividing across the two produces a number that looks reasonable and ` +
        `is wrong.`;

      if (other && other !== m.id) {
        const o = getMetric(other);
        grainNote =
          o.grain === m.grain
            ? `\n\n${m.id} and ${o.id} are both counted on ${m.grain}, so they ` +
              `share a grain and can be combined or divided directly.`
            : `\n\nDo not combine ${m.id} and ${o.id} without saying so. ` +
              `${m.id} is counted on ${m.grain} and ${o.id} on ${o.grain}. ` +
              `One order spans several products, so the row counts behind the ` +
              `two are different populations. A ratio of the two is not an ` +
              `average of anything.`;
      }

      return text(
        body +
          grainNote +
          `\n\nThis is the definition, not the data. Call check_data_trust for ` +
          `whether a particular slice of it is publishable, and trace_lineage ` +
          `to walk the chain back to the system it came from.`,
      );
    },
  };
}

/** The four internal read tools. */
export function readTools(): ToolSpec[] {
  return [listMetrics(), getMetricTool(), breakdownMetric(), describeMetric()];
}
