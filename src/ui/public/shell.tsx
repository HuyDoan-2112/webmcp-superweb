import { useEffect } from "react";
import { useStore } from "@/hooks/use-store";
import { PublicHeader } from "./header";
import { Catalog } from "./catalog";
import { ProductDetail } from "./product-detail";
import { LOCALE_TAGS, t } from "./i18n";
// PROTOTYPE (issue #30), dev only, renders nothing without ?variant=
import { PrototypeStrip } from "./prototype-strip";

/**
 * The public surface: what an anonymous visitor to Kestrel Supply Co. sees,
 * and what their own agent drives through the public WebMCP tools.
 *
 * Which page shows is store state, not a route. Nothing here reads the URL.
 */
export function PublicShell() {
  const locale = useStore((s) => s.locale);
  const selectedProductKey = useStore((s) => s.selectedProductKey);

  // Keep the document language honest, so screen readers and the browser's own
  // translation offer follow the switcher.
  useEffect(() => {
    document.documentElement.lang = LOCALE_TAGS[locale];
  }, [locale]);

  return (
    <div className="bg-background flex min-h-svh flex-col">
      <PublicHeader />
      {import.meta.env.DEV && <PrototypeStrip />}
      <main className="flex-1">
        {selectedProductKey === null ? <Catalog /> : <ProductDetail />}
      </main>
      <footer className="mt-16 border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-8 text-xs sm:px-6">
          <p className="text-foreground font-medium">Kestrel Supply Co.</p>
          <p>{t(locale, "footerNote")}</p>
        </div>
      </footer>
    </div>
  );
}
