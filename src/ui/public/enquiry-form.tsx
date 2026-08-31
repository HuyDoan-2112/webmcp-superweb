import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { sendEnquiry, type Locale } from "@/store";
import { t } from "./i18n";

/**
 * A question about one product, sent to the owner enquiry view.
 *
 * Signed-in only. An anonymous question has no name to answer, and the store's
 * `Enquiry` carries `customerName` because the owner view is meant to show real
 * people asking real things, not a form nobody can follow up with.
 */
export function EnquiryForm({
  productKey,
  productName,
  locale,
}: {
  productKey: number;
  productName: string;
  locale: Locale;
}) {
  const customer = useStore((s) => s.customer);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  if (!customer) {
    return (
      <p className="text-muted-foreground text-sm">
        {t(locale, "enquirySignInPrompt")}
      </p>
    );
  }

  if (sent) {
    return <p className="text-sm">{t(locale, "enquirySent")}</p>;
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !customer) return;
    sendEnquiry({
      customerName: customer.name,
      productKey,
      productName,
      message: trimmed,
    });
    setMessage("");
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <label htmlFor="enquiry-message" className="text-muted-foreground text-xs">
        {t(locale, "questionLabel")}
      </label>
      <textarea
        id="enquiry-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t(locale, "questionPlaceholder")}
        rows={3}
        required
        className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] dark:bg-input/30"
      />
      <Button type="submit" size="sm" className="self-start">
        {t(locale, "sendQuestion")}
      </Button>
    </form>
  );
}
