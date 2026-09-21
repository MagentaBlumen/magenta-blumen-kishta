"use server";

import { revalidatePath } from "next/cache";
import { asc, eq, max } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { product, productImage, productVariant } from "@/db/schema/catalogue";
import {
  deleteObjects,
  keyFromPublicUrl,
  uploadObject,
} from "@/lib/r2";
import {
  isSupportedImageType,
  processImage,
  randomKeySegment,
} from "@/lib/images";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Nicht angemeldet");
}

/**
 * Upload a single image, attach to a product. Persists immediately -
 * the product form's Save button is NOT required to make an upload
 * take effect. That's deliberate: if the browser crashes mid-form,
 * the uploaded photo is still there and Sandra doesn't re-upload.
 */
export async function uploadProductImage(
  productId: number,
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Keine Datei erhalten");
  }
  if (file.size === 0) {
    throw new Error("Datei ist leer");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Datei ist grösser als 20 MB");
  }
  if (!isSupportedImageType(file.type)) {
    throw new Error(`Nicht unterstützter Dateityp: ${file.type}`);
  }

  // Confirm the product exists (cheap; also prevents a stray upload
  // from landing rows for a product that was just deleted).
  const [p] = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.id, productId))
    .limit(1);
  if (!p) throw new Error(`Produkt ${productId} existiert nicht`);

  const source = Buffer.from(await file.arrayBuffer());
  const processed = await processImage(source);

  // Object key layout: products/<productId>/<randomSegment>-<size>.<ext>
  // The random segment ties the two derivatives together and gives us
  // globally-unique paths so cache-busting works via URL change.
  const seg = randomKeySegment();
  const largeKey = `products/${productId}/${seg}-large.jpg`;
  const thumbKey = `products/${productId}/${seg}-thumb.webp`;

  const [largeUrl] = await Promise.all([
    uploadObject(largeKey, processed.large, "image/jpeg"),
    uploadObject(thumbKey, processed.thumb, "image/webp"),
  ]);

  // Next sort order = max(existing) + 1, so new photos land at the end.
  const [{ maxSort }] = await db
    .select({ maxSort: max(productImage.sortOrder) })
    .from(productImage)
    .where(eq(productImage.productId, productId));

  await db.insert(productImage).values({
    productId,
    variantId: null,
    url: largeUrl,
    altDe: null,
    width: processed.width,
    height: processed.height,
    sortOrder: (maxSort ?? -1) + 1,
  });

  revalidatePath(`/admin/produkte/${productId}`);
}

/**
 * Update editable metadata on an existing image (alt text + variant
 * assignment). Sort order and delete have their own actions because
 * they're per-button, not per-form.
 */
export async function updateProductImageMeta(
  imageId: number,
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const altRaw = String(formData.get("altDe") ?? "").trim();
  const altDe = altRaw || null;

  const variantRaw = String(formData.get("variantId") ?? "").trim();
  const variantId = variantRaw ? Number(variantRaw) : null;
  if (variantId !== null && !Number.isFinite(variantId)) {
    throw new Error("Ungültige Varianten-ID");
  }

  // Confirm the image + optional variant both belong to the same
  // product. Prevents cross-product tampering via crafted form data.
  const [img] = await db
    .select({
      id: productImage.id,
      productId: productImage.productId,
    })
    .from(productImage)
    .where(eq(productImage.id, imageId))
    .limit(1);
  if (!img) throw new Error(`Bild ${imageId} existiert nicht`);

  if (variantId !== null) {
    const [v] = await db
      .select({ productId: productVariant.productId })
      .from(productVariant)
      .where(eq(productVariant.id, variantId))
      .limit(1);
    if (!v) throw new Error(`Variante ${variantId} existiert nicht`);
    if (v.productId !== img.productId) {
      throw new Error("Variante gehört zu einem anderen Produkt");
    }
  }

  await db
    .update(productImage)
    .set({ altDe, variantId })
    .where(eq(productImage.id, imageId));

  revalidatePath(`/admin/produkte/${img.productId}`);
}

/**
 * Remove an image. Deletes both R2 derivatives AND the DB row in one
 * transaction; the R2 delete happens outside since it's a network call.
 * If the R2 delete fails after the DB row is gone we log and move on -
 * the object becomes orphaned in R2 but nothing links to it anymore.
 * A future janitor job can clean orphans by listing R2 and diffing
 * against product_image.url.
 */
export async function deleteProductImage(imageId: number): Promise<void> {
  await requireAdmin();

  const [img] = await db
    .select({
      id: productImage.id,
      productId: productImage.productId,
      url: productImage.url,
    })
    .from(productImage)
    .where(eq(productImage.id, imageId))
    .limit(1);
  if (!img) return; // idempotent

  await db.delete(productImage).where(eq(productImage.id, imageId));

  const largeKey = keyFromPublicUrl(img.url);
  if (largeKey) {
    // The thumb key mirrors the large key with a suffix swap.
    const thumbKey = largeKey.replace(/-large\.jpg$/, "-thumb.webp");
    try {
      await deleteObjects([largeKey, thumbKey]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[image delete] R2 delete failed for ${largeKey}`, err);
    }
  }

  revalidatePath(`/admin/produkte/${img.productId}`);
}

/**
 * Move an image one position up or down. Swaps sort_order with the
 * adjacent sibling. Load-all-then-index in JS - trivial cost at the
 * scale of a product's photos (< 20 typically).
 */
export async function moveProductImage(
  imageId: number,
  direction: "up" | "down",
): Promise<void> {
  await requireAdmin();

  const productIdForRevalidate = await db.transaction(async (tx) => {
    const [me] = await tx
      .select({
        id: productImage.id,
        productId: productImage.productId,
      })
      .from(productImage)
      .where(eq(productImage.id, imageId))
      .limit(1);
    if (!me) return null;

    const siblings = await tx
      .select({
        id: productImage.id,
        sortOrder: productImage.sortOrder,
      })
      .from(productImage)
      .where(eq(productImage.productId, me.productId))
      .orderBy(asc(productImage.sortOrder), asc(productImage.id));

    const myIdx = siblings.findIndex((s) => s.id === me.id);
    const targetIdx = direction === "up" ? myIdx - 1 : myIdx + 1;
    if (targetIdx < 0 || targetIdx >= siblings.length) return me.productId; // at edge

    const mine = siblings[myIdx];
    const other = siblings[targetIdx];

    // Three-step swap via a temporary sentinel (-1) to avoid clashing
    // if sort_order ever becomes unique-indexed. Currently it isn't,
    // but the sentinel costs nothing and future-proofs.
    await tx
      .update(productImage)
      .set({ sortOrder: -1 })
      .where(eq(productImage.id, mine.id));
    await tx
      .update(productImage)
      .set({ sortOrder: mine.sortOrder })
      .where(eq(productImage.id, other.id));
    await tx
      .update(productImage)
      .set({ sortOrder: other.sortOrder })
      .where(eq(productImage.id, mine.id));

    return me.productId;
  });

  if (productIdForRevalidate !== null) {
    revalidatePath(`/admin/produkte/${productIdForRevalidate}`);
  }
}
