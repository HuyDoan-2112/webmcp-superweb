import { ArrowLeft, ChevronRight, PackageSearch } from "lucide-react";
import type { Product } from "@shared/types";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import {
  selectProduct,
  setCatalogBrand,
  setCatalogCategory,
  setCatalogSubcategory,
  type Locale,
} from "@/store";
import { formatPrice, formatPriceRange, formatWeight } from "./format";
import { describeProduct } from "./description";
import { t } from "./i18n";
import { AvailabilityTag, ColorChip, FamilyCard, SwatchRow } from "./product-card";
import { ProductImage } from "./product-image";
import { availabilityOf } from "./format";
import { fetchProduct } from "@/api";
import { useAsync } from "@/hooks/use-async";

/**
 * One product, reached by store state rather than a route. `selectProduct(key)`
 * opens it, `selectProduct(null)` goes back, so the agent and the visitor use
 * the same door. Every link on this page is one of those setters, including the
 * colour swatches: picking another colourway is `selectProduct` with that
 * variant's key, which is why the page and the agent cannot disagree about
 * which colour is on screen.
 */
export function ProductDetail() {
  const locale = useStore((s) => s.locale);
  const productKey = useStore((s) => s.selectedProductKey);

  // The endpoint returns the variant, its whole family and its neighbours
  // together, so opening a line is one round trip rather than three.
  const { data, loading } = useAsync(
    () =>
      productKey === null ? Promise.resolve(null) : fetchProduct(productKey),
    [productKey],
  );

  const product = data?.product;
  const family = data?.family ?? null;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="bg-muted aspect-[4/3] w-full animate-pulse rounded-lg" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="bg-muted h-5 w-full animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <Empty>
          <EmptyMedia>
            <PackageSearch />
          </EmptyMedia>
          <EmptyTitle>{t(locale, "notFoundTitle")}</EmptyTitle>
          <EmptyDescription>
            {t(locale, "notFoundBody", { code: String(productKey) })}
          </EmptyDescription>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectProduct(null)}
            >
              {t(locale, "backToCatalogue")}
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const variants = family?.variants ?? [product];
  const index = Math.max(
    0,
    variants.findIndex((v) => v.productKey === product.productKey),
  );

  const specs: { label: string; value: string }[] = [
    { label: t(locale, "productCode"), value: product.productCode },
    { label: t(locale, "brand"), value: product.brand },
    { label: t(locale, "manufacturer"), value: product.manufacturer },
    { label: t(locale, "category"), value: product.categoryName },
    { label: t(locale, "subcategory"), value: product.subCategoryName },
    { label: t(locale, "colour"), value: product.color },
    {
      label: t(locale, "weight"),
      value: formatWeight(product.weight, product.weightUnit, locale),
    },
  ];

  const related = data?.related ?? [];
  const ranged = family !== null && family.priceMin !== family.priceMax;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumb product={product} locale={locale} />

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductImage
            name={family?.familyName ?? product.productName}
            categoryName={product.categoryName}
            color={product.color}
            productCode={product.productCode}
            size="detail"
            className="rounded-lg border"
          />
        </div>

        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance">
            {family?.familyName ?? product.productName}
          </h1>

          <button
            type="button"
            onClick={() => {
              setCatalogBrand(product.brand);
              selectProduct(null);
            }}
            className="text-muted-foreground hover:text-foreground mt-2 text-sm underline-offset-4 hover:underline"
          >
            {product.brand}
          </button>

          <p className="mt-6 font-mono text-3xl font-semibold tabular-nums">
            {formatPrice(product.price, locale)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t(locale, "priceNote")}
            {/* 27 of the 885 families are not one price across their colours.
                When this is one of them, say the whole range rather than let
                the figure above stand for colours it does not cover. */}
            {ranged && family !== null && (
              <>
                {" "}
                <span className="tabular-nums">
                  {t(locale, "colourways")}:{" "}
                  {formatPriceRange(family.priceMin, family.priceMax, locale)}
                </span>
              </>
            )}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <AvailabilityTag
              availability={availabilityOf(product)}
              locale={locale}
            />
            <ColorChip
              color={product.color}
              className="text-muted-foreground text-xs"
            />
          </div>
          {/* Contoso records no stock, so this is derived from the product key
              and says so. A page that refuses to publish an unverified revenue
              figure cannot quietly print an invented stock level. The grid card
              dropped the badge entirely, because a card has no room to carry
              this sentence with it. */}
          <p className="text-muted-foreground mt-1.5 text-xs italic">
            {t(locale, "availabilityNote")}
          </p>

          {variants.length > 1 && (
            <div className="mt-7">
              <h2 className="text-muted-foreground mb-2.5 font-mono text-[10px] tracking-[0.14em] uppercase">
                {t(locale, "colourways")}
              </h2>
              {/* Picking a colour is selectProduct on that variant's key, which
                  is the same call get_product makes. One door, not two. */}
              <SwatchRow
                variants={variants}
                selected={index}
                onSelect={(i) => selectProduct(variants[i].productKey)}
                locale={locale}
              />
            </div>
          )}

          <h2 className="text-muted-foreground mt-9 mb-2 font-mono text-[10px] tracking-[0.14em] uppercase">
            {t(locale, "about")}
          </h2>
          <div className="space-y-2 text-sm leading-relaxed">
            {describeProduct(product, family, locale).map((sentence) => (
              <p key={sentence}>{sentence}</p>
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-xs italic">
            {t(locale, "composedNote")}
          </p>

          <h2 className="text-muted-foreground mt-9 mb-2 font-mono text-[10px] tracking-[0.14em] uppercase">
            {t(locale, "specifications")}
          </h2>
          <dl className="border-t">
            {specs.map((spec) => (
              <div
                key={spec.label}
                className="grid grid-cols-[10rem_1fr] gap-4 border-b py-2.5 text-sm"
              >
                <dt className="text-muted-foreground">{spec.label}</dt>
                <dd className="font-mono tabular-nums">{spec.value}</dd>
              </div>
            ))}
          </dl>

          {variants.length > 1 && (
            <VariantTable
              variants={variants}
              current={product.productKey}
              locale={locale}
            />
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 border-b pb-3 text-lg font-semibold tracking-tight">
            {t(locale, "relatedTitle", { subcategory: product.subCategoryName })}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {related.map((f) => (
              <FamilyCard key={f.familyKey} family={f} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Every colourway, with the code and price that belong to it.
 *
 * Contoso prices all but 27 families identically across their colours, so this
 * table mostly repeats one number. It is here anyway, because the product code
 * is what a buyer orders against and it is different on every row.
 */
function VariantTable({
  variants,
  current,
  locale,
}: {
  variants: readonly Product[];
  current: number;
  locale: Locale;
}) {
  return (
    <div className="mt-9">
      <h2 className="text-muted-foreground mb-2 font-mono text-[10px] tracking-[0.14em] uppercase">
        {t(locale, "colourCount", { count: variants.length })}
      </h2>
      <table className="w-full border-t text-sm">
        <tbody>
          {variants.map((variant) => {
            const isCurrent = variant.productKey === current;
            return (
              <tr
                key={variant.productKey}
                className={cn("border-b", isCurrent && "bg-muted/60")}
              >
                <td className="py-2">
                  <button
                    type="button"
                    aria-current={isCurrent}
                    onClick={() => selectProduct(variant.productKey)}
                    className="focus-visible:ring-ring rounded underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <ColorChip color={variant.color} />
                  </button>
                </td>
                <td className="text-muted-foreground py-2 font-mono text-xs tabular-nums">
                  {variant.productCode}
                </td>
                <td className="text-muted-foreground py-2 text-end font-mono text-xs tabular-nums">
                  {formatWeight(variant.weight, variant.weightUnit, locale)}
                </td>
                <td className="py-2 text-end font-mono text-xs tabular-nums">
                  {formatPrice(variant.price, locale)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Breadcrumb({
  product,
  locale,
}: {
  product: Product;
  locale: Locale;
}) {
  return (
    <nav
      aria-label={t(locale, "backToCatalogue")}
      className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => selectProduct(null)}
        className="-ms-2 h-7 px-2"
      >
        <ArrowLeft className="size-3.5" />
        {t(locale, "backToCatalogue")}
      </Button>
      <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
      <button
        type="button"
        onClick={() => {
          setCatalogCategory(product.categoryName);
          selectProduct(null);
        }}
        className="hover:text-foreground rounded-md px-1 underline-offset-4 hover:underline"
      >
        {product.categoryName}
      </button>
      <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
      <button
        type="button"
        onClick={() => {
          setCatalogCategory(product.categoryName);
          setCatalogSubcategory(product.subCategoryName);
          selectProduct(null);
        }}
        className="hover:text-foreground rounded-md px-1 underline-offset-4 hover:underline"
      >
        {product.subCategoryName}
      </button>
    </nav>
  );
}
