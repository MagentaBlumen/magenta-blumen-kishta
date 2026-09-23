import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attribute,
  attributeValue,
  category,
  product,
  productAttributeValue,
  productCategory,
  productImage,
  productVariant,
} from "@/db/schema/catalogue";
import type { ProductCardData } from "@/components/storefront/product-card";

/**
 * Cached storefront queries.
 *
 * Pages are dynamic (dynamic = 'force-dynamic') so the Docker build
 * doesn't need a live DB to prerender - but each request re-uses the
 * result from the cache below rather than hitting Postgres every time.
 *
 * Cache tags let admin write actions bust exactly the right entries:
 *
 *   admin creates/edits product X in categories A, B ->
 *     revalidateTag('products')          - drops home + any list page
 *     revalidateTag(`product:${X.slug}`) - drops that product's detail
 *     revalidateTag(`category:A`)        - drops category A grid
 *     revalidateTag(`category:B`)        - drops category B grid
 *
 * All in src/app/(admin)/admin/produkte/actions.ts.
 *
 * TTL is 5 min. Set generously - most cache misses will come from
 * admin edits (tag invalidation) rather than the timer expiring.
 */

const REVALIDATE_SECONDS = 300;

// ---------- Featured products (home page) ----------

export const getFeaturedProducts = unstable_cache(
  async (): Promise<ProductCardData[]> => {
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

    return enrichProducts(rows);
  },
  ["storefront:featured"],
  { revalidate: REVALIDATE_SECONDS, tags: ["products"] },
);

// ---------- Home page occasion tiles ----------

export const getHomeOccasionCategories = unstable_cache(
  async (slugs: string[]) => {
    return db
      .select({
        id: category.id,
        slug: category.slug,
        nameDe: category.nameDe,
      })
      .from(category)
      .where(inArray(category.slug, slugs));
  },
  ["storefront:home-occasions"],
  { revalidate: REVALIDATE_SECONDS, tags: ["categories"] },
);

// ---------- Category page ----------

export function getCategoryBySlug(slug: string) {
  return unstable_cache(
    async () => {
      const [row] = await db
        .select()
        .from(category)
        .where(eq(category.slug, slug))
        .limit(1);
      return row ?? null;
    },
    ["storefront:category-by-slug", slug],
    { revalidate: REVALIDATE_SECONDS, tags: [`category:${slug}`, "categories"] },
  )();
}

export function getProductsInCategory(categoryId: number, categorySlug: string) {
  return unstable_cache(
    async (): Promise<ProductCardData[]> => {
      const rows = await db
        .select({
          id: product.id,
          slug: product.slug,
          nameDe: product.nameDe,
          pricingMode: product.pricingMode,
          isAvailable: product.isAvailable,
        })
        .from(product)
        .innerJoin(productCategory, eq(productCategory.productId, product.id))
        .where(
          and(
            eq(productCategory.categoryId, categoryId),
            eq(product.isArchived, false),
            eq(product.isOnlineOrderable, true),
          ),
        )
        .orderBy(asc(product.sortOrder), asc(product.nameDe));

      return enrichProducts(rows);
    },
    ["storefront:products-in-category", String(categoryId)],
    {
      revalidate: REVALIDATE_SECONDS,
      // Tagged by BOTH the category and 'products' so any product write
      // busts every category grid it might appear in.
      tags: [`category:${categorySlug}`, "products"],
    },
  )();
}

// ---------- Product detail page ----------

export function getProductBySlug(slug: string) {
  return unstable_cache(
    async () => {
      const [row] = await db
        .select()
        .from(product)
        .where(and(eq(product.slug, slug), eq(product.isArchived, false)))
        .limit(1);
      return row ?? null;
    },
    ["storefront:product-by-slug", slug],
    { revalidate: REVALIDATE_SECONDS, tags: [`product:${slug}`, "products"] },
  )();
}

export function getProductDetailBundle(productId: number, productSlug: string) {
  return unstable_cache(
    async () => {
      const [variants, images, colours, categories] = await Promise.all([
        db
          .select()
          .from(productVariant)
          .where(eq(productVariant.productId, productId))
          .orderBy(asc(productVariant.sortOrder), asc(productVariant.id)),
        db
          .select()
          .from(productImage)
          .where(eq(productImage.productId, productId))
          .orderBy(asc(productImage.sortOrder), asc(productImage.id)),
        db
          .select({
            value: attributeValue.value,
            nameDe: attributeValue.nameDe,
            hex: attributeValue.hex,
          })
          .from(productAttributeValue)
          .innerJoin(
            attributeValue,
            eq(attributeValue.id, productAttributeValue.attributeValueId),
          )
          .innerJoin(attribute, eq(attribute.id, attributeValue.attributeId))
          .where(
            and(
              eq(productAttributeValue.productId, productId),
              eq(attribute.key, "colour"),
            ),
          ),
        db
          .select({
            slug: category.slug,
            nameDe: category.nameDe,
            kind: category.kind,
          })
          .from(category)
          .innerJoin(
            productCategory,
            eq(productCategory.categoryId, category.id),
          )
          .where(eq(productCategory.productId, productId)),
      ]);

      return { variants, images, colours, categories };
    },
    ["storefront:product-detail", String(productId)],
    { revalidate: REVALIDATE_SECONDS, tags: [`product:${productSlug}`, "products"] },
  )();
}

// ---------- Colour facet page (/farbe/[slug]) ----------

export function getColourBySlug(slug: string) {
  return unstable_cache(
    async () => {
      const [row] = await db
        .select({
          id: attributeValue.id,
          value: attributeValue.value,
          nameDe: attributeValue.nameDe,
          hex: attributeValue.hex,
        })
        .from(attributeValue)
        .innerJoin(attribute, eq(attribute.id, attributeValue.attributeId))
        .where(
          and(eq(attribute.key, "colour"), eq(attributeValue.value, slug)),
        )
        .limit(1);
      return row ?? null;
    },
    ["storefront:colour-by-slug", slug],
    { revalidate: REVALIDATE_SECONDS, tags: ["categories"] },
  )();
}

export function getProductsInColour(colourId: number) {
  return unstable_cache(
    async (): Promise<ProductCardData[]> => {
      const rows = await db
        .select({
          id: product.id,
          slug: product.slug,
          nameDe: product.nameDe,
          pricingMode: product.pricingMode,
          isAvailable: product.isAvailable,
        })
        .from(product)
        .innerJoin(
          productAttributeValue,
          eq(productAttributeValue.productId, product.id),
        )
        .where(
          and(
            eq(productAttributeValue.attributeValueId, colourId),
            eq(product.isArchived, false),
            eq(product.isOnlineOrderable, true),
          ),
        )
        .orderBy(asc(product.sortOrder), asc(product.nameDe));

      return enrichProducts(rows);
    },
    ["storefront:products-in-colour", String(colourId)],
    { revalidate: REVALIDATE_SECONDS, tags: ["products"] },
  )();
}

// ---------- Sitemap: all products + categories ----------

export const getAllProductsForSitemap = unstable_cache(
  async () => {
    return db
      .select({
        slug: product.slug,
        updatedAt: product.updatedAt,
      })
      .from(product)
      .where(
        and(
          eq(product.isArchived, false),
          eq(product.isOnlineOrderable, true),
        ),
      );
  },
  ["storefront:sitemap-products"],
  { revalidate: REVALIDATE_SECONDS, tags: ["products"] },
);

export const getAllCategoriesForSitemap = unstable_cache(
  async () => {
    return db
      .select({
        slug: category.slug,
      })
      .from(category)
      .where(eq(category.isOrderableOnline, true));
  },
  ["storefront:sitemap-categories"],
  { revalidate: REVALIDATE_SECONDS, tags: ["categories"] },
);

// ---------- Shared enrichment (image + variant prices) ----------

async function enrichProducts(
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
