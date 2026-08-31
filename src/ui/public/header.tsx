import { useEffect, useState } from "react";
import { Bird, LogIn, Languages, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useStore } from "@/hooks/use-store";
import {
  CATALOG_PAGE_SIZE,
  setCatalogCategory,
  setCatalogSearch,
  setLocale,
  setSurface,
  selectProduct,
  type Locale,
} from "@/store";
import { text } from "@/mcp/adapter";
import {
  CATALOG_SEARCH_FIELDS,
  CATALOG_SEARCH_FORM,
  respondToToolSubmit,
} from "@/mcp/declarative";
import { fetchProducts } from "@/api";
import { LOCALES, LOCALE_NAMES, t } from "./i18n";

/**
 * The public header.
 *
 * The search field and the language switcher are both controlled by the store,
 * so a tool moving the page and a visitor using the control are the same code
 * path.
 *
 * THE SEARCH IS A REAL FORM, AND THAT IS THE POINT.
 *
 * It carries the `toolname`, `tooldescription` and `toolparamdescription`
 * attributes exported from src/mcp/declarative.ts. Chrome 152 turns a form
 * carrying those into a registered WebMCP tool with no JavaScript at all: the
 * browser synthesises the JSON Schema from the markup, so `q` is a required
 * string and `category` is an enum built from the option values. The agent then
 * fills the same two controls a person fills and submits the same form, which
 * makes the repo's central rule something the browser enforces rather than
 * something we keep agreeing to.
 *
 * The submit handler reads FormData rather than React state, because the
 * browser fills the DOM directly and no change event fires on the way. It calls
 * the same store setters a keystroke calls, then answers the agent through
 * `respondToToolSubmit`. When a person submits, there is nothing to respond to
 * and that call is a no-op.
 *
 * The answer is a count rather than a list of products. A declarative tool
 * cannot carry `untrustedContentHint`, and supplier product copy is exactly
 * what that annotation exists for, so this one returns numbers and points at
 * `search_products` for the rows.
 *
 * "Staff sign in" is the demo beat: it calls setSurface("internal"), the page
 * becomes the dashboard, and the registered tool set swaps from the small
 * public one to the full internal one.
 */
export function PublicHeader() {
  const locale = useStore((s) => s.locale);
  const query = useStore((s) => s.catalogSearch);
  const category = useStore((s) => s.catalogFilters.category);

  // The option values become the declarative tool's `category` enum: Chrome
  // synthesises the schema from this markup. A hardcoded list would advertise
  // categories the catalogue does not have, so read the live facets, the same
  // ones the grid's own sidebar uses.
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    void fetchProducts({ limit: 1 })
      .then((result) => {
        if (live) setCategories(result.facets.categories.map((c) => c.label));
      })
      .catch(() => {
        // No facets means the select falls back to "all", which is honest.
      });
    return () => {
      live = false;
    };
  }, []);

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    // Read the DOM, not the store. An agent's submission arrives with the
    // fields already filled in and React's copy of them still stale.
    const fields = new FormData(event.currentTarget);
    const q = String(fields.get("q") ?? "").trim();
    const picked = String(fields.get("category") ?? "");
    const chosen = picked === "" ? null : picked;

    setCatalogSearch(q);
    setCatalogCategory(chosen);

    respondToToolSubmit(event.nativeEvent as SubmitEvent, async () => {
      const result = await fetchProducts({
        search: q,
        category: chosen,
        limit: CATALOG_PAGE_SIZE,
      });
      const pages = Math.max(1, Math.ceil(result.total / CATALOG_PAGE_SIZE));
      const narrowed = chosen === null ? "" : ` in ${chosen}`;
      return text(
        `The catalogue on the visitor's screen now shows ${result.total} ` +
          `product${result.total === 1 ? "" : "s"} matching "${q}"${narrowed}, ` +
          `page 1 of ${pages}. Each product is one line with every colourway ` +
          `on it, not one line per colour.\n\n` +
          `This tool answers with counts only. For the product names, codes ` +
          `and prices, call search_products with the same query; to turn the ` +
          `page or narrow by brand, colour, subcategory or price, call ` +
          `filter_catalog.`,
      );
    });
  }

  return (
    <header className="bg-background/85 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
        <button
          type="button"
          onClick={() => selectProduct(null)}
          className="focus-visible:ring-ring flex shrink-0 items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
            <Bird className="size-4" />
          </span>
          <span className="hidden text-start leading-tight sm:grid">
            <span className="text-sm font-semibold tracking-tight">
              Kestrel Supply Co.
            </span>
            <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
              {t(locale, "tradeCatalogue")}
            </span>
          </span>
        </button>

        <form
          {...CATALOG_SEARCH_FORM}
          onSubmit={onSubmit}
          className="flex min-w-0 flex-1 items-center gap-1.5"
        >
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              {...CATALOG_SEARCH_FIELDS.q}
              name="q"
              required
              value={query}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder={t(locale, "searchPlaceholder")}
              aria-label={t(locale, "searchLabel")}
              className="ps-9"
            />
          </div>

          {/* A native select, so the browser can read its options as the enum
              for the generated schema. The value is the store's, so this and
              the tab strip and the sidebar facet never disagree. */}
          <select
            {...CATALOG_SEARCH_FIELDS.category}
            name="category"
            value={category ?? ""}
            onChange={(e) =>
              setCatalogCategory(e.target.value === "" ? null : e.target.value)
            }
            aria-label={t(locale, "category")}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 hidden h-9 max-w-40 rounded-md border px-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] lg:block dark:bg-input/30"
          >
            <option value="">{t(locale, "allTab")}</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <Button type="submit" variant="outline" className="shrink-0">
            <Search className="size-4" />
            <span className="sr-only">{t(locale, "searchLabel")}</span>
          </Button>
        </form>

        <div className="flex shrink-0 items-center gap-1.5">
          <Select
            value={locale}
            onValueChange={(value) => setLocale(value as Locale)}
          >
            <SelectTrigger
              size="sm"
              aria-label={t(locale, "languageLabel")}
              className="w-auto gap-1.5 sm:w-32"
            >
              <Languages className="size-4 shrink-0" />
              <span className="hidden sm:inline">
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent align="end">
              {LOCALES.map((code) => (
                <SelectItem key={code} value={code}>
                  {LOCALE_NAMES[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ThemeToggle />

          <Button onClick={() => setSurface("internal")}>
            <LogIn className="size-4" />
            <span className="hidden md:inline">{t(locale, "staffSignIn")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
