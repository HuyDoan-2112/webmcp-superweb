import { Minus, Plus, ShoppingCart, X } from "lucide-react";
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
import { setCartQuantity, type Locale } from "@/store";
import { formatPrice } from "./format";
import { t } from "./i18n";

/**
 * The basket, as a slide-over rather than a page.
 *
 * Lines carry the price captured at add time (see CartLine in src/store.ts), so
 * this reads that price straight off the line instead of asking the catalogue
 * again: what the visitor sees here is what they added, even if the catalogue
 * price has since moved.
 */
export function CartSheet({
  open,
  onOpenChange,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
}) {
  const cart = useStore((s) => s.cart);
  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t(locale, "cartTitle")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t(locale, "cartTitle")}
          </SheetDescription>
        </SheetHeader>

        {cart.length === 0 ? (
          <Empty>
            <EmptyMedia>
              <ShoppingCart />
            </EmptyMedia>
            <EmptyTitle>{t(locale, "cartEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t(locale, "cartEmptyBody")}</EmptyDescription>
          </Empty>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-between overflow-hidden">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
              {cart.map((line) => (
                <div key={line.productKey} className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {line.color} · {line.productCode}
                    </p>
                    <p className="mt-1 font-mono text-sm tabular-nums">
                      {formatPrice(line.price, locale)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7"
                      aria-label={t(locale, "decreaseQuantity")}
                      onClick={() =>
                        setCartQuantity(line.productKey, line.quantity - 1)
                      }
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">
                      {line.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7"
                      aria-label={t(locale, "increaseQuantity")}
                      onClick={() =>
                        setCartQuantity(line.productKey, line.quantity + 1)
                      }
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={t(locale, "removeLine")}
                      onClick={() => setCartQuantity(line.productKey, 0)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t p-4">
              <span className="text-sm font-medium">{t(locale, "total")}</span>
              <span className="font-mono text-base font-semibold tabular-nums">
                {formatPrice(total, locale)}
              </span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
