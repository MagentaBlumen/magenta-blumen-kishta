import { asc, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { product, productVariant } from "@/db/schema/catalogue";
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
      // First image by sort_order. One correlated subquery per row;
      // fine at florist scale (we're reading tens, not thousands).
      imageUrl: sql<string | null>`(
        SELECT url FROM product_image
        WHERE product_id = ${product.id} AND variant_id IS NULL
        ORDER BY sort_order ASC, id ASC
        LIMIT 1
      )`,
      imageAlt: sql<string | null>`(
        SELECT alt_de FROM product_image
        WHERE product_id = ${product.id} AND variant_id IS NULL
        ORDER BY sort_order ASC, id ASC
        LIMIT 1
      )`,
    })
    .from(product)
    .orderBy(asc(product.isArchived), asc(product.sortOrder), asc(product.nameDe));

  // Load every variant price in one shot, group by productId in JS.
  const productIds = products.map((p) => p.id);
  const variants = productIds.length === 0
    ? []
    : await db
        .select({
          productId: productVariant.productId,
          priceGross: productVariant.priceGross,
          salePriceGross: productVariant.salePriceGross,
          isAvailable: productVariant.isAvailable,
        })
        .from(productVariant)
        .where(inArray(productVariant.productId, productIds));

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
    return {
      id: p.id,
      slug: p.slug,
      nameDe: p.nameDe,
      pricingMode: p.pricingMode,
      isAvailable: p.isAvailable,
      isOnlineOrderable: p.isOnlineOrderable,
      isArchived: p.isArchived,
      sortOrder: p.sortOrder,
      imageUrl: p.imageUrl,
      imageAlt: p.imageAlt,
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
