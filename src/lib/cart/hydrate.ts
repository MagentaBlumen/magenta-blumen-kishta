import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  product,
  productImage,
  productVariant,
} from "@/db/schema/catalogue";
import { readCartCookie } from "./cookie";
import type { CartCookie, HydratedCart, HydratedCartLine } from "./types";

/**
 * Turn a cart cookie into a fully-priced cart, using LIVE product +
 * variant rows. This is the ONLY function allowed to invent a price for
 * a cart line - the cookie carries no prices, ever.
 *
 * A line whose product has been archived or whose variant has been
 * deleted is dropped silently and counted into `droppedCount` so the UI
 * can show a "some items were removed" notice.
 *
 * A line whose product OR variant is is_available=false is KEPT but
 * flagged - rule 7 (CLAUDE.md): sold-out renders greyed, not hidden.
 * Checkout blocks such lines at reserve time.
 */
export async function hydrateCart(): Promise<HydratedCart> {
  const cookie = await readCartCookie();
  return hydrateCartCookie(cookie);
}

// Split out so the checkout re-price step (5f) can hydrate a specific
// cookie value without reading the request cookie jar again.
export async function hydrateCartCookie(
  cookie: CartCookie,
): Promise<HydratedCart> {
  if (cookie.l.length === 0) {
    return { lines: [], subtotalGross: "0.00", droppedCount: 0 };
  }

  const productIds = Array.from(new Set(cookie.l.map((l) => l.p)));
  const variantIds = Array.from(new Set(cookie.l.map((l) => l.v)));

  const [products, variants, images] = await Promise.all([
    db
      .select({
        id: product.id,
        slug: product.slug,
        nameDe: product.nameDe,
        isAvailable: product.isAvailable,
        isArchived: product.isArchived,
        isOnlineOrderable: product.isOnlineOrderable,
      })
      .from(product)
      .where(inArray(product.id, productIds)),
    db
      .select({
        id: productVariant.id,
        productId: productVariant.productId,
        sizeLabelDe: productVariant.sizeLabelDe,
        priceGross: productVariant.priceGross,
        salePriceGross: productVariant.salePriceGross,
        isAvailable: productVariant.isAvailable,
      })
      .from(productVariant)
      .where(inArray(productVariant.id, variantIds)),
    db
      .select({
        productId: productImage.productId,
        url: productImage.url,
        altDe: productImage.altDe,
      })
      .from(productImage)
      .where(inArray(productImage.productId, productIds))
      .orderBy(asc(productImage.sortOrder), asc(productImage.id)),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const firstImageFor = new Map<number, (typeof images)[number]>();
  for (const img of images) {
    if (!firstImageFor.has(img.productId)) firstImageFor.set(img.productId, img);
  }

  const lines: HydratedCartLine[] = [];
  let droppedCount = 0;
  let subtotal = 0;

  for (const cookieLine of cookie.l) {
    const p = productById.get(cookieLine.p);
    const v = variantById.get(cookieLine.v);

    // Drop lines whose product/variant is gone. Also drop cross-linked
    // rows - a variant whose productId doesn't match the cookie's
    // productId means the cookie was tampered with or the variant was
    // reassigned; either way, don't render it.
    if (!p || !v || v.productId !== p.id) {
      droppedCount += 1;
      continue;
    }
    // Archived / not-orderable products get dropped too - they should
    // not have been in the cart, and if they were archived after adding,
    // they can no longer be checked out.
    if (p.isArchived || !p.isOnlineOrderable) {
      droppedCount += 1;
      continue;
    }

    const unitPrice = v.salePriceGross ?? v.priceGross;
    const unitPriceNum = Number(unitPrice);
    if (!Number.isFinite(unitPriceNum)) {
      // A price we can't parse can't be trusted - drop rather than
      // silently priced-at-zero.
      droppedCount += 1;
      continue;
    }
    const lineTotalNum = unitPriceNum * cookieLine.q;
    subtotal += lineTotalNum;

    const img = firstImageFor.get(p.id);

    lines.push({
      productId: p.id,
      variantId: v.id,
      qty: cookieLine.q,
      productSlug: p.slug,
      productNameDe: p.nameDe,
      variantLabelDe: v.sizeLabelDe,
      imageUrl: img?.url ?? null,
      imageAlt: img?.altDe ?? null,
      unitPriceGross: unitPriceNum.toFixed(2),
      lineTotalGross: lineTotalNum.toFixed(2),
      isAvailable: p.isAvailable && v.isAvailable,
    });
  }

  return {
    lines,
    subtotalGross: subtotal.toFixed(2),
    droppedCount,
  };
}

/** Cheap count of items for the header badge - reads the cookie only,
 *  never touches the DB. */
export async function cartItemCount(): Promise<number> {
  const cookie = await readCartCookie();
  let n = 0;
  for (const l of cookie.l) n += l.q;
  return n;
}
