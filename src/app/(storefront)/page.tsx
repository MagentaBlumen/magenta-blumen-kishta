import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  category,
  product,
  productCategory,
  productImage,
  productVariant,
} from "@/db/schema/catalogue";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";

/**
 * Storefront home page.
 *
 * Two sections for MVP:
 *   1. "Anlass" tiles (occasion-first navigation - CLAUDE.md is
 *      explicit that people think "birthday for my mother" not
 *      "cut flowers").
 *   2. "Neu im Shop" - the most recently created available products,
 *      not archived, online-orderable.
 *
 * No hero image / storytelling section yet - that's design work for
 * later. This page has to be functional first.
 */
export default async function HomePage() {
  // ---- Occasions (for the tile grid) ----
  const now = new Date().toISOString().slice(0, 10);
  const occasionRows = await db
    .select({
      id: category.id,
      slug: category.slug,
      nameDe: category.nameDe,
      isSeasonal: category.isSeasonal,
      activeFrom: category.activeFrom,
      activeTo: category.activeTo,
    })
    .from(category)
    .where(
      and(
        eq(category.kind, "occasion"),
        eq(category.isOrderableOnline, true),
      ),
    )
    .orderBy(asc(category.sortOrder));

  const activeOccasions = occasionRows.filter((c) => {
    if (!c.isSeasonal) return true;
    // Seasonal: only show inside the active-from/to window
    if (!c.activeFrom || !c.activeTo) return true;
    return c.activeFrom <= now && now <= c.activeTo;
  });

  // ---- Featured / newest products ----
  const featured = await loadFeaturedProducts();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-16">
      {/* Hero */}
      <section className="space-y-3 text-center max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          Frische Blumen aus Neuenhof
        </h1>
        <p className="text-muted-foreground">
          Lieferung im Aargau — zwei Touren täglich. Auch am Sonntag.
        </p>
      </section>

      {/* Occasion tiles */}
      <section className="space-y-6">
        <h2 className="text-2xl font-medium">«Für welchen Anlass?»</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {activeOccasions.map((c) => (
            <Link
              key={c.id}
              href={`/kategorie/${c.slug}`}
              className="rounded-lg border bg-card p-6 text-center transition-colors hover:border-primary hover:bg-muted"
            >
              <div className="font-medium">{c.nameDe}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-medium">Neu im Shop</h2>
          <Link
            href="/kategorie/alle-anlaesse"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Alle ansehen →
          </Link>
        </div>
        {featured.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            Noch keine Produkte im Shop.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featured.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function loadFeaturedProducts(): Promise<ProductCardData[]> {
  const products = await db
    .select({
      id: product.id,
      slug: product.slug,
      nameDe: product.nameDe,
      pricingMode: product.pricingMode,
      isAvailable: product.isAvailable,
    })
    .from(product)
    .where(
      and(
        eq(product.isArchived, false),
        eq(product.isOnlineOrderable, true),
      ),
    )
    .orderBy(desc(product.createdAt))
    .limit(8);

  return enrich(products);
}

/**
 * Load the primary image + variant prices for a set of products in
 * bulk (one query per join, not N+1).
 */
export async function enrich(
  products: Array<{
    id: number;
    slug: string;
    nameDe: string;
    pricingMode: "variant" | "per_unit" | "enquiry";
    isAvailable: boolean;
  }>,
): Promise<ProductCardData[]> {
  if (products.length === 0) return [];
  const ids = products.map((p) => p.id);

  const [images, variants] = await Promise.all([
    db
      .select({
        productId: productImage.productId,
        url: productImage.url,
        altDe: productImage.altDe,
        sortOrder: productImage.sortOrder,
      })
      .from(productImage)
      .where(inArray(productImage.productId, ids))
      .orderBy(asc(productImage.sortOrder), asc(productImage.id)),
    db
      .select({
        productId: productVariant.productId,
        priceGross: productVariant.priceGross,
        isAvailable: productVariant.isAvailable,
      })
      .from(productVariant)
      .where(inArray(productVariant.productId, ids))
      .orderBy(asc(productVariant.sortOrder), asc(productVariant.id)),
  ]);

  // Group by product id
  const firstImageFor = new Map<number, (typeof images)[number]>();
  for (const img of images) {
    if (!firstImageFor.has(img.productId)) {
      firstImageFor.set(img.productId, img);
    }
  }
  const variantsFor = new Map<number, string[]>();
  for (const v of variants) {
    if (!v.isAvailable) continue;
    const arr = variantsFor.get(v.productId) ?? [];
    arr.push(v.priceGross);
    variantsFor.set(v.productId, arr);
  }

  return products.map((p) => {
    const img = firstImageFor.get(p.id);
    return {
      slug: p.slug,
      nameDe: p.nameDe,
      pricingMode: p.pricingMode,
      isAvailable: p.isAvailable,
      imageUrl: img?.url ?? null,
      imageAlt: img?.altDe ?? null,
      variantPrices: variantsFor.get(p.id) ?? [],
    };
  });
}
