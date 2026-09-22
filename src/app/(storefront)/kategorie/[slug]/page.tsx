import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import {
  category,
  product,
  productCategory,
} from "@/db/schema/catalogue";
import { ProductCard } from "@/components/storefront/product-card";
import { enrich } from "../../page";

// ISR: 5-min stale-while-revalidate. Admin edits call
// revalidatePath('/kategorie/[slug]', 'page') for immediate updates.
export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Category browse page. Works for both `range` and `occasion` category
 * kinds - the slug uniquely identifies which and the query is the same
 * either way (via product_category join).
 *
 * Only shows products that are: available OR out-of-stock (rule 7 -
 * greyed, not hidden). Excluded: archived, non-online-orderable, and
 * enquiry-only ones without proper display (those go through an
 * enquiry form flow later).
 */
export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;

  const [cat] = await db
    .select()
    .from(category)
    .where(eq(category.slug, slug))
    .limit(1);

  if (!cat) notFound();
  if (!cat.isOrderableOnline) {
    // Seasonal / not-orderable categories still show a page but with
    // an explanatory note - visitors following an old link land here
    // gracefully rather than 404.
  }

  // Products in this category, joined via product_category
  const productRows = await db
    .select({
      id: product.id,
      slug: product.slug,
      nameDe: product.nameDe,
      pricingMode: product.pricingMode,
      isAvailable: product.isAvailable,
      sortOrder: product.sortOrder,
    })
    .from(product)
    .innerJoin(productCategory, eq(productCategory.productId, product.id))
    .where(
      and(
        eq(productCategory.categoryId, cat.id),
        eq(product.isArchived, false),
        eq(product.isOnlineOrderable, true),
      ),
    )
    .orderBy(asc(product.sortOrder), asc(product.nameDe));

  const cards = await enrich(productRows);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      <header className="space-y-2">
        <div className="text-sm text-muted-foreground uppercase tracking-wide">
          {cat.kind === "occasion" ? "Anlass" : "Sortiment"}
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          {cat.nameDe}
        </h1>
      </header>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Zurzeit keine Produkte in dieser Kategorie.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
