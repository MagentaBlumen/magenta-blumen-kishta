import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";
import {
  getColourBySlug,
  getProductsInColour,
} from "@/lib/cached-storefront";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Fallback for the "bunt" swatch — attribute_value.hex is NULL for
 * that value so we render a conic gradient covering the rainbow.
 * Matches the fallback used on the product detail page.
 */
const BUNT_GRADIENT =
  "conic-gradient(from 0deg, #F5F0E6, #E8A0BF, #C1272D, #E8853B, #F2C744, #6A8F4F, #6B5B95, #E4D9E8, #F5F0E6)";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const c = await getColourBySlug(slug);
  if (!c) return { title: "Farbe nicht gefunden" };

  return {
    title: `Blumen in ${c.nameDe}`,
    description: `Alle Blumen in ${c.nameDe} bei Magenta Blumen. Blumen aus Neuenhof, Lieferung im Aargau.`,
    alternates: { canonical: `/farbe/${slug}` },
  };
}

export default async function ColourPage({ params }: PageProps) {
  const { slug } = await params;
  const c = await getColourBySlug(slug);
  if (!c) notFound();

  const cards = await getProductsInColour(c.id);
  const swatchBg = c.hex ?? BUNT_GRADIENT;

  // The hero text needs to read against the swatch. Cream on dark
  // colours, bark on light ones. Cheap luminance check via a couple
  // of common Magenta swatches; anything unrecognised defaults to
  // cream because most brand hexes are saturated / mid-value.
  const usesCreamText = isDarkSwatch(c.hex);

  return (
    <>
      {/* -------- Hero band: the swatch IS the visual -------- */}
      <section className="relative h-[220px] lg:h-[280px] overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: swatchBg }}
        />
        {/* Soft ivory fade on the left so the eyebrow/title reads even
            on very saturated hues. Kept subtle so the swatch is still
            the star. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: usesCreamText
              ? "linear-gradient(to right, rgba(42,31,26,0.35) 0%, rgba(42,31,26,0.05) 55%, transparent 100%)"
              : "linear-gradient(to right, rgba(253,252,249,0.7) 0%, rgba(253,252,249,0.25) 55%, transparent 100%)",
          }}
        />
        <div className="relative h-full max-w-7xl mx-auto px-4 lg:px-6 flex items-center">
          <div className="max-w-md">
            <p
              className={`text-[0.68rem] tracking-[0.2em] uppercase font-medium mb-3 ${
                usesCreamText ? "text-blush" : "text-sage"
              }`}
            >
              Nach Farbe
            </p>
            <h1
              className={`font-display font-light text-[clamp(2.2rem,4vw,3.2rem)] leading-[1.1] ${
                usesCreamText ? "text-cream" : "text-bark"
              }`}
            >
              {c.nameDe}
            </h1>
          </div>
        </div>
      </section>

      {/* -------- Breadcrumb -------- */}
      <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-6">
        <nav className="flex items-center gap-2 text-[0.68rem] tracking-[0.08em] uppercase text-sage">
          <Link href="/" className="hover:text-rose transition-colors">
            Startseite
          </Link>
          <span>/</span>
          <span className="text-bark normal-case tracking-normal text-[0.75rem]">
            Farbe: {c.nameDe}
          </span>
        </nav>
      </div>

      {/* -------- Product grid -------- */}
      <section className="max-w-7xl mx-auto px-4 lg:px-6 py-10 lg:py-14">
        {cards.length === 0 ? (
          <div className="border border-dashed border-mist p-12 text-center text-sage text-[0.85rem] max-w-2xl mx-auto">
            Zurzeit keine Blumen in {c.nameDe}.
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between mb-8">
              <p className="text-[0.72rem] text-sage tracking-[0.06em]">
                {cards.length}{" "}
                {cards.length === 1 ? "Produkt" : "Produkte"}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
              {cards.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

/**
 * Rough dark-swatch check: pure JS relative luminance of the hex.
 * NULL hex ("bunt") — treat as light-ish since the gradient has cream
 * regions bookending it.
 */
function isDarkSwatch(hex: string | null): boolean {
  if (!hex) return false;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  // Rec. 601 luma. < 140 counts as dark — tuned to flip on the
  // Magenta rose (#a0185a) and other saturated brand hues.
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma < 140;
}
