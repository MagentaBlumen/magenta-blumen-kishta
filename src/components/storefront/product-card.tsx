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
  variantPrices: string[];
  /** Optional pill in the top-left corner. "Neu", "Bestseller", etc. */
  tag?: string | null;
};

/**
 * Product card matching the Figma design.
 *
 * Layout: 3:4 image with tag pill top-left (optional) + name + price.
 * Hover:
 *   - image zooms gently (500ms ease-out)
 *   - card lifts slightly (-translate-y-0.5)
 *   - subtle warm overlay on the image
 *   - name shifts to rose, price shifts to bark
 *
 * Sold-out: greys the whole card + shows an "Ausverkauft" overlay pill.
 * CLAUDE.md rule 7 (sold-out is dimmed, not hidden).
 */
export function ProductCard({ product }: { product: ProductCardData }) {
  const price = renderPrice(product);
  const src = product.imageUrl ? thumbUrl(product.imageUrl) : null;

  return (
    <Link
      href={`/produkt/${product.slug}`}
      className={`group block transition-transform duration-300 ease-out hover:-translate-y-0.5 ${!product.isAvailable ? "opacity-60" : ""}`}
    >
      <div className="relative aspect-[3/4] bg-mist overflow-hidden mb-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={product.imageAlt ?? product.nameDe}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[0.7rem] text-sage uppercase tracking-wider">
            Kein Bild
          </div>
        )}
        {/* Warm overlay on hover - adds depth to the image without
            darkening it so the colours stay recognizable. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-bark/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        />
        {product.tag && (
          <span className="absolute top-3 left-3 bg-ivory/95 text-bark text-[0.65rem] tracking-[0.14em] uppercase font-medium px-2.5 py-1 shadow-sm">
            {product.tag}
          </span>
        )}
        {!product.isAvailable && (
          <span className="absolute top-3 right-3 bg-ivory/95 text-bark text-[0.65rem] tracking-[0.14em] uppercase font-medium px-2.5 py-1 shadow-sm">
            Ausverkauft
          </span>
        )}
      </div>
      <div className="space-y-1 px-1">
        <div className="text-[0.9rem] text-bark font-normal leading-snug group-hover:text-rose transition-colors duration-200 line-clamp-2">
          {product.nameDe}
        </div>
        <div className="text-[0.8rem] text-sage group-hover:text-bark tabular-nums transition-colors duration-200">
          {price}
        </div>
      </div>
    </Link>
  );
}

function renderPrice(product: ProductCardData): string {
  if (product.pricingMode === "enquiry") return "Auf Anfrage";
  if (product.pricingMode === "per_unit") {
    const p = product.variantPrices[0];
    return p ? `${formatChf(p)} / Stück` : ".";
  }
  const min = minPrice(product.variantPrices);
  return product.variantPrices.length > 1 ? formatChfFrom(min) : formatChf(min);
}
