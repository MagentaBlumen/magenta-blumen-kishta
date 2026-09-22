export const dynamic = 'force-dynamic';

import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  category,
  product,
  productImage,
  productVariant,
} from "@/db/schema/catalogue";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";
import { Hero } from "@/components/storefront/hero";
import { TrustStrip } from "@/components/storefront/trust-strip";
import { OccasionTile } from "@/components/storefront/occasion-tile";
import { EditorialFeature } from "@/components/storefront/editorial-feature";

// ISR: prerender at build, refresh every 5 min. Admin write actions
// call revalidatePath('/') for immediate updates.
export const revalidate = 300;

/**
 * Home page - full Figma layout, wired to our real DB.
 *
 * Sections top-to-bottom:
 *   Hero (image + serif heading with italic emphasis + CTA)
 *   TrustStrip (4 icons - real delivery model, not "next-day nationwide")
 *   Featured products grid ("Die schönsten Blüten dieser Woche") with
 *     a small filter row that maps to real range categories
 *   Occasion tiles ("Nach Anlass shoppen")
 *   Editorial feature (about the shop)
 */

// Hardcoded imagery for occasion tiles. When the category schema grows
// an image_url column we swap this for a DB read. Skipping the schema
// change until the design settles.
const OCCASION_TILE_IMAGES: Record<string, string> = {
  geburtstag:
    "https://images.unsplash.com/photo-1667010723263-8ad9a8f5f6c6?w=600&h=750&fit=crop&auto=format",
  liebe:
    "https://images.unsplash.com/photo-1561826336-37bdb1339994?w=600&h=750&fit=crop&auto=format",
  danke:
    "https://images.unsplash.com/photo-1589243853654-393fcf7c870b?w=600&h=750&fit=crop&auto=format",
  trauer:
    "https://images.unsplash.com/photo-1615488913817-095134dfeb54?w=600&h=750&fit=crop&auto=format",
};

// Occasions the home tile grid highlights. Keep to 4 - matches Figma
// visual weight. We deliberately don't show ALL occasion categories
// here (would be too dense); the header nav dropdown covers the full
// list.
const HOME_OCCASION_SLUGS = ["geburtstag", "liebe", "danke", "trauer"];

export default async function HomePage() {
  const [occasionRows, featured] = await Promise.all([
    db
      .select({
        id: category.id,
        slug: category.slug,
        nameDe: category.nameDe,
      })
      .from(category)
      .where(
        and(
          eq(category.kind, "occasion"),
          inArray(category.slug, HOME_OCCASION_SLUGS),
        ),
      ),
    loadFeaturedProducts(),
  ]);

  // Preserve HOME_OCCASION_SLUGS ordering (query returns in arbitrary
  // order via inArray).
  const occasionsInOrder = HOME_OCCASION_SLUGS.flatMap((slug) => {
    const row = occasionRows.find((r) => r.slug === slug);
    if (!row) return [];
    return [
      {
        slug: row.slug,
        nameDe: row.nameDe,
        imageUrl: OCCASION_TILE_IMAGES[row.slug] ?? "",
      },
    ];
  });

  return (
    <>
      <Hero />
      <TrustStrip />

      {/* -------- Featured products -------- */}
      <section className="max-w-7xl mx-auto px-4 lg:px-6 py-16 lg:py-24">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 lg:mb-14 gap-6">
          <div>
            <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium mb-3">
              Aktuell im Laden
            </p>
            <h2 className="font-display font-light text-bark text-[clamp(2rem,4vw,3.2rem)] leading-[1.1]">
              Die schönsten Blumen<br />
              <em>dieser Woche</em>
            </h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "Alle", href: "/kategorie/alle-anlaesse" },
              { label: "Blumensträusse", href: "/kategorie/blumenstraeusse" },
              { label: "Rosen", href: "/kategorie/rosen" },
              { label: "Zimmerpflanzen", href: "/kategorie/zimmerpflanzen" },
              { label: "Trockenblumen", href: "/kategorie/trockenblumen" },
            ].map((f) => (
              <Link
                key={f.label}
                href={f.href}
                className="px-5 py-2 text-[0.68rem] tracking-[0.12em] uppercase font-medium border border-mist text-bark hover:border-bark hover:bg-bark hover:text-ivory transition-colors"
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {featured.length === 0 ? (
          <div className="border border-dashed border-mist p-12 text-center text-sage text-[0.85rem]">
            Noch keine Produkte im Shop. Kommen Sie bald wieder vorbei.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
            {featured.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* -------- Occasion tiles -------- */}
      <section className="bg-cream py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-10 lg:mb-14">
            <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium mb-3">
              Nach Anlass shoppen
            </p>
            <h2 className="font-display font-light text-bark text-[clamp(1.8rem,3.5vw,2.8rem)] leading-[1.1]">
              Blumen für jeden <em>besonderen Moment</em>
            </h2>
          </div>
          <div className="hidden lg:grid lg:grid-cols-4 gap-3">
            {occasionsInOrder.map((occ) => (
              <OccasionTile key={occ.slug} occasion={occ} />
            ))}
          </div>
          <div className="lg:hidden flex gap-3 overflow-x-auto pb-2" style={{ scrollSnapType: "x mandatory" }}>
            {occasionsInOrder.map((occ) => (
              <div key={occ.slug + "-m"} className="flex-shrink-0 w-40" style={{ scrollSnapAlign: "start" }}>
                <OccasionTile occasion={occ} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------- Editorial feature -------- */}
      <EditorialFeature />
    </>
  );
}

async function loadFeaturedProducts(): Promise<ProductCardData[]> {
  const rows = await db
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

  return enrich(rows);
}

/**
 * Load the first image + available-variant prices for a set of products
 * in bulk (one query per join, not N+1).
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

  const firstImageFor = new Map<number, (typeof images)[number]>();
  for (const img of images) {
    if (!firstImageFor.has(img.productId)) firstImageFor.set(img.productId, img);
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
