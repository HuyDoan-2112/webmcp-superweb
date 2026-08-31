// The promotions record, readable by both lanes.
//
// It sits here rather than in src/mcp/api.ts because both the announcement
// strip and the promotions tools need it, and a UI that read it through the
// tool layer would invert the one arrow this architecture cares about: tools
// drive the UI, the UI reads its own data. The strip is Person A's and the
// tools are Person B's, so the record belongs to neither.
//
// No verdict logic here. Reading the check that governs a claim goes through
// src/mcp/api.ts, which is the only read seam, and through /api/trust behind
// it. This module knows what a promotion says, never whether it is true.

import type { Promotion } from "@shared/types";
import promotionsDoc from "../data/meta/promotions.json";
import qualityDoc from "../data/meta/quality_checks.json";

const PROMOTIONS = (promotionsDoc as unknown as { promotions: Promotion[] })
  .promotions;

/** Every promotion Kestrel has ever run, in file order. */
export function readPromotions(): Promotion[] {
  return PROMOTIONS;
}

export function findPromotion(code: string): Promotion | null {
  const wanted = code.trim().toUpperCase();
  return PROMOTIONS.find((p) => p.code.toUpperCase() === wanted) ?? null;
}

/**
 * Today as YYYY-MM-DD in the reader's own timezone.
 *
 * Local rather than UTC, because "is this promotion running today" is a
 * question about the day the person is having, not the day in Greenwich.
 */
export function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** Whether a promotion is running on a given YYYY-MM-DD day, bounds inclusive. */
export function isLive(p: Promotion, day: string = today()): boolean {
  return p.validFrom <= day && day <= p.validTo;
}

/** Whether its window closed before that day. */
export function hasEnded(p: Promotion, day: string = today()): boolean {
  return p.validTo < day;
}

// ---------------------------------------------------------------- locations

/**
 * The countries Kestrel has stores in.
 *
 * Read from the pipeline's own check record rather than from /api/query,
 * and that is not an arbitrary choice. Query returns five countries, because
 * France, Germany, Italy and the Netherlands had every one of their rows
 * rejected at the FX join and so have no gold revenue at all. Those stores
 * exist; their revenue does not. A location picker built on revenue would
 * make the blocked countries unpickable, which is precisely backwards: they
 * are the ones worth looking at.
 */
const STORE_COUNTRIES: string[] = [
  ...new Set(
    (qualityDoc as unknown as QualityDoc).checks
      .filter((c) => c.dimension === "country" && c.value !== null)
      .map((c) => c.value as string),
  ),
].sort();

type QualityDoc = {
  checks: { dimension: string | null; value: string | null }[];
};

export function readStoreCountries(): readonly string[] {
  return STORE_COUNTRIES;
}

/**
 * Does this promotion apply to someone shopping from `country`?
 *
 * A promotion scoped to a country is for that country. One scoped to a channel
 * or a category is not about geography at all and applies everywhere. Passing
 * null means "show me everything", which is the default: hiding an offer by
 * default would make check_promotion answerable about something not on screen.
 */
export function appliesIn(promotion: Promotion, country: string | null): boolean {
  if (country === null) return true;
  const { dimension, value } = promotion.claim.slice;
  if (dimension !== "country" || value === null) return true;
  return value === country;
}
