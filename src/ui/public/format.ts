// Number formatting and the colour lookup behind every product swatch.
//
// Prices are USD in every language. Only the presentation moves with the
// locale, which is what Intl.NumberFormat is for: $1,620.00 in English,
// 1.620,00 $ in German, ￥ never, because the price is genuinely in dollars.

import type { Product } from "@shared/types";
import type { Locale } from "@/store";
import { LOCALE_TAGS } from "./i18n";

// Intl formatters are expensive to construct, so build one per locale and keep it.
const priceFormatters = new Map<Locale, Intl.NumberFormat>();
const numberFormatters = new Map<Locale, Intl.NumberFormat>();

function priceFormatter(locale: Locale): Intl.NumberFormat {
  let formatter = priceFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE_TAGS[locale], {
      style: "currency",
      currency: "USD",
    });
    priceFormatters.set(locale, formatter);
  }
  return formatter;
}

function numberFormatter(locale: Locale): Intl.NumberFormat {
  let formatter = numberFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE_TAGS[locale], {
      maximumFractionDigits: 2,
    });
    numberFormatters.set(locale, formatter);
  }
  return formatter;
}

export function formatPrice(price: number, locale: Locale): string {
  return priceFormatter(locale).format(price);
}

// lb, oz and g are the symbols a trade catalogue prints in every market, so the
// unit stays put and only the number is localised.
const UNIT_SYMBOL: Record<string, string> = {
  pounds: "lb",
  ounces: "oz",
  grams: "g",
};

export function formatWeight(
  weight: number,
  unit: string,
  locale: Locale,
): string {
  return `${numberFormatter(locale).format(weight)} ${UNIT_SYMBOL[unit] ?? unit}`;
}

/** A swatch: the fill for the product colour, and text that stays legible on it. */
export type Swatch = { fill: string; ink: string };

// Every colour value the Contoso product table carries, including the
// lowercase "blue" variant. Unknown values fall back to a neutral.
const SWATCHES: Record<string, Swatch> = {
  azure: { fill: "#3f7fd4", ink: "#ffffff" },
  black: { fill: "#1c1c1e", ink: "#ffffff" },
  blue: { fill: "#2f5fbe", ink: "#ffffff" },
  brown: { fill: "#6b4529", ink: "#ffffff" },
  gold: { fill: "#c9a227", ink: "#231c05" },
  green: { fill: "#2e7d4f", ink: "#ffffff" },
  grey: { fill: "#8a8a8f", ink: "#ffffff" },
  orange: { fill: "#d2691e", ink: "#ffffff" },
  pink: { fill: "#d4739a", ink: "#2a1019" },
  purple: { fill: "#6b4c9a", ink: "#ffffff" },
  red: { fill: "#b3312c", ink: "#ffffff" },
  silver: { fill: "#c4c6cb", ink: "#26282c" },
  "silver grey": { fill: "#a9adb4", ink: "#1f2226" },
  transparent: { fill: "#dfe3e8", ink: "#3a4048" },
  white: { fill: "#f3f4f6", ink: "#26282c" },
  yellow: { fill: "#d9b310", ink: "#241d02" },
};

const FALLBACK: Swatch = { fill: "#9aa0a6", ink: "#ffffff" };

export function swatchFor(color: string): Swatch {
  return SWATCHES[color.trim().toLowerCase()] ?? FALLBACK;
}

/**
 * Title case a folded colour name for display.
 *
 * The colour facet is counted on `lower(color)` because the data records the
 * same colour as both "Blue" and "blue", so the label arrives folded and is
 * capitalised here rather than in five different places. A variant's own colour
 * is never passed through this: that one is shown exactly as recorded.
 */
export function titleCase(value: string): string {
  return value.replace(/\S+/g, (word) => word[0].toUpperCase() + word.slice(1));
}

/** A price, or a range when the colourways of one product are not all one price. */
export function formatPriceRange(
  min: number,
  max: number,
  locale: Locale,
): string {
  return min === max
    ? formatPrice(min, locale)
    : `${formatPrice(min, locale)} - ${formatPrice(max, locale)}`;
}

/**
 * djb2 over a string. Pure and stable, so a product's generated artwork is the
 * same on every render, in every browser, forever.
 */
export function hashOf(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Availability, derived from the product key.
 *
 * The `Product` contract carries no stock field and shared/types.ts is frozen,
 * so this stands in until the API can report real availability. Deterministic,
 * so a product does not change status between renders.
 */
export type Availability = "inStock" | "lowStock" | "madeToOrder";

export function availabilityOf(product: Product): Availability {
  const slot = product.productKey % 7;
  if (slot === 0) return "madeToOrder";
  if (slot === 1 || slot === 4) return "lowStock";
  return "inStock";
}
