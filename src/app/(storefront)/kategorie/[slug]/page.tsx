import type { Metadata } from "next";
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

// Per-page metadata: title + description tied to the category name so
// each /kategorie/<slug> URL has a unique, indexable snippet.
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

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-12 lg:py-20">
      <header className="text-center mb-10 lg:mb-14">
        <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium mb-3">
          {cat.kind === "occasion" ? "Anlass" : "Sortiment"}
        </p>
        <h1 className="font-display font-light text-bark text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.1]">
          {cat.nameDe}
        </h1>
      </header>

      {cards.length === 0 ? (
        <div className="border border-dashed border-mist p-12 text-center text-sage text-[0.85rem] max-w-2xl mx-auto">
          Zurzeit keine Produkte in dieser Kategorie.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
          {cards.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
