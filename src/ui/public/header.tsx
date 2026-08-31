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
  selectProduct,
  type Locale,
} from "@/store";
import { text } from "@/mcp/adapter";
import {
  CATALOG_SEARCH_FIELDS,
  CATALOG_SEARCH_FORM,
  respondToToolSubmit,
} from "@/mcp/declarative";
import { signIn } from "@/auth/switcher";
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
 * "Staff sign in" is the demo beat. It calls signIn(), which writes the
 * superweb_session cookie and moves the surface, so the page becomes the
 * dashboard, the registered tool set swaps from the small public one to the
 * full internal one, and every subsequent answer comes back at that person's
 * depth instead of at catalogue depth.
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
      <div className="mx-auto grid h-16 w-full max-w-7xl grid-cols-[auto_1fr] items-center gap-3 px-4 sm:gap-5 sm:px-6 lg:grid-cols-[1fr_auto_1fr]">
        <button
          type="button"
          onClick={() => selectProduct(null)}
          className="focus-visible:ring-ring flex w-fit shrink-0 items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
            <Bird className="size-4" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:block">
            Kestrel Supply Co.
          </span>
        </button>

        <form
          {...CATALOG_SEARCH_FORM}
          onSubmit={onSubmit}
          className="border-input bg-background focus-within:border-ring focus-within:ring-ring/50 order-last col-span-2 flex h-10 w-full min-w-0 items-center rounded-lg border shadow-xs transition-[color,box-shadow] focus-within:ring-[3px] lg:order-none lg:col-span-1 lg:w-[34rem] lg:justify-self-center dark:bg-input/30"
        >
          <div className="relative min-w-0 flex-1">
            <Input
              {...CATALOG_SEARCH_FIELDS.q}
              name="q"
              required
              value={query}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder={t(locale, "searchPlaceholder")}
              aria-label={t(locale, "searchLabel")}
              className="h-9 border-0 bg-transparent px-3.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
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
            className="text-muted-foreground hover:text-foreground hidden h-9 max-w-40 border-s bg-transparent px-3 text-sm outline-none lg:block"
          >
            <option value="">{t(locale, "allTab")}</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-9 shrink-0 items-center justify-center rounded-e-lg focus-visible:ring-2 focus-visible:outline-none"
          >
            <Search className="size-4" />
            <span className="sr-only">{t(locale, "searchLabel")}</span>
          </button>
        </form>

        <div className="flex shrink-0 items-center gap-1 justify-self-end">
          <Select
            value={locale}
            onValueChange={(value) => setLocale(value as Locale)}
          >
            {/* Icon only, and the same footprint as the theme toggle beside
                it. The language name was the widest thing in this group and it
                made the two utility controls read as different ranks. */}
            <SelectTrigger
              size="sm"
              aria-label={t(locale, "languageLabel")}
              className="hover:bg-accent hover:text-accent-foreground size-9 justify-center border-0 bg-transparent p-0 shadow-none [&>svg:last-child]:hidden dark:bg-transparent"
            >
              <Languages className="size-4 shrink-0" />
              <span className="sr-only">
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

          <Button onClick={() => signIn()}>
            <LogIn className="size-4" />
            <span className="hidden md:inline">{t(locale, "staffSignIn")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
