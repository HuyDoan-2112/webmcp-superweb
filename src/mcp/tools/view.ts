// filter_dashboard.
//
// Layer 2: a few lines over setFilters, setPeriod, setMetric and setView, all
// of which already exist because the sidebar and the period bar call them.
//
// What this let us not build is the whole natural-language filter surface a
// dashboard normally grows: a saved-views menu, a query box, a URL scheme with
// parameters, and the parsing behind all three. The agent already speaks the
// person's language, so the page only has to expose the setters.
//
// Country and channel enums are read from the pipeline artifact rather than
// hardcoded, so the agent can only name a slice that has a verdict behind it.

import { DEMO_PERIOD } from "@shared/metrics";
import { getState, setFilters, setMetric, setPeriod, setView, type View } from "@/store";
import { recordedValues } from "../api";
import { text, type ToolSpec } from "../adapter";
import { asMetricId, asPeriod, METRIC_ENUM } from "./args";

const VIEWS: View[] = ["dashboard", "report", "lineage"];

function filterDashboard(): ToolSpec {
  return {
    name: "filter_dashboard",
    title: "Move the dashboard",
    description:
      "Set the period, the metric, the filters and the view the dashboard is " +
      "showing, in one call. This moves what the person at the screen is " +
      "looking at, so use it to take them with you rather than describing a " +
      "view they cannot see. Pass an empty string to drop a filter.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: `Month as YYYY-MM. The demo period is ${DEMO_PERIOD}.`,
        },
        metric: { ...METRIC_ENUM, description: "Which metric to show." },
        country: {
          type: "string",
          enum: ["", ...recordedValues("country")],
          description:
            "Narrow to one country. Empty string drops the filter. These are " +
            "the values the pipeline evaluated checks for.",
        },
        channel: {
          type: "string",
          enum: ["", ...recordedValues("channel")],
          description:
            "Narrow to online or in store. Empty string drops the filter.",
        },
        category: {
          type: "string",
          description:
            "Narrow to one product category. Empty string drops the filter. " +
            "Not available on order_count, which is counted per order rather " +
            "than per line.",
        },
        view: {
          type: "string",
          enum: [...VIEWS],
          description:
            "Which page to show: the dashboard, the report, or the lineage ladder.",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (args) => {
      const moved: string[] = [];

      if (typeof args.period === "string" && args.period.trim() !== "") {
        const period = asPeriod(args.period);
        setPeriod(period);
        moved.push(`period ${period}`);
        if (period !== args.period)
          moved.push(`(that is not a YYYY-MM month, so it fell back)`);
      }

      const metric = asMetricId(args.metric);
      if (metric) {
        setMetric(metric);
        moved.push(`metric ${metric}`);
      } else if (args.metric !== undefined) {
        return text(
          `"${args.metric}" is not a metric, so nothing moved. Call ` +
            `list_metrics for the real list.`,
        );
      }

      for (const key of ["country", "channel", "category"] as const) {
        const raw = args[key];
        if (typeof raw !== "string") continue;
        setFilters({ [key]: raw === "" ? null : raw });
        moved.push(raw === "" ? `${key} filter dropped` : `${key} ${raw}`);
      }

      if (typeof args.view === "string" && (VIEWS as string[]).includes(args.view)) {
        setView(args.view as View);
        moved.push(`view ${args.view}`);
      }

      if (moved.length === 0) {
        const s = getState();
        return text(
          `Nothing was passed, so nothing moved. The dashboard is currently on ` +
            `${s.metricId} for ${s.period}, view "${s.view}", filters ` +
            `country=${s.filters.country ?? "all"}, ` +
            `channel=${s.filters.channel ?? "all"}, ` +
            `category=${s.filters.category ?? "all"}.`,
        );
      }

      const s = getState();
      return text(
        `The dashboard moved: ${moved.join(", ")}.\n\n` +
          `It is now on ${s.metricId} for ${s.period}, view "${s.view}", ` +
          `filtered to country=${s.filters.country ?? "all"}, ` +
          `channel=${s.filters.channel ?? "all"}, ` +
          `category=${s.filters.category ?? "all"}.\n\n` +
          `The person at the screen is looking at this. Before you quote any ` +
          `figure from it, call check_data_trust with these same filters: the ` +
          `verdict changes with the filter, and moving the page does not move ` +
          `the verdict with it.`,
      );
    },
  };
}

export function viewTools(): ToolSpec[] {
  return [filterDashboard()];
}
