"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { order } from "@/db/schema/order";
import { payment } from "@/db/schema/payment";

/**
 * Server actions for /admin/bestellung/[number]. Each re-checks admin
 * auth itself (actions are public URL endpoints; the layout gate is
 * belt + braces, not a replacement for in-action checks per
 * CLAUDE.md's red zone).
 */

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Nicht angemeldet");
}

const VALID_MARKED_BY = new Set(["Shop", "Sandra", "Inhaberin", "Andere"]);

/**
 * Flip payment.status to 'succeeded' for a cash or invoice payment
 * that just received its money. Fills marked_paid_by with the human
 * identifier Sandra picked from the dropdown.
 *
 * Card / TWINT payments are deliberately refused here - those flip
 * via the Stripe webhook, not manually. If someone needs to force-
 * mark a card payment paid (because the webhook was lost), that's a
 * separate escape hatch for Session 8+.
 */
export async function markPaymentPaidAction(
  paymentId: number,
  markedPaidBy: string,
): Promise<void> {
  await requireAdmin();
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    throw new Error("Ungültige Zahlungs-ID");
  }
  const by = String(markedPaidBy ?? "").trim();
  if (!VALID_MARKED_BY.has(by)) {
    throw new Error("Ungültiger Wert für 'Markiert von'");
  }

  const [row] = await db
    .select({
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method,
      status: payment.status,
    })
    .from(payment)
    .where(eq(payment.id, paymentId))
    .limit(1);
  if (!row) throw new Error("Zahlung existiert nicht");
  if (row.method !== "cash" && row.method !== "invoice") {
    throw new Error(
      "Nur Bar- und Rechnungszahlungen können hier manuell markiert werden. Karte/TWINT läuft über Stripe.",
    );
  }
  if (row.status === "succeeded") {
    // Idempotent - clicking twice just no-ops.
    return;
  }

  await db
    .update(payment)
    .set({
      status: "succeeded",
      paidAt: new Date(),
      markedPaidBy: by,
    })
    .where(eq(payment.id, paymentId));

  // Figure out the order number for a precise revalidate path.
  const [ord] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(eq(order.id, row.orderId))
    .limit(1);

  revalidatePath("/admin");
  if (ord) {
    revalidatePath(`/admin/bestellung/${ord.orderNumber}`);
  }
}

/**
 * Save internal notes - shop-only text that never appears to the
 * customer. "Called about address", "second attempt Saturday", etc.
 * Updated-at bumps automatically via the column default.
 */
export async function updateInternalNotesAction(
  orderNumberRaw: string,
  notesRaw: string,
): Promise<void> {
  await requireAdmin();
  const orderNumber = String(orderNumberRaw ?? "").trim();
  if (!orderNumber) throw new Error("Ungültige Bestellnummer");

  const trimmed = String(notesRaw ?? "").trim();
  const notes = trimmed.length === 0 ? null : trimmed.slice(0, 2000);

  const result = await db
    .update(order)
    .set({ internalNotes: notes, updatedAt: new Date() })
    .where(eq(order.orderNumber, orderNumber));

  // `result` from drizzle-postgres returns a Response-like object with
  // `count` on it; we don't strictly need to check, but a missing
  // orderNumber is a 404 the UI should surface.
  void result;

  revalidatePath(`/admin/bestellung/${orderNumber}`);
}

