import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryBrowser } from "@/components/storefront/category-browser";
import {
  getCategoriesByKind,
  getCategoryBySlug,
  getProductsInCategory,
} from "@/lib/cached-storefront";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Slug -> hero image. Categories don't carry an image_url column yet
 * (skipped the schema change until Sandra decides whether every
 * category deserves one). Unmapped slugs fall back to the shop cover.
 */
const CATEGORY_HERO_IMAGES: Record<string, string> = {
  geburtstag: "/images/birthday.jpg",
  liebe: "/images/valentines.jpeg",
  danke: "/images/danke.jpg",
  trauer: "/images/funeral.jpg",
  blumenstraeusse: "/images/daughter-about-to-suprise-mom-with-flowers.jpg",
  rosen: "/images/kaboompics_beautiful-bouquet-of-white-flowers-on-a-table-2778.jpg",
  trockenblumen: "/images/kaboompics_multi-colored-flowers-in-vases-5924.jpg",
};
const CATEGORY_HERO_FALLBACK = "/images/FrontCoverPageImage.jpg";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return { title: "Kategorie nicht gefunden" };

  const kind = cat.kind === "occasion" ? "Anlass" : "Sortiment";
  return {
    title: cat.nameDe,
    description: `${cat.nameDe} · ${kind} bei Magenta Blumen. Blumen aus Neuenhof, Lieferung im Aargau.`,
    alternates: { canonical: `/kategorie/${slug}` },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();

  const cards = await getProductsInCategory(cat.id, cat.slug);
  const heroImage = CATEGORY_HERO_IMAGES[cat.slug] ?? CATEGORY_HERO_FALLBACK;
  const eyebrow = cat.kind === "occasion" ? "Nach Anlass" : "Nach Sortiment";

  // Enrich cards with a one-off "tag" so the ProductCard shows
  // Heute lieferbar / Auf Anfrage without us touching ProductCard
  // itself. Sold-out handling is already inside ProductCard.
  const enrichedCards = cards.map((p) => {
    let tag: string | null = null;
    if (p.pricingMode === "enquiry") tag = "Auf Anfrage";
    else if (p.isAvailable) tag = "Heute lieferbar";
    return { ...p, tag };
  });

  // Occasion chip row: only on occasion-kind pages. Fetch ALL occasion
  // categories so the chips can switch between them.
  const occasionChips =
    cat.kind === "occasion" ? await getCategoriesByKind("occasion") : [];

  const { titleMain, titleItalic } = splitTitle(cat.nameDe);

  return (
    <>
      {/* ========== Photo banner ========== */}
      <section className="relative overflow-hidden bg-[#3A2E2C] text-ivory">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImage}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover object-[center_40%]"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(43,29,27,0.78) 0%, rgba(43,29,27,0.45) 45%, rgba(43,29,27,0.05) 80%)",
          }}
        />
        <div className="relative z-10 max-w-[1280px] mx-auto px-4 lg:px-8 py-7 pb-14 min-h-[360px] flex flex-col justify-between gap-10">
          <nav
            aria-label="Brotkrümelnavigation"
            className="text-[13px] flex flex-wrap gap-2 text-ivory/85"
          >
            <Link href="/" className="hover:text-ivory transition-colors">
              Startseite
            </Link>
            <span aria-hidden>/</span>
            <span aria-current="page" className="text-ivory">
              {cat.nameDe}
            </span>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-4 gap-x-12">
            <div className="flex flex-col gap-3.5 max-w-[640px]">
              <p className="m-0 text-[13px] tracking-[0.14em] uppercase text-blush font-semibold">
                {eyebrow}
              </p>
              <h1 className="m-0 font-display font-light text-ivory text-[clamp(44px,5.2vw,72px)] leading-[1.02] tracking-[-0.02em]">
                {titleMain}
                {titleItalic && (
                  <>
                    {" "}
                    <em className="italic">{titleItalic}</em>
                  </>
                )}
              </h1>
              <p className="m-0 text-[17px] text-ivory/90 leading-[1.6]">
                Von Hand gebunden in Neuenhof und mit unserem eigenen Van
                geliefert — zweimal täglich, auch am Sonntag.
              </p>
            </div>

            <div className="flex items-center gap-3 px-4 py-3.5 rounded bg-ivory text-bark shadow-lg">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-rose flex-shrink-0"
                aria-hidden
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <div className="flex flex-col">
                <span className="text-[12px] font-semibold tracking-[0.1em] uppercase text-sage">
                  Zwei Touren täglich
                </span>
                <span className="text-[15px] text-bark">
                  <strong className="font-semibold">10:00 &amp; 16:00</strong>
                  <span className="text-bark/70"> · auch sonntags</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-[1280px] mx-auto px-4 lg:px-8 py-10 lg:py-12 flex flex-col gap-10">
        {/* Occasion chips — only on occasion pages */}
        {occasionChips.length > 0 && (
          <nav
            aria-label="Anlass wählen"
            className="flex flex-wrap gap-2"
          >
            {occasionChips.map((c) => {
              const active = c.slug === cat.slug;
              return (
                <Link
                  key={c.slug}
                  href={`/kategorie/${c.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center h-11 px-5 rounded-full border text-[14px] transition-colors ${
                    active
                      ? "bg-bark border-bark text-ivory font-semibold"
                      : "border-bark/20 text-bark/70 font-medium hover:border-bark hover:text-bark"
                  }`}
                >
                  {c.nameDe}
                </Link>
              );
            })}
          </nav>
        )}

        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-mist p-12 text-center text-sage text-[0.9rem] max-w-2xl mx-auto">
            Zurzeit keine Produkte in dieser Kategorie — bitte rufen Sie uns
            an, wir helfen gern:{" "}
            <a href="tel:+41565565609" className="text-rose hover:underline">
              056 556 56 09
            </a>
            .
          </div>
        ) : (
          <CategoryBrowser cards={enrichedCards} />
        )}
      </main>
    </>
  );
}

function splitTitle(name: string): { titleMain: string; titleItalic: string | null } {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  if (words.length < 2) return { titleMain: trimmed, titleItalic: null };

  for (const sep of [" für ", " mit ", " aus ", " zum ", " zur ", " & ", " und "]) {
    const idx = trimmed.lastIndexOf(sep);
    if (idx > 0 && idx < trimmed.length - 2) {
      return {
        titleMain: trimmed.slice(0, idx).trim(),
        titleItalic: trimmed.slice(idx).trim(),
      };
    }
  }

  // Fallback: emphasise the last word only.
  const last = words.pop() ?? "";
  return { titleMain: words.join(" "), titleItalic: last };
}
