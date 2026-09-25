"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { product, productVariant } from "@/db/schema/catalogue";
import {
  addLineToCart,
  clearCartCookie,
  readCartCookie,
  removeLineFromCart,
  setLineQtyInCart,
  writeCartCookie,
} from "./cookie";

/**
 * Server actions that mutate the cart cookie.
 *
 * Each action re-reads the cookie, mutates the parsed value in memory,
 * and writes it back - never reaches back through form data for the
 * current state. That means concurrent tabs racing to add the same
 * item are last-write-wins on the cookie, which is fine (cart is a UX
 * affordance, not a source of truth).
 *
 * Server actions are public URL endpoints even though the UI never
 * hits them via a visible URL. Validate every argument, and validate
 * that the product + variant are ORDERABLE before adding - a tampered
 * form body should not be able to put an archived product into a cart
 * (checkout would drop it anyway, but that's later + worse UX).
 *
 * revalidatePath("/", "layout") after each mutation so the header's
 * cart-count badge (server-rendered from the cookie) re-renders
 * on the current page.
 */

// -------- Guard helpers --------

async function assertOrderable(productId: number, variantId: number): Promise<void> {
  // One round-trip, both rows. Rejects on:
  //   - product/variant doesn't exist
  //   - product is archived or not online-orderable
  //   - variant belongs to a different product
  //   - product's pricing_mode is 'enquiry' (no checkout for these)
  //
  // We do NOT reject on is_available=false - rule 7: sold-out is a
  // display state, not a data state. Checkout re-validates and blocks
  // there so the cart badge still updates when a customer adds
  // something borderline.
  const [row] = await db
    .select({
      productId: product.id,
      isArchived: product.isArchived,
      isOnlineOrderable: product.isOnlineOrderable,
      pricingMode: product.pricingMode,
      variantProductId: productVariant.productId,
    })
    .from(productVariant)
    .innerJoin(product, eq(product.id, productVariant.productId))
    .where(
      and(eq(productVariant.id, variantId), eq(product.id, productId)),
    )
    .limit(1);

  if (!row) throw new Error("Produkt oder Variante nicht gefunden");
  if (row.variantProductId !== productId) {
    throw new Error("Variante gehört nicht zum Produkt");
  }
  if (row.isArchived) throw new Error("Produkt ist nicht mehr verfügbar");
  if (!row.isOnlineOrderable) {
    throw new Error("Produkt kann online nicht bestellt werden");
  }
  if (row.pricingMode === "enquiry") {
    throw new Error("Dieses Produkt ist nur auf Anfrage erhältlich");
  }
}

function assertPositiveInt(n: unknown, field: string): number {
  const num = Number(n);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`Ungültiger Wert für ${field}`);
  }
  return num;
}

// -------- Actions --------

export async function addToCartAction(
  productIdRaw: number,
  variantIdRaw: number,
  qtyRaw: number,
): Promise<void> {
  const productId = assertPositiveInt(productIdRaw, "productId");
  const variantId = assertPositiveInt(variantIdRaw, "variantId");
  const qty = assertPositiveInt(qtyRaw, "qty");

  await assertOrderable(productId, variantId);

  const cart = await readCartCookie();
  const next = addLineToCart(cart, productId, variantId, qty);
  await writeCartCookie(next);
  revalidatePath("/", "layout");
}

export async function setCartLineQtyAction(
  productIdRaw: number,
  variantIdRaw: number,
  qtyRaw: number,
): Promise<void> {
  const productId = assertPositiveInt(productIdRaw, "productId");
  const variantId = assertPositiveInt(variantIdRaw, "variantId");
  // qty can be 0 here (means "remove"); handled by setLineQtyInCart.
  const qtyNum = Number(qtyRaw);
  if (!Number.isInteger(qtyNum) || qtyNum < 0) {
    throw new Error("Ungültige Menge");
  }

  const cart = await readCartCookie();
  const next = setLineQtyInCart(cart, productId, variantId, qtyNum);
  await writeCartCookie(next);
  revalidatePath("/", "layout");
}

export async function removeCartLineAction(
  productIdRaw: number,
  variantIdRaw: number,
): Promise<void> {
  const productId = assertPositiveInt(productIdRaw, "productId");
  const variantId = assertPositiveInt(variantIdRaw, "variantId");

  const cart = await readCartCookie();
  const next = removeLineFromCart(cart, productId, variantId);
  await writeCartCookie(next);
  revalidatePath("/", "layout");
}

export async function clearCartAction(): Promise<void> {
  await clearCartCookie();
  revalidatePath("/", "layout");
}
