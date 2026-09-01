// get_preview_recipe.
//
// Registered only while a product Kestrel has written about is open on the
// public catalogue. Leave the product and it unregisters, which is the point:
// an agent should see the actions that make sense for what is on the screen
// right now, not a drawer of everything the site can ever do.
//
// The profiles are Kestrel's own words, never measurements. See
// src/mcp/profiles.ts for why that distinction is load bearing: the catalogue
// has no sensor size, no aperture, no wattage and no decibel figure, so a tool
// returning any of those would be inventing them. Every response carries the
// limitations block, and the word "recipe" is deliberate. It is not a
// specification and not a promise about what the hardware will do.
//
// The looks are the shop's styling menu, and a treatment is applied to a
// photograph the person already has. Nothing here claims the camera produces
// the look, and the response says so in the same breath as it hands the recipe
// over.

import { getState } from "@/store";
import { readProduct } from "../api";
import { text, type ToolSpec } from "../adapter";
import { textWithData } from "../structured";
import { LIMITATIONS, PROFILE_VERSION, lookNamed, looksFor, profileFor } from "../profiles";

/**
 * Built per open product, so the look enum carries the names Kestrel actually
 * wrote for this kind of camera. An agent cannot ask for a look that does not
 * exist, which is the same reason the metric tools build their enums from
 * shared/metrics.ts rather than accepting free text.
 */
function getPreviewRecipe(lookNames: string[]): ToolSpec {
  return {
    name: "get_preview_recipe",
    title: "Kestrel's own notes on the open product",
    description:
      "Read Kestrel's authored profile for the product currently open on the " +
      "page: what this kind of thing is for, how Kestrel would describe its " +
      "character, and what to think about before buying. For a camera the " +
      "profile also carries a menu of named looks written in the vocabulary a " +
      "photo editor uses, so one can be handed to an image model to restyle a " +
      "photograph the person supplies. It is the shop's opinion, not a " +
      "manufacturer specification, and it carries no measured figures because " +
      "the catalogue records none.",
    inputSchema: {
      type: "object",
      properties: {
        look: {
          type: "string",
          ...(lookNames.length > 0 ? { enum: lookNames } : {}),
          description:
            "Optional. Ask for one named look and the full treatment comes " +
            "back, ready to apply to a photograph the person gives you. Leave " +
            "it out to see the menu first.",
        },
      },
      required: [],
      additionalProperties: false,
    },
    // Read only, and it means it. This reads the open product and the authored
    // profile and calls no store setter, so the page does not move.
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async (args) => {
      const productKey = getState().selectedProductKey;
      if (productKey === null) {
        return text(
          "No product is open, so there is no profile to read. Call " +
            "get_product with a code or a name first; this tool only " +
            "describes what the person is actually looking at.",
        );
      }

      const detail = await readProduct(productKey);
      if (!detail) {
        return text(
          "The catalogue did not answer, so nothing was read. Nothing is " +
            "invented here: try again rather than describing the product " +
            "from its name.",
        );
      }

      const { product, family } = detail;
      const profile = profileFor(product.subCategoryName);
      if (!profile) {
        return text(
          `Kestrel has written no profile for ${product.subCategoryName}, so ` +
            `there is nothing to read for this product. That is an absence, ` +
            `not a neutral rating. Describe it from the catalogue fields on ` +
            `the page instead, and say plainly that the shop has no notes.`,
        );
      }

      const looks = looksFor(product.subCategoryName);
      const openProduct = {
        productKey: product.productKey,
        productCode: product.productCode,
        name: family.familyName,
        colour: product.color,
        category: product.categoryName,
        subCategory: product.subCategoryName,
      };

      // A look was asked for. Hand back that one treatment, in full.
      if (typeof args.look === "string" && args.look.trim() !== "") {
        const look = lookNamed(product.subCategoryName, args.look);
        if (!look) {
          return text(
            `Kestrel has not written a look called "${args.look}", so nothing ` +
              `was returned. Do not improvise one. The looks for ` +
              `${product.subCategoryName} are: ` +
              // Quoted, not comma-joined. Several look names contain a comma
              // themselves, so a bare join reads as twice as many looks.
              `${looks.map((l) => `"${l.name}"`).join(", ")}.`,
          );
        }
        const treatment = Object.entries(look.treatment)
          .map(([k, v]) => `  ${k.padEnd(18)} ${v}`)
          .join("\n");
        return textWithData(
          `"${look.name}", one of Kestrel's looks.\n\n` +
            `When Kestrel reaches for it\n  ${look.whenToUse}\n\n` +
            `Treatment\n${treatment}\n\n` +
            `This is a styling suggestion from the shop, applied afterwards ` +
            `to a photograph the person already has. It is not what ` +
            `${family.familyName} does and it is not a camera setting. Change ` +
            `only the qualities named above, keep the person and the scene as ` +
            `they are, and tell them it is an illustration of a look rather ` +
            `than a preview of the hardware.`,
          {
            tool: "get_preview_recipe",
            product: openProduct,
            look: {
              version: PROFILE_VERSION,
              basis: "Kestrel-authored styling suggestion",
              name: look.name,
              whenToUse: look.whenToUse,
              ...look.treatment,
            },
            measured: false,
            appliesTo: "a photograph the person supplies, edited afterwards",
            limitations: [...LIMITATIONS],
          },
        );
      }

      // No look asked for. Describe the product and show the menu.
      const traits = Object.entries(profile.character)
        .map(([k, v]) => `  ${k.padEnd(18)} ${v}`)
        .join("\n");
      const menu =
        looks.length === 0
          ? ""
          : `Looks Kestrel offers\n` +
            looks.map((l) => `  ${l.name}: ${l.whenToUse}`).join("\n") +
            `\n\nCall this tool again with one of those names to get the full ` +
            `treatment, then apply it to a photograph the person gives you.\n\n`;

      return textWithData(
        `Kestrel's profile for ${family.familyName}, ${product.color}.\n\n` +
          `What it is for\n  ${profile.useFor}\n\n` +
          `Character\n${traits}\n\n` +
          `Worth knowing\n  ${profile.watchFor}\n\n` +
          menu +
          `This is Kestrel's own description of ${product.subCategoryName}, ` +
          `written by the shop. It is not a manufacturer specification and ` +
          `nothing in it was measured: the catalogue records price, colour, ` +
          `weight, brand and category and nothing else.`,
        {
          tool: "get_preview_recipe",
          product: openProduct,
          profile: {
            version: PROFILE_VERSION,
            basis: "Kestrel-authored illustrative profile",
            useFor: profile.useFor,
            ...profile.character,
            watchFor: profile.watchFor,
          },
          looks: looks.map((l) => ({ name: l.name, whenToUse: l.whenToUse })),
          measured: false,
          limitations: [...LIMITATIONS],
        },
      );
    },
  };
}

/**
 * Registered while a product is open on the catalogue.
 *
 * Returns nothing when the open product's subcategory has no authored profile,
 * so the tool is present for a camera and absent for a product Kestrel has not
 * written about. An agent seeing the tool can rely on it answering.
 */
export async function previewTools(): Promise<ToolSpec[]> {
  const productKey = getState().selectedProductKey;
  if (productKey === null) return [];
  const detail = await readProduct(productKey);
  if (!detail) return [];
  const sub = detail.product.subCategoryName;
  if (!profileFor(sub)) return [];
  return [getPreviewRecipe(looksFor(sub).map((l) => l.name))];
}
