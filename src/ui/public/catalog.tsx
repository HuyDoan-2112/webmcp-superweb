import { useEffect, useSyncExternalStore } from "react";
import {
  ChevronLeft,
  ChevronRight,
  SearchX,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
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
  CATALOG_PAGE_SIZE,
  clearCatalogFilters,
  setCatalogBrand,
  setCatalogCategory,
  setCatalogColor,
  setCatalogLoading,
  setCatalogPage,
  setCatalogPriceRange,
  setCatalogSubcategory,
  type CatalogFilters,
  type Locale,
} from "@/store";
import { FamilyCard, ProductCardSkeleton } from "./product-card";
import { t } from "./i18n";
import { formatPrice, swatchFor, titleCase } from "./format";
import {
  fetchProducts,
  type Facet as FacetCount,
  type PriceBand,
  type ProductFamily,
} from "@/api";
import { useAsync } from "@/hooks/use-async";

/**
 * True once the sidebar has a column of its own, at Tailwind's `lg`.
 *
 * Five facets stacked above the grid is a wall a phone has to scroll past
 * before it sees a product, so below this width they fold into one summary. The
 * query matches the layout breakpoint exactly, which is why it is written out
 * here rather than borrowed from useIsMobile and its different breakpoint.
 */
const WIDE = "(min-width: 1024px)";

function useWideLayout(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

export function Catalog() {
  const locale = useStore((s) => s.locale);
  const wide = useWideLayout();
  const query = useStore((s) => s.catalogSearch);
  const filters = useStore((s) => s.catalogFilters);
  const page = useStore((s) => s.catalogPage);

  // The server filters, counts and pages. A tool that moves the store therefore
  // takes the same round trip a click takes, rather than a second code path
  // that happens to agree with it.
  const { data, error, loading } = useAsync(
    () =>
      fetchProducts({
        search: query,
        category: filters.category,
        brand: filters.brand,
        subcategory: filters.subcategory,
        color: filters.color,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        offset: (page - 1) * CATALOG_PAGE_SIZE,
        limit: CATALOG_PAGE_SIZE,
      }),
    [
      query,
      filters.category,
      filters.brand,
      filters.subcategory,
      filters.color,
      filters.minPrice,
      filters.maxPrice,
      page,
    ],
  );

  useEffect(() => {
    setCatalogLoading(loading);
  }, [loading]);

  const families: ProductFamily[] = data?.families ?? [];
  const categories = data?.facets.categories ?? [];
  const brands = data?.facets.brands ?? [];
  const subcategories = data?.facets.subcategories ?? [];
  const colors = data?.facets.colors ?? [];
  const priceBands = data?.facets.priceBands ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));

  // An agent can set any page number, and a filter can shrink the result under
  // the page someone is already on. Either way, land them on the last real page
  // rather than on an empty grid that reads as "nothing matched".
  useEffect(() => {
    if (data && page > pages) setCatalogPage(pages);
  }, [data, page, pages]);

  const isFiltered =
    query.trim() !== "" ||
    filters.category !== null ||
    filters.brand !== null ||
    filters.subcategory !== null ||
    filters.color !== null ||
    filters.minPrice !== null ||
    filters.maxPrice !== null;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[13rem_1fr] lg:gap-10">
      {/* min-w-0 on both columns, or the tab strip's own width sets the width
          of the grid track and the whole page scrolls sideways instead of the
          strip scrolling inside itself. */}
      <aside className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100svh-8rem)] lg:self-start lg:overflow-y-auto">
        {/* Below lg the five facets fold into one summary, so a phone is not
            asked to scroll a wall of them before it reaches a product. `open`
            follows the same breakpoint the layout uses. */}
        <details
          open={wide}
          className="rounded-lg border p-3 lg:border-0 lg:p-0"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium lg:hidden [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="size-4" />
            {t(locale, "filters")}
          </summary>

          <div className="mt-4 lg:mt-0">
            <Facet
              label={t(locale, "category")}
              options={categories}
              active={filters.category}
              onSelect={setCatalogCategory}
            />
            {/* Only the subcategories under the chosen category are worth
                offering, and with no category chosen there are forty of them.
                The counts are already scoped, so this is about the length of
                the list. */}
            {filters.category !== null && subcategories.length > 1 && (
              <Facet
                label={t(locale, "subcategory")}
                options={subcategories}
                active={filters.subcategory}
                onSelect={setCatalogSubcategory}
                className="mt-7"
              />
            )}
            <Facet
              label={t(locale, "brand")}
              options={brands}
              active={filters.brand}
              onSelect={setCatalogBrand}
              className="mt-7"
            />
            <Facet
              label={t(locale, "colour")}
              options={colors}
              active={filters.color}
              onSelect={setCatalogColor}
              format={titleCase}
              swatch
              className="mt-7"
            />
            <PriceFacet
              bands={priceBands}
              min={filters.minPrice}
              max={filters.maxPrice}
              locale={locale}
              className="mt-7"
            />
            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCatalogFilters}
                className="mt-5 -ms-2"
              >
                {t(locale, "clearFilters")}
              </Button>
            )}
          </div>
        </details>
      </aside>

      <section className="min-w-0">
        <Tabs
          categories={categories}
          active={filters.category}
          locale={locale}
        />

        <div className="mb-5 flex items-baseline justify-between gap-4 border-b pb-3">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {filters.subcategory ?? filters.category ?? t(locale, "everything")}
          </h1>
          <p className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
            {loading
              ? t(locale, "loading")
              : t(locale, "productsShown", { shown: families.length, total })}
          </p>
        </div>

        {error !== null ? (
          <Empty>
            <EmptyMedia>
              <TriangleAlert />
            </EmptyMedia>
            <EmptyTitle>{t(locale, "errorTitle")}</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </Empty>
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : families.length === 0 ? (
          <Empty>
            <EmptyMedia>
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>{t(locale, "emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {t(locale, "emptyBody", {
                filters: describe(query, filters, locale),
              })}
            </EmptyDescription>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={clearCatalogFilters}>
                {t(locale, "clearFilters")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {families.map((family) => (
                <FamilyCard
                  key={family.familyKey}
                  family={family}
                  locale={locale}
                />
              ))}
            </div>
            <Pager page={page} pages={pages} locale={locale} />
          </>
        )}
      </section>
    </div>
  );
}

/**
 * The category tab strip.
 *
 * Drives `setCatalogCategory`, the same setter the sidebar facet and the header
 * select call, so the three controls are three views of one piece of state
 * rather than three sources of truth. "All" is that setter with null.
 */
function Tabs({
  categories,
  active,
  locale,
}: {
  categories: readonly FacetCount[];
  active: string | null;
  locale: Locale;
}) {
  const all = categories.reduce((sum, c) => sum + c.n, 0);
  const tabs: { label: string; value: string | null; n: number }[] = [
    { label: t(locale, "allTab"), value: null, n: all },
    ...categories.map((c) => ({ label: c.label, value: c.label, n: c.n })),
  ];

  return (
    <div
      role="tablist"
      aria-label={t(locale, "category")}
      className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setCatalogCategory(tab.value)}
            className={cn(
              "focus-visible:ring-ring flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none",
              isActive
                ? "border-foreground bg-primary text-primary-foreground"
                : "hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {tab.label}
            <span className="font-mono text-[11px] tabular-nums opacity-60">
              {tab.n}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Previous, next, and where you are. The page itself is store state. */
function Pager({
  page,
  pages,
  locale,
}: {
  page: number;
  pages: number;
  locale: Locale;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-between gap-4 border-t pt-5">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => setCatalogPage(page - 1)}
      >
        <ChevronLeft className="size-4" />
        {t(locale, "previousPage")}
      </Button>
      <p className="text-muted-foreground font-mono text-xs tabular-nums">
        {t(locale, "pageOf", { page, pages })}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => setCatalogPage(page + 1)}
      >
        {t(locale, "nextPage")}
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}

/**
 * Name what is currently narrowing the view. The parts are joined plainly
 * rather than assembled into a sentence, because the sentence around them is a
 * whole translated string and word order is not the same in five languages.
 */
function describe(
  query: string,
  filters: CatalogFilters,
  locale: Locale,
): string {
  const parts: string[] = [];
  if (query.trim() !== "") parts.push(`"${query.trim()}"`);
  if (filters.category !== null) parts.push(filters.category);
  if (filters.subcategory !== null) parts.push(filters.subcategory);
  if (filters.brand !== null) parts.push(filters.brand);
  if (filters.color !== null) parts.push(titleCase(filters.color));
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    parts.push(bandLabel(filters.minPrice, filters.maxPrice, locale));
  }
  return parts.length === 0 ? t(locale, "currentView") : parts.join(" + ");
}

/** A price band said in the reader's language, with the price in their format. */
function bandLabel(
  min: number | null,
  max: number | null,
  locale: Locale,
): string {
  if (min === null && max === null) return t(locale, "anyPrice");
  if (min === null) {
    return t(locale, "priceUnder", { max: formatPrice(max as number, locale) });
  }
  if (max === null) {
    return t(locale, "priceOver", { min: formatPrice(min, locale) });
  }
  return t(locale, "priceBetween", {
    min: formatPrice(min, locale),
    max: formatPrice(max, locale),
  });
}

/** The price bands the server counted. The boundaries are its, not ours. */
function PriceFacet({
  bands,
  min,
  max,
  locale,
  className,
}: {
  bands: readonly PriceBand[];
  min: number | null;
  max: number | null;
  locale: Locale;
  className?: string;
}) {
  if (bands.length === 0) return null;
  return (
    <div className={className}>
      <p className="text-muted-foreground mb-2.5 font-mono text-[10px] tracking-[0.14em] uppercase">
        {t(locale, "price")}
      </p>
      <div className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-0.5">
        {bands.map((band) => {
          const isActive = band.min === min && band.max === max;
          return (
            <button
              key={`${band.min}-${band.max}`}
              type="button"
              aria-pressed={isActive}
              disabled={band.n === 0 && !isActive}
              onClick={() =>
                isActive
                  ? setCatalogPriceRange(null, null)
                  : setCatalogPriceRange(band.min, band.max)
              }
              className={cn(
                "focus-visible:ring-ring flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground",
                band.n === 0 && !isActive && "opacity-40",
              )}
            >
              <span className="min-w-0 flex-1 truncate">
                {bandLabel(band.min, band.max, locale)}
              </span>
              <span className="font-mono text-[11px] tabular-nums opacity-60">
                {band.n}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Facet({
  label,
  options,
  active,
  onSelect,
  format,
  swatch,
  className,
}: {
  label: string;
  options: readonly FacetCount[];
  active: string | null;
  onSelect: (value: string | null) => void;
  /** Presentation only. The value handed to the setter is the server's. */
  format?: (value: string) => string;
  swatch?: boolean;
  className?: string;
}) {
  if (options.length === 0) return null;
  return (
    <div className={className}>
      <p className="text-muted-foreground mb-2.5 font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-0.5">
        {options.map(({ label: option, n }) => {
          const isActive = active === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isActive}
              disabled={n === 0 && !isActive}
              onClick={() => onSelect(isActive ? null : option)}
              className={cn(
                "focus-visible:ring-ring flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground",
                n === 0 && !isActive && "opacity-40",
              )}
            >
              {swatch && (
                <span
                  className="size-2.5 shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/20"
                  style={{ backgroundColor: swatchFor(option).fill }}
                />
              )}
              <span className="min-w-0 flex-1 truncate">
                {format ? format(option) : option}
              </span>
              <span className="font-mono text-[11px] tabular-nums opacity-60">
                {n}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
