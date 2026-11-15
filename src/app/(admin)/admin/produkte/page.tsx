import Link from "next/link";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { product, productImage, productVariant } from "@/db/schema/catalogue";
import {
  ProdukteGrid,
  type Counts,
  type ProduktRow,
} from "@/components/admin/produkte-grid";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

// Produkte overview. Server loads rows + thumbnail + variants; the
// grid is a client component owning the local search box + the
// "Ausverkauft" quick toggle (toggleProductAvailabilityAction).
//
// Tab is URL-driven (`?tab=sold|archived`) so the active view survives
// hard reloads. No pagination — florist scale.
export default async function ProdukteListPage({ searchParams }: PageProps) {
  const { tab: rawTab } = await searchParams;
  const tab = normaliseTab(rawTab);

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
  const [images, variants] =
    productIds.length === 0
      ? [[] as Awaited<ReturnType<typeof fetchImages>>, [] as Awaited<ReturnType<typeof fetchVariants>>]
      : await Promise.all([fetchImages(productIds), fetchVariants(productIds)]);

  // Primary image per product: variant_id IS NULL first, then lowest
  // sort_order, then lowest id. Matches storefront logic.
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

  const pricesByProduct = new Map<number, string[]>();
  for (const v of variants) {
    const bucket = pricesByProduct.get(v.productId) ?? [];
    bucket.push(v.salePriceGross ?? v.priceGross);
    pricesByProduct.set(v.productId, bucket);
  }

  const rows: ProduktRow[] = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    nameDe: p.nameDe,
    pricingMode: p.pricingMode,
    isAvailable: p.isAvailable,
    isOnlineOrderable: p.isOnlineOrderable,
    isArchived: p.isArchived,
    imageUrl: imageByProduct.get(p.id)?.url ?? null,
    imageAlt: imageByProduct.get(p.id)?.alt ?? null,
    prices: pricesByProduct.get(p.id) ?? [],
  }));

  const counts: Counts = {
    all: rows.filter((r) => !r.isArchived).length,
    sold: rows.filter((r) => !r.isAvailable && !r.isArchived).length,
    archived: rows.filter((r) => r.isArchived).length,
  };

  const filtered = rows.filter((r) => {
    if (tab === "archived") return r.isArchived;
    if (tab === "sold") return !r.isAvailable && !r.isArchived;
    return !r.isArchived; // 'all' excludes archived
  });

  const subline = `${counts.all} ${counts.all === 1 ? "Produkt" : "Produkte"}`;

  return (
    <>
      <div className="adm-head">
        <div className="adm-head__text">
          <h1 className="adm-title">Produkte</h1>
          <p className="adm-sub">{subline}</p>
        </div>
        <Link className="btn btn--main" href="/admin/produkte/neu">
          <svg
            className="icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Neues Produkt
        </Link>
      </div>

      <ProdukteGrid rows={filtered} counts={counts} tab={tab} />
    </>
  );
}

function fetchImages(productIds: number[]) {
  return db
    .select({
      productId: productImage.productId,
      variantId: productImage.variantId,
      url: productImage.url,
      altDe: productImage.altDe,
      sortOrder: productImage.sortOrder,
      id: productImage.id,
    })
    .from(productImage)
    .where(inArray(productImage.productId, productIds));
}

function fetchVariants(productIds: number[]) {
  return db
    .select({
      productId: productVariant.productId,
      priceGross: productVariant.priceGross,
      salePriceGross: productVariant.salePriceGross,
    })
    .from(productVariant)
    .where(inArray(productVariant.productId, productIds));
}

function normaliseTab(raw: string | undefined): "all" | "sold" | "archived" {
  if (raw === "sold" || raw === "archived") return raw;
  return "all";
}
