import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";
import {
  getCategoryBySlug,
  getProductsInCategory,
} from "@/lib/cached-storefront";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Static slug -> hero image map. Categories don't carry an image_url
 * column in the DB (skipping the schema change until Sandra decides
 * whether every category deserves its own hero). Slugs not in this
 * map fall back to the shop cover image.
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
    description: `${cat.nameDe} — ${kind} bei Magenta Blumen. Blumen aus Neuenhof, Lieferung im Aargau.`,
    alternates: { canonical: `/kategorie/${slug}` },
  };
}

/**
 * Category browse page. Works for both `range` and `occasion` kinds -
 * slug uniquely identifies which, query is the same via
 * product_category join.
 *
 * Rule 7 (CLAUDE.md): sold-out products are dimmed, not hidden. Handled
 * inside ProductCard; the query intentionally includes them.
 */
export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();

  const cards = await getProductsInCategory(cat.id, cat.slug);
  const heroImage = CATEGORY_HERO_IMAGES[cat.slug] ?? CATEGORY_HERO_FALLBACK;
  const eyebrow = cat.kind === "occasion" ? "Nach Anlass" : "Nach Sortiment";

  return (
    <>
      {/* -------- Hero band -------- */}
      <section className="relative h-[280px] lg:h-[340px] overflow-hidden bg-mist">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImage}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(42,31,26,0.72) 0%, rgba(42,31,26,0.35) 55%, rgba(42,31,26,0.05) 100%)",
          }}
        />
        <div className="relative h-full max-w-7xl mx-auto px-4 lg:px-6 flex items-center">
          <div className="max-w-md">
            <p className="text-[0.68rem] tracking-[0.2em] uppercase text-blush font-medium mb-3">
              {eyebrow}
            </p>
            <h1 className="font-display font-light text-cream text-[clamp(2.2rem,4vw,3.2rem)] leading-[1.1]">
              {cat.nameDe}
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
            {cat.nameDe}
          </span>
        </nav>
      </div>

      {/* -------- Product grid -------- */}
      <section className="max-w-7xl mx-auto px-4 lg:px-6 py-10 lg:py-14">
        {cards.length === 0 ? (
          <div className="border border-dashed border-mist p-12 text-center text-sage text-[0.85rem] max-w-2xl mx-auto">
            Zurzeit keine Produkte in dieser Kategorie.
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
