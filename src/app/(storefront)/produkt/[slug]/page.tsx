import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductVariantPicker } from "@/components/storefront/product-variant-picker";
import { largeUrl } from "@/lib/image-urls";
import { minPrice } from "@/lib/money";
import {
  getCategoryBySlug,
  getProductBySlug,
  getProductDetailBundle,
  getProductsInCategory,
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

  const eyebrow =
    categories.find((c) => c.kind === "range")?.nameDe ??
    categories[0]?.nameDe ??
    null;

  const heroImage = images[0] ?? null;

  // Related products: pull from the first category, strip the current
  // product, take up to 4. getProductDetailBundle doesn't return the
  // category id in its select, so we re-resolve by slug — cheap, hits
  // the same categories cache.
  const firstCategory = categories[0] ?? null;
  const firstCategoryFull = firstCategory
    ? await getCategoryBySlug(firstCategory.slug)
    : null;
  const relatedAll = firstCategoryFull
    ? await getProductsInCategory(firstCategoryFull.id, firstCategoryFull.slug)
    : [];
  const related = relatedAll.filter((r) => r.slug !== p.slug).slice(0, 4);

  // Split the title into "main" and "italic trailer" by the LAST
  // comma or dash. Falls back to italicising the last word so the
  // display heading always has that Fraunces/Cormorant italic kick
  // from the mockup without needing per-product title data.
  const { titleMain, titleItalic } = splitTitle(p.nameDe);

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-6 lg:py-8 flex flex-col gap-8">
      <ProductJsonLd
        product={p}
        variants={variants}
        image={heroImage}
        colours={colours}
      />

      {/* Breadcrumb */}
      <nav
        aria-label="Brotkrümelnavigation"
        className="text-[13px] text-sage flex flex-wrap items-center gap-2"
      >
        <Link href="/" className="hover:text-rose transition-colors">
          Startseite
        </Link>
        <span aria-hidden>/</span>
        {firstCategory && (
          <>
            <Link
              href={`/kategorie/${firstCategory.slug}`}
              className="hover:text-rose transition-colors"
            >
              {firstCategory.nameDe}
            </Link>
            <span aria-hidden>/</span>
          </>
        )}
        <span aria-current="page" className="text-bark">
          {p.nameDe}
        </span>
      </nav>

      {/* ---------- Product: gallery + buy box ---------- */}
      <div className="flex flex-wrap items-start gap-12 lg:gap-16">
        <div className="flex-[7_1_480px] min-w-0 lg:sticky lg:top-6 flex flex-col gap-3">
          {/* Gallery wrapped so an availability chip can overlay the
              top-left corner of the image frame. ProductGallery itself
              doesn't own badges. */}
          <div className="relative">
            <ProductGallery
              images={images}
              productName={p.nameDe}
              showSoldOut={!p.isAvailable}
            />
            {p.isAvailable && p.pricingMode !== "enquiry" && (
              <AvailabilityChip />
            )}
          </div>
          <p className="text-[13px] text-sage leading-[1.5] m-0">
            Jedes Arrangement wird von Hand gebunden — Blumen können je
            nach Saison leicht abweichen.
          </p>
        </div>

        <form className="flex-[5_1_380px] min-w-0 flex flex-col gap-7" onSubmit={(e) => e.preventDefault()}>
          {/* Head */}
          <div className="flex flex-col gap-3">
            {eyebrow && (
              <p className="m-0 text-[13px] tracking-[0.14em] uppercase text-rose font-semibold">
                {eyebrow}
              </p>
            )}
            <h1 className="m-0 font-display font-light text-bark text-[clamp(34px,3.4vw,46px)] leading-[1.08] tracking-[-0.015em]">
              {titleMain}
              {titleItalic && (
                <>
                  {" "}
                  <em className="italic">{titleItalic}</em>
                </>
              )}
            </h1>

            {p.pricingMode !== "enquiry" && (
              <p className="m-0 text-[14px] text-bark/70">
                Lieferung im Aargau ab CHF 12 ·{" "}
                <strong className="font-semibold text-bark">
                  gratis ab CHF 120
                </strong>
              </p>
            )}
          </div>

          {/* Buy box or enquiry hint */}
          {p.pricingMode === "enquiry" ? (
            <EnquiryBlock />
          ) : (
            <ProductVariantPicker productId={p.id} variants={variants} />
          )}

          {/* Colours (informational — colour is a product facet, not a
              selectable variant in our schema). */}
          {colours.length > 0 && p.pricingMode !== "enquiry" && (
            <fieldset className="border-0 p-0 m-0 min-w-0">
              <legend className="text-[0.78rem] font-semibold text-bark mb-3">
                Farbton{" "}
                <span className="font-normal text-sage">
                  — {colours.map((c) => c.nameDe).join(", ")}
                </span>
              </legend>
              <div className="flex flex-wrap gap-2.5">
                {colours.map((c) => (
                  <span
                    key={c.value}
                    title={c.nameDe}
                    aria-label={c.nameDe}
                    className="inline-block w-10 h-10 rounded-full border border-bark/20 p-1"
                  >
                    <span
                      aria-hidden
                      className="block w-full h-full rounded-full"
                      style={{
                        background:
                          c.hex ??
                          "conic-gradient(from 0deg, #F5F0E6, #E8A0BF, #C1272D, #E8853B, #F2C744, #6A8F4F, #6B5B95, #E4D9E8, #F5F0E6)",
                      }}
                    />
                  </span>
                ))}
              </div>
            </fieldset>
          )}

          {/* Trust row */}
          {p.pricingMode !== "enquiry" && <TrustRow />}

          {/* Accordions */}
          <div className="flex flex-col">
            {p.descriptionDe && (
              <Accordion label="Beschreibung" defaultOpen>
                <p className="text-[15px] text-bark/70 leading-[1.7] whitespace-pre-line m-0">
                  {p.descriptionDe}
                </p>
              </Accordion>
            )}
            <Accordion label="Lieferung">
              <p className="text-[15px] text-bark/70 leading-[1.7] m-0">
                Zwei Touren täglich um 10:00 und 16:00 — auch am Sonntag.
                Bestellschluss jeweils drei Stunden vor der Tour. Lieferung
                mit unserem eigenen Van in 27 Aargauer Postleitzahlen,
                ab CHF 12, gratis ab CHF 120.
              </p>
            </Accordion>
            <Accordion label="Pflegehinweise">
              <ul className="space-y-1.5 pl-4 list-disc marker:text-sage m-0">
                {CARE_STEPS.map((step) => (
                  <li
                    key={step}
                    className="text-[15px] text-bark/70 leading-[1.6]"
                  >
                    {step}
                  </li>
                ))}
              </ul>
            </Accordion>
            <Accordion label="Herkunft">
              <dl className="m-0 space-y-2.5">
                {ORIGIN_FACTS.map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="text-[0.68rem] tracking-[0.08em] uppercase font-semibold text-bark w-[110px] flex-shrink-0 pt-0.5">
                      {k}
                    </dt>
                    <dd className="text-[15px] text-bark/70 leading-[1.55]">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </Accordion>
          </div>
        </form>
      </div>

      {/* ---------- Related ---------- */}
      {related.length > 0 && firstCategory && (
        <section className="mt-12 lg:mt-16 flex flex-col gap-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="m-0 font-display font-light text-bark text-[clamp(28px,3vw,40px)] leading-[1.1]">
              Das könnte Ihnen <em className="italic">auch gefallen</em>
            </h2>
            <Link
              href={`/kategorie/${firstCategory.slug}`}
              className="text-[15px] font-semibold text-bark border-b border-bark pb-0.5 hover:text-rose hover:border-rose transition-colors"
            >
              Alle {firstCategory.nameDe}
            </Link>
          </div>
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {related.map((r) => (
              <li key={r.slug}>
                <ProductCard product={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AvailabilityChip() {
  return (
    <div className="absolute top-4 left-4 inline-flex items-center gap-2 bg-ivory/95 backdrop-blur-sm rounded-full px-3.5 py-2 text-[13px] font-semibold text-bark shadow-sm">
      <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden />
      Heute lieferbar
    </div>
  );
}

function TrustRow() {
  return (
    <ul className="m-0 p-5 list-none border-y border-mist grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px] leading-[1.4] text-bark/70">
      <li className="flex flex-col gap-1.5">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-rose"
          aria-hidden
        >
          <path d="M2 7h11v9H2z" />
          <path d="M13 10h4l3 3v3h-7z" />
          <circle cx="6" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
        Eigener Van, kein Kurier
      </li>
      <li className="flex flex-col gap-1.5">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-rose"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        Auch am Sonntag
      </li>
      <li className="flex flex-col gap-1.5">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-rose"
          aria-hidden
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
        TWINT &amp; Karte
      </li>
    </ul>
  );
}

function EnquiryBlock() {
  return (
    <div className="border-y border-mist py-5 space-y-2">
      <p className="font-display text-[1.6rem] font-normal text-bark leading-none m-0">
        Nur auf Anfrage
      </p>
      <p className="text-[0.85rem] text-sage m-0">
        Hochzeit, Trauer, Event, Gärtnerservice — bitte kontaktieren Sie uns
        direkt unter{" "}
        <a
          href="tel:+41565565609"
          className="text-rose hover:underline font-medium"
        >
          056 556 56 09
        </a>
        .
      </p>
    </div>
  );
}

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
      <summary className="flex items-center justify-between py-4 cursor-pointer list-none text-[15px] font-semibold text-bark hover:text-rose transition-colors">
        {label}
        <span
          aria-hidden
          className="text-[1.25rem] leading-none text-sage transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

/**
 * Split a product name for italic emphasis on the trailing fragment.
 * Priority: last comma, then last " in ", then last " – ", then last
 * two words. If splitting isn't natural, no italic fragment is used.
 */
function splitTitle(name: string): { titleMain: string; titleItalic: string | null } {
  const trimmed = name.trim();

  const commaIdx = trimmed.lastIndexOf(",");
  if (commaIdx > 0 && commaIdx < trimmed.length - 2) {
    return {
      titleMain: trimmed.slice(0, commaIdx).trim(),
      titleItalic: trimmed.slice(commaIdx + 1).trim(),
    };
  }

  for (const sep of [" in ", " aus ", " mit "]) {
    const idx = trimmed.lastIndexOf(sep);
    if (idx > 0) {
      return {
        titleMain: trimmed.slice(0, idx).trim(),
        titleItalic: trimmed.slice(idx).trim(),
      };
    }
  }

  // Fallback: no italic fragment. Cleaner than mandatory emphasis.
  return { titleMain: trimmed, titleItalic: null };
}

const CARE_STEPS = [
  "Stiele schräg anschneiden",
  "In frisches, lauwarmes Wasser stellen",
  "Alle zwei Tage Wasser wechseln",
  "Kühl und vor direkter Sonne geschützt aufstellen",
  "Welke Blätter entfernen",
];

const ORIGIN_FACTS: [string, string][] = [
  ["Werkstatt", "Magenta Blumen, Neuenhof AG"],
  ["Bindung", "Jeder Strauss von der Inhaberin persönlich gebunden"],
  ["Bezug", "Regional und über Schweizer Grosshandel eingekauft"],
];

// ------------------------------------------------------------------
// schema.org Product JSON-LD (unchanged behavior; kept as-is).
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
