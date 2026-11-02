import { asc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { product, productImage, productVariant } from "@/db/schema/catalogue";
import { ProdukteList } from "./_components/produkte-list";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ filter?: string }>;
};

/**
 * Produkte overview. Server component loads rows + a thumbnail for
 * each; the ProdukteList client component owns the selection state
 * and the bulk-archive bar.
 *
 * Filter is URL-driven (`?filter=aktiv|archiviert|ausverkauft`) so the
 * active-tab state survives a hard reload.
 *
 * No pagination yet - at florist scale the catalogue is under a few
 * hundred rows. If this grows beyond ~500, add it then.
 */
export default async function ProdukteListPage({ searchParams }: PageProps) {
  const { filter: rawFilter } = await searchParams;
  const filter = normaliseFilter(rawFilter);

  const products = await db
    .select({
      id: product.id,
      slug: product.slug,
      nameDe: product.nameDe,
      pricingMode: product.pricingMode,
      isAvailable: product.isAvailable,
      isOnlineOrderable: product.isOnlineOrderable,
      isArchived: product.isArchived,
      sortOrder: product.sortOrder,
    })
    .from(product)
    .orderBy(asc(product.isArchived), asc(product.sortOrder), asc(product.nameDe));

  const productIds = products.map((p) => p.id);

  // Pull images + variants in two bulk queries, group in JS. Correlated
  // subqueries from a `sql` template were unreliable in this version of
  // Drizzle - the outer-table column reference didn't always rewrite
  // right inside the inner SELECT.
  const [images, variants] = productIds.length === 0
    ? [[], []]
    : await Promise.all([
        db
          .select({
            productId: productImage.productId,
            variantId: productImage.variantId,
            url: productImage.url,
            altDe: productImage.altDe,
            sortOrder: productImage.sortOrder,
            id: productImage.id,
          })
          .from(productImage)
          .where(inArray(productImage.productId, productIds)),
        db
          .select({
            productId: productVariant.productId,
            priceGross: productVariant.priceGross,
            salePriceGross: productVariant.salePriceGross,
            isAvailable: productVariant.isAvailable,
          })
          .from(productVariant)
          .where(inArray(productVariant.productId, productIds)),
      ]);

  // Primary image per product: prefer variant_id IS NULL (product-level),
  // then lowest sort_order, then lowest id.
  const imageByProduct = new Map<number, { url: string; alt: string | null }>();
  const sorted = [...images].sort((a, b) => {
    const aPrim = a.variantId === null ? 0 : 1;
    const bPrim = b.variantId === null ? 0 : 1;
    if (aPrim !== bPrim) return aPrim - bPrim;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
  for (const img of sorted) {
    if (!imageByProduct.has(img.productId)) {
      imageByProduct.set(img.productId, { url: img.url, alt: img.altDe });
    }
  }

  const variantsByProduct = new Map<
    number,
    { prices: string[]; variantCount: number; anyAvailable: boolean }
  >();
  for (const v of variants) {
    const bucket = variantsByProduct.get(v.productId) ?? {
      prices: [],
      variantCount: 0,
      anyAvailable: false,
    };
    const effective = v.salePriceGross ?? v.priceGross;
    bucket.prices.push(effective);
    bucket.variantCount += 1;
    if (v.isAvailable) bucket.anyAvailable = true;
    variantsByProduct.set(v.productId, bucket);
  }

  const rows = products.map((p) => {
    const vs = variantsByProduct.get(p.id);
    const img = imageByProduct.get(p.id);
    return {
      id: p.id,
      slug: p.slug,
      nameDe: p.nameDe,
      pricingMode: p.pricingMode,
      isAvailable: p.isAvailable,
      isOnlineOrderable: p.isOnlineOrderable,
      isArchived: p.isArchived,
      sortOrder: p.sortOrder,
      imageUrl: img?.url ?? null,
      imageAlt: img?.alt ?? null,
      prices: vs?.prices ?? [],
      variantCount: vs?.variantCount ?? 0,
    };
  });

  const counts = {
    all: rows.length,
    aktiv: rows.filter((r) => !r.isArchived && r.isAvailable).length,
    archiviert: rows.filter((r) => r.isArchived).length,
    ausverkauft: rows.filter((r) => !r.isAvailable && !r.isArchived).length,
  };

  const filtered = rows.filter((r) => {
    switch (filter) {
      case "aktiv":
        return !r.isArchived && r.isAvailable;
      case "archiviert":
        return r.isArchived;
      case "ausverkauft":
        return !r.isAvailable && !r.isArchived;
      case "alle":
      default:
        return true;
    }
  });

  return <ProdukteList rows={filtered} filter={filter} counts={counts} />;
}

function normaliseFilter(
  raw: string | undefined,
): "alle" | "aktiv" | "archiviert" | "ausverkauft" {
  if (raw === "aktiv" || raw === "archiviert" || raw === "ausverkauft") {
    return raw;
  }
  return "alle";
}
