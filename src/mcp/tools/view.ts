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
import { readProducts, recordedValues } from "../api";
import { text, type ToolSpec } from "../adapter";
import { asMetricId, asPeriod, METRIC_ENUM } from "./args";

const VIEWS: View[] = ["dashboard", "report", "lineage"];

function filterDashboard(categories: string[]): ToolSpec {
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
          // recordedValues("category") is empty by design: the pipeline only
          // evaluates checks for country and channel. The categories are read
          // from the catalogue instead, so this field is still constrained to
          // values that exist rather than being free text that silently
          // filters the dashboard down to nothing.
          ...(categories.length > 0 ? { enum: ["", ...categories] } : {}),
          description:
            "Narrow to one product category. Empty string drops the filter. " +
            "Not available on order_count, which is counted per order rather " +
            "than per line. No quality check is recorded per category, so " +
            "check_data_trust answers by country and channel only.",
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
        if (period === null) {
          return text(
            `"${args.period}" is not a month, so the dashboard did not move. ` +
              `Months are YYYY-MM with a two digit month from 01 to 12.`,
          );
        }
        setPeriod(period);
        moved.push(`period ${period}`);
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
        // A category the catalogue does not have would filter the dashboard
        // down to nothing while this tool reported that the page had moved.
        // Refuse instead of moving, the same way an unknown metric does.
        if (key === "category" && raw !== "" && categories.length > 0 && !categories.includes(raw)) {
          return text(
            `"${raw}" is not a category in the catalogue, so nothing moved. ` +
              `The categories are: ${categories.join(", ")}.`,
          );
        }
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

/**
 * Async for the same reason publicTools is: the category enum is read from the
 * catalogue before anything registers, so the schema carries real values. A
 * probe that fails costs the enum, not the tool.
 */
export async function viewTools(): Promise<ToolSpec[]> {
  const probe = await readProducts({ limit: 1 });
  const categories = probe ? probe.facets.categories.map((c) => c.label) : [];
  return [filterDashboard(categories)];
}
