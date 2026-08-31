// Generated product artwork. No network request, no remote host, no licence.
//
// Contoso ships no photography, and a catalogue of grey placeholder boxes reads
// as broken. So every product gets a deterministic image instead: the tint of
// the colourway on show, a line-art glyph chosen by its category, a fine dot
// grain angled by a hash of the product name, and the Kestrel mark in the
// corner. The same variant draws the same picture on every render, in every
// browser.
//
// The tint comes from the variant's own colour rather than from a hash, so
// switching swatch on a card or picking another colourway on the detail page
// visibly changes the picture. That is the point: a nine-colour camera is one
// product here, and the image has to answer which colour you are looking at.
//
// The tint is mixed into `var(--card)` with color-mix, so the artwork follows
// the theme: pale on the light surface, deep on the dark one, same colour.

import { useState } from "react";
import { Bird } from "lucide-react";
import { cn } from "@/lib/utils";
import { hashOf, swatchFor } from "./format";

// One glyph per category. Drawn in a 48x48 box, stroked in currentColor.
const GLYPHS: Record<string, () => React.ReactElement> = {
  Audio: () => (
    <>
      <path d="M10 30v-4a14 14 0 0 1 28 0v4" />
      <rect x="5" y="28" width="9" height="13" rx="3.5" />
      <rect x="34" y="28" width="9" height="13" rx="3.5" />
    </>
  ),
  "Cameras and camcorders": () => (
    <>
      <rect x="5" y="15" width="38" height="24" rx="3" />
      <path d="M18 15l3-5h6l3 5" />
      <circle cx="24" cy="27" r="7" />
      <circle cx="37" cy="21" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  "Cell phones": () => (
    <>
      <rect x="15" y="5" width="18" height="38" rx="4" />
      <path d="M21 11h6" />
      <circle cx="24" cy="37" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  Computers: () => (
    <>
      <rect x="10" y="9" width="28" height="20" rx="2.5" />
      <path d="M4 34h40" />
      <path d="M15 39h18" />
      <path d="M9 34l2-5M39 34l-2-5" />
    </>
  ),
  "Games and Toys": () => (
    <>
      <rect x="11" y="11" width="26" height="26" rx="5" />
      <circle cx="18.5" cy="18.5" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="24" cy="24" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="29.5" cy="29.5" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  "Home Appliances": () => (
    <>
      <rect x="12" y="5" width="24" height="38" rx="3" />
      <path d="M12 15h24" />
      <circle cx="24" cy="29" r="7.5" />
      <circle cx="17" cy="10" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  "Music, Movies and Audio Books": () => (
    <>
      <circle cx="24" cy="24" r="16" />
      <circle cx="24" cy="24" r="4" />
      <path d="M24 12a12 12 0 0 1 10.4 6" />
    </>
  ),
  "TV and Video": () => (
    <>
      <rect x="5" y="9" width="38" height="25" rx="3" />
      <path d="M24 34v5" />
      <path d="M16 39h16" />
    </>
  ),
};

/** Anything the data adds later still gets a picture. */
const FallbackGlyph = () => (
  <>
    <path d="M24 5l17 9v20l-17 9-17-9V14z" />
    <path d="M7 14l17 9 17-9M24 23v20" />
  </>
);

export function ProductImage({
  name,
  categoryName,
  color,
  productCode,
  size = "card",
  className,
}: {
  /** Product or family name. Decides the gradient angle, nothing else. */
  name: string;
  categoryName: string;
  /** The colourway on show. Decides the tint. */
  color: string;
  /**
   * When a photograph has been committed for this variant, its product code.
   * The file is looked for at `public/products/<productCode>.jpg`; if it is not
   * there, or fails to decode, the generated artwork below draws instead. That
   * fallback is what lets photography land one product at a time rather than as
   * a single all-or-nothing swap.
   */
  productCode?: string;
  size?: "card" | "detail";
  className?: string;
}) {
  // Remember the code that failed, not a bare boolean: switching colourway
  // swaps in a different file, which deserves its own attempt.
  const [failedCode, setFailedCode] = useState<string | null>(null);

  if (productCode !== undefined && failedCode !== productCode) {
    return (
      <img
        src={`/products/${productCode}.jpg`}
        alt={name}
        loading="lazy"
        onError={() => setFailedCode(productCode)}
        className={cn("aspect-[4/3] w-full object-cover", className)}
      />
    );
  }

  const angle = 100 + (hashOf(name) % 90);
  const Glyph = GLYPHS[categoryName] ?? FallbackGlyph;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative isolate flex aspect-[4/3] items-center justify-center overflow-hidden transition-[background-image] duration-300",
        className,
      )}
      style={
        {
          "--tint": swatchFor(color).fill,
          backgroundImage:
            `linear-gradient(${angle}deg, color-mix(in oklab, var(--tint) 68%, var(--card)) 0%, ` +
            "color-mix(in oklab, var(--tint) 16%, var(--card)) 100%)",
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "radial-gradient(var(--foreground) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
        }}
      />
      <svg
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "text-foreground/55 relative",
          size === "detail" ? "size-32" : "size-20",
        )}
      >
        <Glyph />
      </svg>
      <Bird
        className={cn(
          "text-foreground/30 absolute",
          size === "detail" ? "end-5 bottom-5 size-5" : "end-3 bottom-3 size-3.5",
        )}
      />
    </div>
  );
}
