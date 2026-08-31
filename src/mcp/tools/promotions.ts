// The promotions tools: list_promotions, check_promotion,
// plan_promotion_reminder.
//
// Registered for everyone, on the public surface, alongside the catalogue
// tools. No new group and no gate: a gate on "a promotion exists" would be
// theatre, because promotions are a committed file and are always there.
//
// THE PROMOTION IS SYNTHETIC. THE VERDICT UNDER IT IS REAL.
//
// A claim binds to one slice of one metric, and check_promotion reads the same
// verdict the internal dashboard reads for that slice. That join is the whole
// feature: marketing copy is a number pasted somewhere nobody checked, and this
// is the check.
//
// check_data_trust is deliberately NOT registered here. It hands back
// fx_rate_not_null, run ids and row counts, which is the internal register for
// an audience api/_lib/session.ts answers at a different depth. These tools
// print the plain-language sentence the server gave them and compose no jargon
// of their own.
//
// untrustedContentHint is false on all three, which inverts catalog.ts. Product
// and brand copy is a supplier's; promotion copy is ours.

import { selectPromotion } from "@/store";
import { readClaimOutcome } from "../api";
import {
  findPromotion,
  hasEnded,
  isLive,
  readPromotions,
  today,
} from "@/promotions";
import { text, type ToolSpec } from "../adapter";
import type { Promotion } from "@shared/types";

function asDay(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : today();
}

function runsFor(p: Promotion): string {
  return `${p.validFrom} to ${p.validTo}`;
}

// ---------------------------------------------------------- list_promotions

function listPromotions(): ToolSpec {
  return {
    name: "list_promotions",
    title: "List the promotions running",
    description:
      "List the promotions Kestrel Supply Co. is running on a given day, with " +
      "the headline, the code and the window each one runs for. Takes a date " +
      "rather than being named after one, so today, next week and last " +
      "November are all this one tool. Every promotion carries a claim about " +
      "the business, and none of the claims listed here has been checked.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description:
            "Day to ask about, as YYYY-MM-DD. Defaults to today. A promotion " +
            "whose window covers this day is reported as running.",
        },
      },
      required: [],
    },
    // Read only, verified by inspection: it calls no store setter and moves
    // nothing on the page.
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async (args) => {
      const day = asDay(args.date);
      const all = readPromotions();
      const running = all.filter((p) => isLive(p, day));
      const upcoming = all.filter((p) => p.validFrom > day);

      // RECHECK_AFTER is a fact about the data, not an instruction to the
      // agent. The page never tells an agent what to do: a site that writes
      // imperatives into content an agent reads has built prompt injection and
      // called it a feature. What the site can honestly publish is when its own
      // answer stops being current, and the agent or the person decides whether
      // that is worth a scheduled look. That is also why it lives in a tool
      // return rather than in the strip's copy.
      const line = (p: Promotion) =>
        `${p.code}  ${p.headline}\n` +
        `  runs           ${runsFor(p)}\n` +
        `  claims         ${p.claim.assertion}\n` +
        `  checked        no\n` +
        `  recheck_after  ${p.validTo}`;

      const body =
        running.length > 0
          ? `${running.length} promotion${running.length === 1 ? "" : "s"} ` +
            `running on ${day}:\n\n${running.map(line).join("\n\n")}`
          : `Nothing is running on ${day}.`;

      const later =
        upcoming.length > 0
          ? `\n\nNot started yet:\n\n${upcoming.map(line).join("\n\n")}`
          : "";

      return text(
        `${body}${later}\n\n` +
          `Every "claims" line above is an assertion about our own numbers, ` +
          `and not one of them has been checked. Call check_promotion with a ` +
          `code before you repeat any of them: some of these figures were ` +
          `never fully counted, and a claim built on one of those reads ` +
          `entirely ordinary.\n\n` +
          `Each "recheck_after" is the day that promotion's window closes and ` +
          `this answer stops being current. This page has no mailing list and ` +
          `wants no address: asking again on that date is the whole ` +
          `subscription, and whether to do that is yours and the person's to ` +
          `decide, not something this site should be telling you.`,
      );
    },
  };
}

// ---------------------------------------------------------- check_promotion

function checkPromotion(codes: string[]): ToolSpec {
  return {
    name: "check_promotion",
    title: "Check the claim behind a promotion",
    description:
      "Open one promotion on the page and check the number its claim rests " +
      "on against the pipeline that produced it. Answers whether the claim " +
      "can be repeated as it stands, repeated only with the gap attached, " +
      "not repeated at all, or was never checked by anybody. Call this " +
      "before quoting a promotion's claim to anyone.",
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          enum: codes,
          description: "Promotion code, from list_promotions.",
        },
      },
      required: ["code"],
    },
    // Not read only: it opens the promotion on the strip, and the page is the
    // environment the hint asks about.
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (args) => {
      const code = typeof args.code === "string" ? args.code : "";
      const promotion = findPromotion(code);
      if (!promotion) {
        return text(
          `"${code}" is not a promotion. Call list_promotions for the ` +
            `${readPromotions().length} that exist.`,
        );
      }

      // Drive the UI first, the same call the visitor's click makes.
      selectPromotion(promotion.code);

      const { outcome, check } = await readClaimOutcome(promotion);
      const claim = promotion.claim;
      const slice = claim.slice.dimension
        ? `${claim.slice.metric} for ${claim.slice.period} where ` +
          `${claim.slice.dimension} = ${claim.slice.value}`
        : `${claim.slice.metric} for ${claim.slice.period}`;

      const head =
        `${promotion.code} is open on the page. It claims: ` +
        `"${claim.assertion}"\n\nThat rests on ${slice}.\n\n`;

      if (outcome === "unchecked") {
        return text(
          `${head}NOBODY CHECKED THIS. The pipeline never evaluated that ` +
            `slice, which is not the same as evaluating it and finding it ` +
            `sound. Do not read silence as approval.\n\n` +
            `Say plainly that the claim is unverified rather than repeating ` +
            `it. Other promotions do have verdicts behind them: list_promotions ` +
            `and check_promotion will tell you which.`,
        );
      }

      const sentence = check.value?.plainLanguage ?? "";
      const advice =
        outcome === "ok"
          ? `This claim stands. It can be repeated exactly as the copy words it.`
          : outcome === "degraded"
            ? `This claim can be repeated only with the gap attached, in the ` +
              `same breath and not in a footnote. It is the more dangerous ` +
              `state: a figure nobody can publish gets caught, and this one ` +
              `reads as entirely ordinary.`
            : `Do not repeat this figure. It is not low, it is incomplete, ` +
              `and the copy above presents it as a record. Talk about the ` +
              `products instead: search_products and get_product both work ` +
              `without it.`;

      const later = isLive(promotion, today())
        ? ""
        : `\n\nThis promotion has not started yet. It runs ${runsFor(promotion)}. ` +
          `Call plan_promotion_reminder for a window shaped for a scheduler.`;

      return text(
        `${head}${outcome.toUpperCase()}: ${sentence} ` +
          `Read from the ${check.source}.\n\n${advice}${later}`,
      );
    },
  };
}

// -------------------------------------------------- plan_promotion_reminder

function planPromotionReminder(codes: string[]): ToolSpec {
  return {
    name: "plan_promotion_reminder",
    title: "Get a promotion's window for your scheduler",
    description:
      "Hand back the window a promotion runs in, shaped for a scheduler: a " +
      "plain-language cadence, an absolute start with its time zone, and an " +
      "RRULE. This page schedules nothing itself. If you can set a reminder " +
      "or a recurring task, this is the window to set it against.",
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          enum: codes,
          description: "Promotion code, from list_promotions.",
        },
      },
      required: ["code"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async (args) => {
      const code = typeof args.code === "string" ? args.code : "";
      const promotion = findPromotion(code);
      if (!promotion) {
        return text(
          `"${code}" is not a promotion. Call list_promotions for the real list.`,
        );
      }

      // A window that has closed is not a window. Answering with a cadence
      // anyway would hand the agent something to schedule against a promotion
      // that is over.
      if (hasEnded(promotion)) {
        return text(
          `${promotion.code} has already finished. It ran ` +
            `${runsFor(promotion)}, so there is no window left to schedule ` +
            `against.\n\nCall list_promotions for what is running now.`,
        );
      }

      // The reminder outlives the conversation, so the claim's state has to
      // travel with it. A scheduled nudge that repeats an unchecked figure on
      // a day when nobody remembers this exchange is the failure this project
      // exists to stop, moved into the future.
      const { outcome } = await readClaimOutcome(promotion);
      const claimWarning =
        outcome === "ok"
          ? ""
          : outcome === "unchecked"
            ? ` Nobody ever checked it, so whatever you schedule should not ` +
              `repeat it as fact.`
            : ` It came back ${outcome.toUpperCase()} against the pipeline, so ` +
              `a reminder that repeats it carries that problem forward.`;

      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const compact = (day: string) => day.replace(/-/g, "");
      // UNTIL must be UTC when DTSTART carries a TZID (RFC 5545 3.3.10). A
      // scheduler that rejects the rule for that is worse than no rule at all,
      // and 23:59Z on the last day is never earlier than the local end of it.
      const rrule =
        `DTSTART;TZID=${zone}:${compact(promotion.validFrom)}T090000\n` +
        `RRULE:FREQ=DAILY;UNTIL=${compact(promotion.validTo)}T235900Z`;

      return text(
        `${promotion.code} runs ${runsFor(promotion)}.\n\n` +
          `Plain language: every morning from ${promotion.validFrom} until ` +
          `${promotion.validTo}.\n` +
          `Absolute start: ${promotion.validFrom}T09:00:00 (${zone}).\n` +
          `RRULE:\n${rrule}\n\n` +
          `Nothing has been scheduled here. Setting a reminder is your own ` +
          `capability, not this page's. As things stand today a scheduled run ` +
          `cannot call these tools back, because they exist only while ` +
          `somebody has this page open, so carry the answer with you rather ` +
          `than planning to come back for it. Hourly is the finest interval ` +
          `worth asking for.\n\n` +
          `The claim behind this promotion is ` +
          `"${promotion.claim.assertion}".${claimWarning}`,
      );
    },
  };
}

/**
 * Built at registration time, so the code enum carries the promotions that
 * exist rather than free text an agent can typo. Same reason publicTools()
 * probes the catalogue for its facet enums before it registers anything.
 */
export function promotionTools(): ToolSpec[] {
  const codes = readPromotions().map((p) => p.code);
  return [listPromotions(), checkPromotion(codes), planPromotionReminder(codes)];
}
