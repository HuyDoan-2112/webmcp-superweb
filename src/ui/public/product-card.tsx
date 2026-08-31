import { useState } from "react";
import type { Product } from "@shared/types";
import type { ProductFamily } from "@/api";
import { cn } from "@/lib/utils";
import { selectProduct, type Locale } from "@/store";
import { formatPrice, swatchFor } from "./format";
import { t } from "./i18n";
import { ProductImage } from "./product-image";
import type { Availability } from "./format";

const DOT: Record<Availability, string> = {
  inStock: "bg-emerald-500",
  lowStock: "bg-amber-500",
  madeToOrder: "bg-muted-foreground",
};

/** Availability, said the way a trade counter says it: a dot and two words. */
export function AvailabilityTag({
  availability,
  locale,
  className,
}: {
  availability: Availability;
  locale: Locale;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", className)}>
      <span className={cn("size-1.5 rounded-full", DOT[availability])} />
      {t(locale, availability)}
    </span>
  );
}

/** A colour chip and its name, straight from the product's colour field. */
export function ColorChip({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <span
        className="size-2.5 shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/20"
        style={{ backgroundColor: swatchFor(color).fill }}
      />
      {color}
    </span>
  );
}

/**
 * A row of colourways. Selecting one changes which variant the card is about:
 * its picture, its product code, its weight and the line it opens.
 */
export function SwatchRow({
  variants,
  selected,
  onSelect,
  locale,
  className,
}: {
  variants: readonly Product[];
  selected: number;
  onSelect: (index: number) => void;
  locale: Locale;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={t(locale, "chooseColour")}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {variants.map((variant, index) => (
        <button
          key={variant.productKey}
          type="button"
          title={variant.color}
          aria-label={variant.color}
          aria-pressed={index === selected}
          onClick={() => onSelect(index)}
          className={cn(
            "focus-visible:ring-ring size-5 rounded-full ring-1 transition-[box-shadow,transform] focus-visible:ring-2 focus-visible:outline-none",
            index === selected
              ? "ring-foreground scale-110 ring-2"
              : "ring-black/20 hover:scale-110 dark:ring-white/25",
          )}
          style={{ backgroundColor: swatchFor(variant.color).fill }}
        />
      ))}
    </div>
  );
}

/**
 * One product in the catalogue: every colourway of one thing, on one card.
 *
 * Which swatch is chosen is local state rather than store state, because it is
 * a preview and nothing else on the page depends on it. Opening the card is the
 * store move, and it opens the variant whose swatch is showing, so the picture
 * the visitor clicked is the picture they land on.
 */
export function FamilyCard({
  family,
  locale,
}: {
  family: ProductFamily;
  locale: Locale;
}) {
  const [index, setIndex] = useState(0);
  const variant = family.variants[Math.min(index, family.variants.length - 1)];

  return (
    <div className="group bg-card hover:border-foreground/25 flex flex-col overflow-hidden rounded-lg border transition-all hover:-translate-y-0.5 hover:shadow-md">
      <button
        type="button"
        onClick={() => selectProduct(variant.productKey)}
        className="focus-visible:ring-ring flex flex-1 flex-col text-start focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none"
      >
        <span className="relative block">
          <ProductImage
            name={family.familyName}
            categoryName={family.categoryName}
            color={variant.color}
            productCode={variant.productCode}
          />
          <span className="bg-background/85 text-foreground absolute start-3 top-3 rounded-md px-1.5 py-0.5 font-mono text-[10px] tracking-[0.16em] tabular-nums backdrop-blur-sm">
            {variant.productCode}
          </span>
          {family.variants.length > 1 && (
            <span className="bg-background/85 text-muted-foreground absolute end-3 top-3 rounded-md px-1.5 py-0.5 font-mono text-[10px] tabular-nums backdrop-blur-sm">
              {t(locale, "colourCount", { count: family.variants.length })}
            </span>
          )}
        </span>

        <span className="flex flex-1 flex-col gap-1 border-t p-4">
          <span className="text-muted-foreground font-mono text-[10px] tracking-[0.12em] uppercase">
            {family.categoryName} / {family.subCategoryName}
          </span>
          <span className="line-clamp-2 text-sm leading-snug font-medium">
            {family.familyName}
          </span>
          <span className="text-muted-foreground text-xs">{family.brand}</span>

          {/* The price is the thing a buyer scans for, so it sits with the name
              rather than in a strip under the swatches. The colour sentence
              that used to be here said what the swatches below already show. */}
          <span className="mt-3 flex items-baseline justify-between gap-2">
            <span className="font-mono text-base font-semibold tabular-nums">
              {family.priceMin === family.priceMax
                ? formatPrice(family.priceMin, locale)
            : t(locale, "priceFrom", {
                    price: formatPrice(family.priceMin, locale),
                  })}
            </span>
          </span>
        </span>
      </button>

      <div className="border-t px-4 py-3">
        <SwatchRow
          variants={family.variants}
          selected={index}
          onSelect={setIndex}
          locale={locale}
        />
      </div>
    </div>
  );
}

/** Matches the card's shape while the catalogue loads. */
export function ProductCardSkeleton() {
  return (
    <div className="bg-card flex flex-col overflow-hidden rounded-lg border">
      <div className="bg-muted aspect-[4/3] animate-pulse" />
      <div className="flex flex-col gap-2 border-t p-4">
        <div className="bg-muted h-2.5 w-1/2 animate-pulse rounded" />
        <div className="bg-muted h-3.5 w-full animate-pulse rounded" />
        <div className="bg-muted h-3.5 w-4/5 animate-pulse rounded" />
        <div className="bg-muted mt-3 h-3 w-2/5 animate-pulse rounded" />
      </div>
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
        <div className="bg-muted h-5 w-24 animate-pulse rounded-full" />
        <div className="bg-muted h-4 w-16 animate-pulse rounded" />
      </div>
    </div>
  );
}
