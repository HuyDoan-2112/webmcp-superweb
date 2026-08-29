// start_report, draft_report, build_deck.
//
// draft_report is the only layer 3 tool in the build: real logic, because the
// thing it does cannot be expressed as one control on the page. Everything else
// here is a setter with steering text around it.
//
// It is not an orchestrator. The agent has already gathered what it needs with
// the read tools; this commits it into the report, and checks every section
// before writing it. The check does not live in a dashboard nobody reads, or in
// an analyst's head, or in a Slack thread three weeks later. It lives in the
// moment the number would have been written down. That inversion is the
// project.
//
// The sections land on the page, not just in the agent's reply. `commit()`
// calls setReportSections, src/ui/report.tsx renders what is in the store, and
// its own live preview steps aside. That handover is the beat: the agent's work
// stops being a chat message and becomes the document.

import {
  getState,
  openReport,
  setReportSections,
  setState,
  type ReportSection,
} from "@/store";
import { checkedPeriod, readCheck, readChecks, type CheckRow } from "../api";
import { text, type ToolSpec } from "../adapter";
import { asMetricId, asPeriod, asText, DIMENSION_ENUM, METRIC_ENUM } from "./args";
import { asDimensionId } from "./args";

/**
 * Exactly the shape src/ui/report.tsx renders, imported from the store rather
 * than declared again here so the two cannot drift apart.
 */
type DraftedSection = ReportSection;

type SectionRequest = {
  heading: string;
  dimension?: string;
  value?: string;
  commentary?: string;
};

function parseSections(raw: unknown): SectionRequest[] {
  if (!Array.isArray(raw)) return [];
  const out: SectionRequest[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const s = item as Record<string, unknown>;
    const heading = asText(s.heading);
    if (!heading) continue;
    out.push({
      heading,
      dimension: asText(s.dimension),
      value: asText(s.value),
      commentary: asText(s.commentary),
    });
  }
  return out;
}

/**
 * When no sections are given, draft one per slice the pipeline evaluated.
 *
 * That is not a convenience shortcut, it is the honest default: the report can
 * only cover slices that have a verdict, and the pipeline is the thing that
 * decides which those are.
 */
async function defaultSections(period: string): Promise<SectionRequest[]> {
  const all = await readChecks(period);
  return all.value
    .filter((c) => c.dimension === "country" && c.value !== null)
    .map((c) => ({
      heading: c.value as string,
      dimension: "country",
      value: c.value as string,
    }));
}

function bodyFor(
  request: SectionRequest,
  check: CheckRow | null,
  period: string,
): DraftedSection {
  if (!check) {
    // Blocked, so the agent's commentary is dropped here too. Silence from the
    // pipeline is not the same answer as a passing check, and a section that
    // said so in the agent's own confident prose would read like one.
    return {
      heading: request.heading,
      body:
        `The pipeline recorded no data quality check for this slice in ` +
        `${period}, so nothing stands behind a number here.`,
      verdict: "blocked",
    };
  }

  if (check.verdict === "blocked") {
    // Never a number, not even a caveated one. A blocked section that carries a
    // figure is a section someone will paste. It keeps its heading and its
    // verdict so it stays visible on the page, and its body is the pipeline's
    // own plain-language sentence: why there is nothing to publish, said in
    // words rather than left as a silence. The commentary the agent wrote is
    // dropped, because commentary written around a figure describes a figure
    // that is not there.
    return {
      heading: request.heading,
      body: check.plainLanguage,
      verdict: "blocked",
    };
  }

  // The gap sentence travels with the number, always. A degraded figure is the
  // more dangerous of the two bad states, because a blocked section cannot be
  // pasted into a deck and this one can.
  //
  // Row counts are withheld from an audience that did not ask for them, so the
  // sentence falls back to the pipeline's own plain language rather than
  // printing zeros.
  const gap =
    check.verdict === "degraded"
      ? check.expectedRows > 0
        ? ` This figure is short by ${check.rejectedRows.toLocaleString("en-US")} ` +
          `of ${check.expectedRows.toLocaleString("en-US")} order lines, about ` +
          `${((check.rejectedRows / check.expectedRows) * 100).toFixed(1)} per ` +
          `cent, and reads as ordinary without this sentence attached to it.`
        : ` ${check.plainLanguage}`
      : "";

  const opening =
    request.commentary ??
    (check.verdict === "ok"
      ? `Every order line behind this section was counted for ${period}.`
      : `This section covers ${period}.`);

  return {
    heading: request.heading,
    body: opening + gap,
    verdict: check.verdict,
  };
}

function startReport(): ToolSpec {
  return {
    name: "start_report",
    title: "Open the report builder",
    description:
      "Open the report on the page so sections can be written into it. " +
      "Initiation, not execution: this opens the builder and registers " +
      "draft_report and build_deck. Nothing is written until you call " +
      "draft_report.",
    inputSchema: { type: "object", properties: {}, required: [] },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      openReport();
      return text(
        `The report is open on the page. Two tools have just been registered ` +
          `for you: draft_report writes sections into it, and build_deck lays ` +
          `the result out as slides.\n\n` +
          `draft_report runs a data quality check on every section before it ` +
          `writes one, and refuses to write a number that has not earned it. ` +
          `You do not have to pre-check each slice yourself; call it with the ` +
          `sections you want and read what it refused.`,
      );
    },
  };
}

function draftReport(): ToolSpec {
  return {
    name: "draft_report",
    title: "Draft the report",
    description:
      "Write sections into the open report. Every section is checked against " +
      "the pipeline before it is written: a section whose data is sound gets " +
      "its number, a section that is short gets its number with the gap " +
      "attached, and a section whose rows were never counted is held back with " +
      "no number at all. Call it with the sections you want; it will tell you " +
      "what it refused and why. Omit sections entirely to draft one per slice " +
      "the pipeline has a verdict for.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: `Month as YYYY-MM. Defaults to ${checkedPeriod()}.`,
        },
        focus_metric: {
          ...METRIC_ENUM,
          description: "The metric the report is about. Defaults to net_revenue.",
        },
        sections: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          description:
            "The sections to write. Omit to draft one per evaluated slice.",
          items: {
            type: "object",
            properties: {
              heading: {
                type: "string",
                description: "Section heading as a reader will see it.",
              },
              dimension: {
                ...DIMENSION_ENUM,
                description:
                  "The axis this section is scoped to, usually country or channel.",
              },
              value: {
                type: "string",
                description:
                  'The slice this section covers, such as "Germany" or "Online".',
              },
              commentary: {
                type: "string",
                description:
                  "Your own sentence about this section. Dropped entirely if " +
                  "the section turns out to be blocked.",
              },
            },
            required: ["heading"],
          },
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (args) => {
      const period = asPeriod(args.period);
      const metric = asMetricId(args.focus_metric) ?? "net_revenue";
      const requested = parseSections(args.sections);
      const sections =
        requested.length > 0 ? requested : await defaultSections(period);

      if (sections.length === 0) {
        return text(
          `Nothing to draft. No sections were given and the pipeline has no ` +
            `evaluated slices for ${period}. The period it did evaluate is ` +
            `${checkedPeriod()}. Call draft_report again with that period.`,
        );
      }

      openReport();

      const drafted: DraftedSection[] = [];
      const reasons: string[] = [];

      for (const request of sections) {
        const dimension = asDimensionId(request.dimension) ?? undefined;
        const check = await readCheck({
          metric,
          period,
          dimension,
          value: dimension ? request.value : undefined,
        });
        const section = bodyFor(request, check.value, period);
        drafted.push(section);

        if (section.verdict !== "ok" && check.value) {
          reasons.push(
            `${section.heading}: ${section.verdict.toUpperCase()}. ` +
              check.value.plainLanguage,
          );
        } else if (!check.value) {
          reasons.push(
            `${section.heading}: BLOCKED. No check was recorded for this slice, ` +
              `so nothing stands behind a figure here.`,
          );
        }
      }

      commit(drafted);

      const blocked = drafted.filter((s) => s.verdict === "blocked");
      const degraded = drafted.filter((s) => s.verdict === "degraded");
      const published = drafted.filter((s) => s.verdict === "ok");

      if (blocked.length > 0 || degraded.length > 0) {
        setState({ hasFailedCheck: true });
      }

      // Word for word what src/ui/report.tsx now shows, so the agent is reading
      // the page rather than a parallel account of it.
      const body = drafted
        .map(
          (s) =>
            `## ${s.heading}  [${s.verdict}]\n` +
            (s.verdict === "blocked" ? `No number written. ${s.body}` : s.body),
        )
        .join("\n\n");

      return text(
        `Drafted ${published.length + degraded.length} of ${drafted.length} ` +
          `sections for ${metric}, ${period}. They are on the page now: the ` +
          `report is showing what you committed, not its own preview.\n\n` +
          `${body}\n\n` +
          (reasons.length > 0 ? `Why:\n${reasons.join("\n")}\n\n` : "") +
          (blocked.length > 0
            ? `${blocked.length} section${blocked.length === 1 ? " is" : "s are"} ` +
              `BLOCKED and carr${blocked.length === 1 ? "ies" : "y"} no figure ` +
              `(${blocked.map((s) => s.heading).join(", ")}). ` +
              `Do not fill that in from the dashboard: the dashboard shows the ` +
              `same incomplete number and it looks entirely normal. Call ` +
              `explain_data_issue to give the person one sentence they can use, ` +
              `then either publish without those sections or wait for the next ` +
              `pipeline run.\n\n`
            : "") +
          (degraded.length > 0
            ? `${degraded.length} section${degraded.length === 1 ? " is" : "s are"} ` +
              `DEGRADED. Those keep their figure and carry the gap in the same ` +
              `sentence. Do not strip that sentence when you summarise, because ` +
              `it is the only thing separating the number from a wrong one.\n\n`
            : "") +
          `Call build_deck to lay this out as slides.`,
      );
    },
  };
}

/**
 * Write the drafted sections onto the page.
 *
 * setReportSections also opens the report and switches the view, so one call
 * both commits the sections and brings them on screen. The tool does not render
 * anything itself; it hands the store the same shape the report component
 * reads, and the page does the rest.
 */
function commit(sections: DraftedSection[]): void {
  setReportSections(sections);
}

function buildDeck(): ToolSpec {
  return {
    name: "build_deck",
    title: "Lay the report out as slides",
    description:
      "Lay the report that is on the page out as a slide outline: a title " +
      "slide, one slide per drafted section, and a closing slide naming " +
      "everything that could not be published. Reads the sections draft_report " +
      "committed, so the deck and the page cannot disagree. Blocked sections " +
      "become a slide that says so rather than quietly disappearing, because a " +
      "section that vanishes is a section nobody asks about. Call draft_report " +
      "first.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Deck title. Defaults to the metric and the period.",
        },
      },
      required: [],
    },
    // Left false deliberately, and this is the one arguable case in the set.
    // Now that it reads the committed sections out of the store it mutates
    // nothing, so by the letter of the definition it qualifies as read only.
    // It still produces an artifact the person then acts on and hands around,
    // and a client that auto-approved that without a human in the loop is not
    // what anyone wants. Do not "fix" this to true.
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (args) => {
      const state = getState();
      const sections = state.reportSections;

      if (sections.length === 0) {
        return text(
          `There is nothing on the page to lay out. The report has no drafted ` +
            `sections, so a deck built now would be this tool's own guess ` +
            `about what the report should say, which is exactly the failure ` +
            `this page exists to prevent. Call draft_report first, then call ` +
            `build_deck again.`,
        );
      }

      const title =
        asText(args.title) ?? `${state.metricId}, ${state.period}`;
      const publishable = sections.filter((s) => s.verdict !== "blocked");
      const held = sections.filter((s) => s.verdict === "blocked");

      const slides = [
        `1. ${title}  ·  Kestrel Supply Co.`,
        ...publishable.map(
          (s, i) =>
            `${i + 2}. ${s.heading}` +
            (s.verdict === "degraded" ? "  [carries a stated gap]" : ""),
        ),
        `${publishable.length + 2}. Not published: ` +
          (held.length > 0
            ? held.map((s) => s.heading).join(", ")
            : "nothing was held back"),
      ];

      return text(
        `Deck outline, ${slides.length} slides, built from the ` +
          `${sections.length} sections currently on the page.\n\n` +
          `${slides.join("\n")}\n\n` +
          `The closing slide is deliberate. A blocked section that is silently ` +
          `dropped becomes a gap nobody notices; a slide that names it is a ` +
          `question someone can ask.\n\n` +
          `The degraded sections keep their figure and carry their gap ` +
          `sentence into the slide body. Do not strip it when you narrate the ` +
          `deck.\n\n` +
          `This returns the outline rather than a .pptx file. Rendering a real ` +
          `file needs PptxGenJS, which is not installed, and a download, which ` +
          `the in-app browser blocks. See docs/PLAN.md section 9: build_deck is ` +
          `rank 12 and the fallback was always to render in the page.`,
      );
    },
  };
}

/** Registered once a session exists. */
export function reportEntryTools(): ToolSpec[] {
  return [startReport()];
}

/** Registered once the report is open. */
export function reportTools(): ToolSpec[] {
  return [draftReport(), buildDeck()];
}
