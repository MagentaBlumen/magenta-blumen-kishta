import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  product,
  productImage,
  productVariant,
} from "@/db/schema/catalogue";

export type AddonChoice = {
  productId: number;
  variantId: number;
  nameDe: string;
  priceGross: string;
  imageUrl: string | null;
};

// All active add-on products with their primary (cheapest, first)
// variant and a thumbnail. An add-on is defined by product.is_addon.
// Admin manages this list via the regular product edit page.
//
// `excludeProductId` lets callers drop the current PDP's product from
// the list — useful when that product is itself an add-on, so a
// chocolate-box PDP doesn't offer a chocolate box as an add-on.
//
// Scope: the current catalogue model has a single global list — any
// add-on can accompany any bouquet. Relating specific addons to
// specific parents (category or product rules) is a future refinement.
export async function fetchAvailableAddons({
  excludeProductId,
}: {
  excludeProductId?: number;
} = {}): Promise<AddonChoice[]> {
  const products = await db
    .select({
      id: product.id,
      nameDe: product.nameDe,
    })
    .from(product)
    .where(
      and(
        eq(product.isAddon, true),
        eq(product.isArchived, false),
        eq(product.isAvailable, true),
        eq(product.isOnlineOrderable, true),
      ),
    )
    .orderBy(asc(product.sortOrder), asc(product.nameDe));

  const filtered =
    excludeProductId != null
      ? products.filter((p) => p.id !== excludeProductId)
      : products;
  if (filtered.length === 0) return [];

  const productIds = filtered.map((p) => p.id);

  // Pick one variant per product — the first available by sort_order.
  const variants = await db
    .select({
      id: productVariant.id,
      productId: productVariant.productId,
      priceGross: productVariant.priceGross,
      salePriceGross: productVariant.salePriceGross,
      isAvailable: productVariant.isAvailable,
      sortOrder: productVariant.sortOrder,
    })
    .from(productVariant)
    .where(eq(productVariant.isAvailable, true))
    .orderBy(asc(productVariant.productId), asc(productVariant.sortOrder));

  const firstVariantByProduct = new Map<number, (typeof variants)[number]>();
  for (const v of variants) {
    if (!productIds.includes(v.productId)) continue;
    if (!firstVariantByProduct.has(v.productId)) {
      firstVariantByProduct.set(v.productId, v);
    }
  }

  // Primary product-level image per product (variant_id IS NULL preferred).
  const images = await db
    .select({
      productId: productImage.productId,
      variantId: productImage.variantId,
      url: productImage.url,
      sortOrder: productImage.sortOrder,
      id: productImage.id,
    })
    .from(productImage);

  const sortedImages = images
    .filter((i) => productIds.includes(i.productId))
    .sort((a, b) => {
      const aPrim = a.variantId === null ? 0 : 1;
      const bPrim = b.variantId === null ? 0 : 1;
      if (aPrim !== bPrim) return aPrim - bPrim;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.id - b.id;
    });

  const imageByProduct = new Map<number, string>();
  for (const i of sortedImages) {
    if (!imageByProduct.has(i.productId)) {
      imageByProduct.set(i.productId, i.url);
    }
  }

  return filtered
    .map((p): AddonChoice | null => {
      const v = firstVariantByProduct.get(p.id);
      if (!v) return null;
      return {
        productId: p.id,
        variantId: v.id,
        nameDe: p.nameDe,
        priceGross: v.salePriceGross ?? v.priceGross,
        imageUrl: imageByProduct.get(p.id) ?? null,
      };
    })
    .filter((x): x is AddonChoice => x !== null);
}
