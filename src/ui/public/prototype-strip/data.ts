// PROTOTYPE. Throwaway. Not imported by anything on main.
//
// The four promotions from issue #21, one per outcome, with their verdicts read
// from the real committed artifact rather than invented. A prototype that made
// up its own verdicts would be the exact failure this project is about.

import checks from "../../../../data/meta/quality_checks.json";

export type Outcome = "ok" | "degraded" | "blocked" | "unchecked";

export type Promotion = {
  code: string;
  headline: string;
  body: string;
  validFrom: string;
  validTo: string;
  claim: {
    assertion: string;
    slice: {
      metric: string;
      period: string;
      dimension: string | null;
      value: string | null;
    };
  };
};

type CheckRow = {
  metric: string;
  period: string;
  dimension: string | null;
  value: string | null;
  verdict: Outcome;
  plainLanguage: string;
};

const ROWS = (checks as { checks: CheckRow[] }).checks;

/** Windows anchored on the demo date; one of them has not started yet. */
export const PROMOTIONS: Promotion[] = [
  {
    code: "AUTUMN-US",
    headline: "20% off across the US range",
    body: "Our strongest month on record in the United States, and we are passing it on.",
    validFrom: "2026-08-24",
    validTo: "2026-09-14",
    claim: {
      assertion: "November 2023 was our strongest month in the United States.",
      slice: { metric: "net_revenue", period: "2023-11", dimension: "country", value: "United States" },
    },
  },
  {
    code: "ONLINE-EXKL",
    headline: "Online exclusive: a quarter off everything",
    body: "Our busiest online month yet. Three days only, online orders only.",
    validFrom: "2026-08-28",
    validTo: "2026-08-31",
    claim: {
      assertion: "November 2023 was our busiest month online.",
      slice: { metric: "net_revenue", period: "2023-11", dimension: "channel", value: "Online" },
    },
  },
  {
    code: "DE-HERBST",
    headline: "Germany: our best month, repeated",
    body: "November was our biggest month in Germany. We are running it again.",
    validFrom: "2026-08-20",
    validTo: "2026-09-30",
    claim: {
      assertion: "November 2023 was our biggest month in Germany.",
      slice: { metric: "net_revenue", period: "2023-11", dimension: "country", value: "Germany" },
    },
  },
  {
    code: "CAMERA-WEEK",
    headline: "Camera week starts Monday",
    body: "Cameras and camcorders outsold every other category last November.",
    validFrom: "2026-09-07",
    validTo: "2026-09-13",
    claim: {
      assertion: "Cameras and camcorders were our top category in November 2023.",
      slice: { metric: "net_revenue", period: "2023-11", dimension: "category", value: "Cameras and camcorders" },
    },
  },
];

/** The join: a claim's slice against the checks the pipeline actually recorded. */
export function outcomeFor(p: Promotion): { outcome: Outcome; plainLanguage: string } {
  const s = p.claim.slice;
  const row = ROWS.find(
    (r) => r.metric === s.metric && r.period === s.period && r.dimension === s.dimension && r.value === s.value,
  );
  if (!row)
    return {
      outcome: "unchecked",
      plainLanguage:
        "Nobody checked this. The pipeline never evaluated this slice, which is not the same as evaluating it and finding it sound.",
    };
  return { outcome: row.verdict, plainLanguage: row.plainLanguage };
}

export function isLive(p: Promotion, today = new Date()): boolean {
  const d = today.toISOString().slice(0, 10);
  return p.validFrom <= d && d <= p.validTo;
}
