import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductVariantPicker } from "@/components/storefront/product-variant-picker";
import { largeUrl } from "@/lib/image-urls";
import { minPrice } from "@/lib/money";
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

  // Prefer a range category ("Sträusse", "Rosen") as the eyebrow line
  // above the title — matches Figma's use of the variety label. Fall
  // back to the first category, or nothing.
  const eyebrow =
    categories.find((c) => c.kind === "range")?.nameDe ??
    categories[0]?.nameDe ??
    null;

  const heroImage = images[0] ?? null;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
      <ProductJsonLd
        product={p}
        variants={variants}
        image={heroImage}
        colours={colours}
      />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[0.68rem] tracking-[0.08em] uppercase text-sage mb-8">
        <Link href="/" className="hover:text-rose transition-colors">
          Startseite
        </Link>
        <span>/</span>
        {eyebrow && categories[0] ? (
          <>
            <Link
              href={`/kategorie/${categories[0].slug}`}
              className="hover:text-rose transition-colors"
            >
              {categories[0].nameDe}
            </Link>
            <span>/</span>
          </>
        ) : null}
        <span className="text-bark normal-case tracking-normal text-[0.75rem]">
          {p.nameDe}
        </span>
      </nav>

      <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-start pb-16">
        {/* -------- Gallery -------- */}
        <ProductGallery
          images={images}
          productName={p.nameDe}
          showSoldOut={!p.isAvailable}
        />

        {/* -------- Info column -------- */}
        <div>
          {eyebrow && (
            <p className="text-[0.68rem] tracking-[0.16em] uppercase text-sage font-medium mb-2.5">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display font-light text-bark text-[clamp(2rem,3.5vw,2.8rem)] leading-[1.1] mb-6">
            {p.nameDe}
          </h1>

          {p.pricingMode === "enquiry" ? (
            <EnquiryBlock />
          ) : (
            <ProductVariantPicker variants={variants} />
          )}

          {colours.length > 0 && p.pricingMode !== "enquiry" && (
            <div className="pt-6">
              <p className="text-[0.68rem] tracking-[0.12em] uppercase font-medium text-bark mb-2.5">
                Farbe
              </p>
              <div className="flex flex-wrap gap-2">
                {colours.map((c) => (
                  <span
                    key={c.value}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-mist text-[0.75rem] text-bark"
                  >
                    <span
                      aria-hidden
                      className="inline-block h-4 w-4 rounded-full border border-mist"
                      style={{
                        background:
                          c.hex ??
                          "conic-gradient(from 0deg, #F5F0E6, #E8A0BF, #C1272D, #E8853B, #F2C744, #6A8F4F, #6B5B95, #E4D9E8, #F5F0E6)",
                      }}
                    />
                    {c.nameDe}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Placeholder where add-to-cart lands in Session 5. Kept as a
              plain notice — no fake button, no wishlist. */}
          {p.pricingMode !== "enquiry" && (
            <div className="mt-8 px-4 py-3 bg-cream border border-mist text-[0.75rem] text-sage">
              Die Online-Bestellung wird in Kürze aufgeschaltet. Rufen Sie
              uns gerne direkt an: <span className="text-bark">056 555 55 55</span>.
            </div>
          )}

          {/* -------- Trust badges (real Magenta Blumen reality) -------- */}
          <div className="grid grid-cols-2 gap-2 mt-6">
            {TRUST_BADGES.map((b) => (
              <div
                key={b.text}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-cream border border-mist"
              >
                <span aria-hidden className="text-[1rem] leading-none">{b.icon}</span>
                <span className="text-[0.68rem] leading-tight text-bark">
                  {b.text}
                </span>
              </div>
            ))}
          </div>

          {/* -------- Accordions -------- */}
          <div className="mt-8 border-t border-mist">
            {p.descriptionDe && (
              <Accordion label="Beschreibung" defaultOpen>
                <p className="text-[0.85rem] text-bark/75 leading-[1.75] font-light whitespace-pre-line">
                  {p.descriptionDe}
                </p>
              </Accordion>
            )}

            <Accordion label="Pflegehinweise">
              <ul className="space-y-1.5 pl-4 list-disc marker:text-sage">
                {CARE_STEPS.map((step) => (
                  <li key={step} className="text-[0.85rem] text-bark/75 leading-[1.6]">
                    {step}
                  </li>
                ))}
              </ul>
            </Accordion>

            <Accordion label="Lieferung">
              <dl className="space-y-2.5">
                {DELIVERY_FACTS.map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="text-[0.68rem] tracking-[0.08em] uppercase font-medium text-bark w-[110px] flex-shrink-0 pt-0.5">
                      {k}
                    </dt>
                    <dd className="text-[0.85rem] text-bark/75 leading-[1.55]">{v}</dd>
                  </div>
                ))}
              </dl>
            </Accordion>

            <Accordion label="Herkunft">
              <dl className="space-y-2.5">
                {ORIGIN_FACTS.map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="text-[0.68rem] tracking-[0.08em] uppercase font-medium text-bark w-[110px] flex-shrink-0 pt-0.5">
                      {k}
                    </dt>
                    <dd className="text-[0.85rem] text-bark/75 leading-[1.55]">{v}</dd>
                  </div>
                ))}
              </dl>
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
}

function EnquiryBlock() {
  return (
    <div className="border-y border-mist py-5 space-y-1">
      <p className="font-display text-[1.6rem] font-normal text-bark leading-none">
        Nur auf Anfrage
      </p>
      <p className="text-[0.78rem] text-sage mt-1.5">
        Hochzeit, Trauer, Event, Gärtnerservice — bitte kontaktieren Sie uns direkt.
      </p>
    </div>
  );
}

/**
 * Uses native <details> for zero-JS collapse. Rotating the marker is
 * pure CSS. `defaultOpen` prop maps to the HTML `open` attribute.
 */
function Accordion({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-mist [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex items-center justify-between py-4 cursor-pointer list-none text-[0.72rem] tracking-[0.12em] uppercase font-medium text-bark hover:text-rose transition-colors">
        {label}
        <span
          aria-hidden
          className="text-[1.1rem] leading-none text-sage transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

// ------------------------------------------------------------------
// Content that isn't in the DB. Same for every product for now.
// If per-product overrides are ever needed, add fields to `product`.
// ------------------------------------------------------------------

const TRUST_BADGES: { icon: string; text: string }[] = [
  { icon: "✿", text: "Von Hand gebunden" },
  { icon: "🚐", text: "Eigener Van, 27 Aargauer PLZ" },
  { icon: "☀️", text: "Auch am Sonntag geliefert" },
  { icon: "🌱", text: "Frisch aus der Werkstatt" },
];

const CARE_STEPS = [
  "Stiele schräg anschneiden",
  "In frisches, lauwarmes Wasser stellen",
  "Alle zwei Tage Wasser wechseln",
  "Kühl und vor direkter Sonne geschützt aufstellen",
  "Welke Blätter entfernen",
];

const DELIVERY_FACTS: [string, string][] = [
  ["Liefergebiet", "27 Postleitzahlen im Aargau (siehe Zonen bei der Kasse)"],
  ["Zeitfenster", "10:00–12:00 oder 16:00–18:00, sieben Tage die Woche"],
  ["Vorlauf", "Mindestens 3 Stunden vor der Tour bestellen"],
  ["Abholung", "In-Store-Abholung in Neuenhof jederzeit möglich"],
];

const ORIGIN_FACTS: [string, string][] = [
  ["Werkstatt", "Magenta Blumen, Neuenhof AG"],
  ["Bindung", "Jeder Strauss von der Inhaberin persönlich gebunden"],
  ["Bezug", "Regional und über Schweizer Grosshandel eingekauft"],
];

// ------------------------------------------------------------------
// schema.org Product JSON-LD (unchanged from before the restyle).
// ------------------------------------------------------------------

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
  if (p.pricingMode === "enquiry") return null;

  const availablePrices = variants.filter((v) => v.isAvailable).map((v) => v.priceGross);
  const lowestPrice = minPrice(availablePrices);
  const availability =
    p.isAvailable && availablePrices.length > 0
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

