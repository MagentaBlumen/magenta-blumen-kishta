import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { largeUrl, thumbUrl } from "@/lib/image-urls";
import { formatChf, minPrice } from "@/lib/money";
import {
  getProductBySlug,
  getProductDetailBundle,
} from "@/lib/cached-storefront";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Produkt nicht gefunden" };

  // Description: prefer meta_description_de if the admin filled it in,
  // else fall back to the first ~160 chars of the product description,
  // else a generic sentence.
  const rawDesc =
    p.metaDescriptionDe?.trim() ||
    p.descriptionDe?.trim().slice(0, 160) ||
    `${p.nameDe} bei Magenta Blumen. Blumen aus Neuenhof, Lieferung im Aargau.`;

  return {
    title: p.metaTitleDe?.trim() || p.nameDe,
    description: rawDesc,
    alternates: { canonical: `/produkt/${slug}` },
    openGraph: {
      title: p.metaTitleDe?.trim() || p.nameDe,
      description: rawDesc,
      type: "website",
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();

  const { variants, images, colours, categories } = await getProductDetailBundle(
    p.id,
    p.slug,
  );

  const heroImage = images[0] ?? null;
  const galleryImages = images.slice(1);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-10 lg:py-14">
      {/* -------- Structured data: Product schema.org -------- */}
      <ProductJsonLd
        product={p}
        variants={variants}
        image={heroImage}
        colours={colours}
      />

      <nav className="text-[0.75rem] text-sage mb-6">
        <Link href="/" className="hover:text-bark">
          Startseite
        </Link>
        {" / "}
        <span>{p.nameDe}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        {/* -------- Image column -------- */}
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden bg-mist">
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={largeUrl(heroImage.url)}
                alt={heroImage.altDe ?? p.nameDe}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[0.75rem] text-sage uppercase tracking-wider">
                Kein Bild
              </div>
            )}
            {!p.isAvailable && (
              <span className="absolute top-4 right-4 bg-ivory/95 text-bark text-[0.68rem] tracking-[0.14em] uppercase font-medium px-3 py-1.5">
                Ausverkauft
              </span>
            )}
          </div>

          {galleryImages.length > 0 && (
            <div className="grid grid-cols-5 gap-2">
              {galleryImages.map((img) => (
                <div key={img.id} className="aspect-square overflow-hidden bg-mist">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl(img.url)}
                    alt={img.altDe ?? ""}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* -------- Info column -------- */}
        <div className="space-y-6">
          <div>
            <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
              {p.nameDe}
            </h1>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {categories.map((c) => (
                  <Link key={c.slug} href={`/kategorie/${c.slug}`}>
                    <Badge variant="outline" className="border-mist text-sage hover:text-bark hover:border-bark">
                      {c.nameDe}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {colours.length > 0 && (
            <div className="space-y-2">
              <div className="text-[0.68rem] tracking-[0.16em] uppercase font-medium text-bark">
                Farbe
              </div>
              <div className="flex flex-wrap gap-3">
                {colours.map((c) => (
                  <div key={c.value} className="flex items-center gap-2 text-[0.85rem] text-bark">
                    <span
                      className="inline-block h-5 w-5 rounded-full border border-mist"
                      style={{
                        background:
                          c.hex ??
                          "conic-gradient(from 0deg, #F5F0E6, #E8A0BF, #C1272D, #E8853B, #F2C744, #6A8F4F, #6B5B95, #E4D9E8, #F5F0E6)",
                      }}
                      aria-hidden
                    />
                    {c.nameDe}
                  </div>
                ))}
              </div>
            </div>
          )}

          <PricingBlock pricingMode={p.pricingMode} variants={variants} />

          {p.descriptionDe && (
            <div className="pt-4 border-t border-mist space-y-2">
              <div className="text-[0.68rem] tracking-[0.16em] uppercase font-medium text-bark">
                Beschreibung
              </div>
              <p className="text-[0.9rem] text-bark/75 leading-[1.7] font-light whitespace-pre-line">
                {p.descriptionDe}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-mist text-[0.75rem] text-sage">
            Bestellfunktion wird bald verfügbar sein.
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingBlock({
  pricingMode,
  variants,
}: {
  pricingMode: "variant" | "per_unit" | "enquiry";
  variants: Array<{
    id: number;
    sizeLabelDe: string | null;
    priceGross: string;
    salePriceGross: string | null;
    isAvailable: boolean;
  }>;
}) {
  if (pricingMode === "enquiry") {
    return (
      <div className="border border-mist p-4 bg-cream space-y-1">
        <div className="text-[0.85rem] font-medium text-bark">Nur auf Anfrage</div>
        <div className="text-[0.75rem] text-sage">
          Hochzeit, Trauer, Event, Gärtnerservice — bitte kontaktieren Sie
          uns direkt.
        </div>
      </div>
    );
  }

  if (variants.length === 0) {
    return (
      <div className="text-[0.85rem] text-sage">
        Zurzeit keine Varianten verfügbar.
      </div>
    );
  }

  if (pricingMode === "per_unit") {
    const v = variants[0];
    return (
      <div className="text-2xl font-display text-bark tabular-nums">
        {formatChf(v.priceGross)}
        <span className="text-[0.85rem] text-sage font-body font-normal ml-2">
          / Stück
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[0.68rem] tracking-[0.16em] uppercase font-medium text-bark">
        Varianten
      </div>
      <div className="border border-mist divide-y divide-mist">
        {variants.map((v) => (
          <div
            key={v.id}
            className={`flex items-center justify-between px-4 py-3 ${
              !v.isAvailable ? "opacity-50" : ""
            }`}
          >
            <div className="text-[0.85rem] text-bark">
              {v.sizeLabelDe || "Standard"}
              {!v.isAvailable && (
                <span className="ml-2 text-[0.7rem] text-sage">(ausverkauft)</span>
              )}
            </div>
            <div className="tabular-nums font-medium text-bark">
              {formatChf(v.priceGross)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductJsonLd({
  product: p,
  variants,
  image,
  colours,
}: {
  product: {
    slug: string;
    nameDe: string;
    descriptionDe: string | null;
    isAvailable: boolean;
    pricingMode: "variant" | "per_unit" | "enquiry";
  };
  variants: Array<{ priceGross: string; isAvailable: boolean }>;
  image: { url: string } | null;
  colours: Array<{ nameDe: string }>;
}) {
  // schema.org Product. Uses aggregate price (lowest across available
  // variants) so search results can show a price. Skip entirely for
  // enquiry-only products - there's no meaningful offer.
  if (p.pricingMode === "enquiry") return null;

  const availablePrices = variants.filter((v) => v.isAvailable).map((v) => v.priceGross);
  const lowestPrice = minPrice(availablePrices);
  const availability = p.isAvailable && availablePrices.length > 0
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.nameDe,
    description: p.descriptionDe ?? undefined,
    image: image ? largeUrl(image.url) : undefined,
    brand: { "@type": "Brand", name: "Magenta Blumen" },
    ...(colours.length > 0 && { color: colours.map((c) => c.nameDe).join(", ") }),
    offers: lowestPrice
      ? {
          "@type": "Offer",
          priceCurrency: "CHF",
          price: lowestPrice,
          availability,
          url: `/produkt/${p.slug}`,
        }
      : undefined,
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
