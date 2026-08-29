// Product description, COMPOSED FROM THE CATALOGUE RECORD. NOT SOURCED COPY.
//
// Read this before you touch anything in here.
//
// Contoso ships no description text at all. Every sentence this file produces is
// assembled from fields that exist on the row: brand, manufacturer, category,
// subcategory, colour, weight, price, product code, and the colours the rest of
// the family comes in. Nothing is invented, nothing is inferred, and no sentence
// is ever presented as the manufacturer's own words. The detail page prints the
// note next to it saying so, in whichever of the five languages is showing.
//
// A sentence assembled from true fields is honest. An invented one is not. If
// you are about to add an adjective that is not in the data, stop.
//
// The sentence templates live in i18n.ts with the rest of the interface text,
// one whole sentence per language, because word order is not the same in five
// languages and a sentence glued together from translated fragments is not a
// sentence in any of them.

import type { Product } from "@shared/types";
import type { ProductFamily } from "@/api";
import type { Locale } from "@/store";
import { formatPrice, formatWeight, titleCase } from "./format";
import { LOCALE_TAGS, t } from "./i18n";

/**
 * "Black, Blue and Red", in the reader's language.
 *
 * The colour names are the data's; only their capitalisation is ours. Three
 * rows record "blue" where six hundred record "Black", and a lower case colour
 * mid sentence reads as a typo rather than as a record.
 */
function listColours(colors: readonly string[], locale: Locale): string {
  const formatter = new Intl.ListFormat(LOCALE_TAGS[locale], {
    style: "long",
    type: "conjunction",
  });
  return formatter.format(colors.map(titleCase));
}

/**
 * One sentence naming the colours a product comes in, or saying there is only
 * the one. Short enough for a card, true enough for the detail page.
 */
export function colourSentence(
  colors: readonly string[],
  locale: Locale,
): string {
  if (colors.length <= 1) {
    return t(locale, "composedOneColour", {
      colour: titleCase(colors[0] ?? ""),
    });
  }
  return t(locale, "composedColours", {
    count: colors.length,
    colours: listColours(colors, locale),
  });
}

/**
 * The description of one variant, as a list of sentences.
 *
 * Every slot below is a column of dim_product. The caller renders them as
 * paragraphs and prints `composedNote` underneath.
 */
export function describeProduct(
  product: Product,
  family: ProductFamily | null,
  locale: Locale,
): string[] {
  // Half the brands are their own manufacturer in this data, and "from
  // Adventure Works, made by Adventure Works" reads as a fault in the page
  // rather than as a fact about the product. Same fields, one clause fewer.
  const sameMaker = product.brand === product.manufacturer;

  return [
    t(locale, sameMaker ? "composedOneSameMaker" : "composedOne", {
      // The family name, so the first sentence is about the product and the
      // second is about the colourway. product.productName is the family name
      // with the colour appended, which would say the colour twice.
      name: family?.familyName ?? product.productName,
      subcategory: product.subCategoryName,
      brand: product.brand,
      manufacturer: product.manufacturer,
      category: product.categoryName,
    }),
    t(locale, "composedTwo", {
      colour: product.color,
      weight: formatWeight(product.weight, product.weightUnit, locale),
      code: product.productCode,
      price: formatPrice(product.price, locale),
    }),
    colourSentence(family?.colors ?? [product.color], locale),
  ];
}
