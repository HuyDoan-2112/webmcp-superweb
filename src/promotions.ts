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
