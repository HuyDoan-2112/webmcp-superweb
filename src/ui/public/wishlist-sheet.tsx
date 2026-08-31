import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useStore } from "@/hooks/use-store";
import { selectProduct, toggleWishlist, type Locale } from "@/store";
import { fetchProduct, type ProductDetailResponse } from "@/api";
import { useAsync } from "@/hooks/use-async";
import { formatPrice } from "./format";
import { t } from "./i18n";
import { ProductImage } from "./product-image";

/**
 * The saved list, fetched fresh rather than cached.
 *
 * The store only keeps ProductKeys (see `wishlist` in src/store.ts), not the
 * product record, so this asks the catalogue for each one. A key whose product
 * no longer resolves is dropped rather than shown broken: it can only happen if
 * the demo data changes under a running session, not from anything a visitor did.
 */
export function WishlistSheet({
  open,
  onOpenChange,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
}) {
  const wishlist = useStore((s) => s.wishlist);

  const { data } = useAsync<(ProductDetailResponse | null)[]>(
    () => Promise.all(wishlist.map((key) => fetchProduct(key).catch(() => null))),
    [wishlist.join(",")],
  );

  const items = (data ?? []).filter(
    (item): item is ProductDetailResponse => item !== null,
  );

  function openProduct(productKey: number): void {
    selectProduct(productKey);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t(locale, "wishlistTitle")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t(locale, "wishlistTitle")}
          </SheetDescription>
        </SheetHeader>

        {wishlist.length === 0 ? (
          <Empty>
            <EmptyMedia>
              <Heart />
            </EmptyMedia>
            <EmptyTitle>{t(locale, "wishlistEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t(locale, "wishlistEmptyBody")}</EmptyDescription>
          </Empty>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            {items.map(({ product }) => (
              <div key={product.productKey} className="flex items-start gap-3">
                <ProductImage
                  name={product.productName}
                  categoryName={product.categoryName}
                  color={product.color}
                  productCode={product.productCode}
                  className="w-16 shrink-0 overflow-hidden rounded-md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {product.productName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {product.color}
                  </p>
                  <p className="mt-1 font-mono text-sm tabular-nums">
                    {formatPrice(product.price, locale)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => openProduct(product.productKey)}
                    >
                      {t(locale, "view")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => toggleWishlist(product.productKey)}
                    >
                      {t(locale, "removeFromWishlist")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
