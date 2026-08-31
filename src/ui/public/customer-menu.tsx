import { useState } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/hooks/use-store";
import { signInCustomer, signOutCustomer, type Locale } from "@/store";
import { t } from "./i18n";
import { CartSheet } from "./cart-sheet";
import { WishlistSheet } from "./wishlist-sheet";

/**
 * The customer's identity control, the fourth ghost button beside the
 * language picker, the location picker and the theme toggle.
 *
 * Signed out it is a plain icon; signed in it becomes the customer's initial,
 * which keeps the footprint identical to its neighbours instead of growing a
 * name into the header. Cart and wishlist live behind this one control rather
 * than getting header buttons of their own, because a customer who has not
 * said who they are has nothing in either yet worth a permanent spot.
 */
export function CustomerMenu({ locale }: { locale: Locale }) {
  const customer = useStore((s) => s.customer);
  const cartCount = useStore((s) => s.cart.length);
  const wishlistCount = useStore((s) => s.wishlist.length);

  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);

  function onSignIn(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    signInCustomer(name);
    setName("");
    setMenuOpen(false);
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              customer ? t(locale, "signedInAs", { name: customer.name }) : t(locale, "accountLabel")
            }
            className="hover:bg-accent hover:text-accent-foreground size-9 rounded-full"
          >
            {customer ? (
              <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full text-xs font-semibold">
                {customer.name.slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <User className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-56">
          {customer ? (
            <>
              <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                {t(locale, "signedInAs", { name: customer.name })}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setCartOpen(true);
                }}
              >
                {t(locale, "cartWithCount", { count: cartCount })}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setWishlistOpen(true);
                }}
              >
                {t(locale, "wishlistWithCount", { count: wishlistCount })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOutCustomer()}>
                {t(locale, "signOut")}
              </DropdownMenuItem>
            </>
          ) : (
            <form onSubmit={onSignIn} className="flex flex-col gap-2 p-2">
              <label className="text-muted-foreground px-1 text-xs" htmlFor="customer-name">
                {t(locale, "yourName")}
              </label>
              <Input
                id="customer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={t(locale, "namePlaceholder")}
                autoFocus
                className="h-8 rounded-lg text-sm"
              />
              <Button type="submit" size="sm" className="h-8">
                {t(locale, "signIn")}
              </Button>
            </form>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CartSheet open={cartOpen} onOpenChange={setCartOpen} locale={locale} />
      <WishlistSheet open={wishlistOpen} onOpenChange={setWishlistOpen} locale={locale} />
    </>
  );
}
