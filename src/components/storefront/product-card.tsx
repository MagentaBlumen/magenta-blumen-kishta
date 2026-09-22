import Link from "next/link";
import { formatChf, formatChfFrom, minPrice } from "@/lib/money";
import { thumbUrl } from "@/lib/image-urls";

export type ProductCardData = {
  slug: string;
  nameDe: string;
  pricingMode: "variant" | "per_unit" | "enquiry";
  isAvailable: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
  /** Prices of all this product's available variants (numeric strings). */
  variantPrices: string[];
};

/**
 * Product card for grid views. Shows the thumbnail (WebP), name and
 * "ab CHF X" pricing hint.
 *
 * Layout: 3:4 image, name below, price on the last line. Fixed height
 * so a grid stays aligned even with different-length names.
 *
 * Availability handling (CLAUDE.md rule 7): sold-out products render
 * GREYED OUT, not hidden. So we render the card in all cases, only
 * the tint changes.
 */
export function ProductCard({ product }: { product: ProductCardData }) {
  const price = renderPrice(product);
  const src = product.imageUrl ? thumbUrl(product.imageUrl) : null;

  return (
    <Link
      href={`/produkt/${product.slug}`}
      className={`group flex flex-col rounded-lg overflow-hidden border bg-card transition-colors hover:border-primary ${
        !product.isAvailable ? "opacity-60" : ""
      }`}
    >
      <div className="relative aspect-[3/4] bg-muted overflow-hidden">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={product.imageAlt ?? product.nameDe}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            Kein Bild
          </div>
        )}
        {!product.isAvailable && (
          <div className="absolute top-2 right-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium">
            Ausverkauft
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="font-medium text-sm line-clamp-2">
          {product.nameDe}
        </div>
        <div className="text-sm text-muted-foreground tabular-nums">
          {price}
        </div>
      </div>
    </Link>
  );
}

function renderPrice(product: ProductCardData): string {
  if (product.pricingMode === "enquiry") return "Auf Anfrage";
  if (product.pricingMode === "per_unit") {
    // Exactly one variant, price is per stem
    const p = product.variantPrices[0];
    return p ? `${formatChf(p)} / Stück` : "—";
  }
  // variant mode: min price across variants
  const min = minPrice(product.variantPrices);
  return product.variantPrices.length > 1 ? formatChfFrom(min) : formatChf(min);
}
