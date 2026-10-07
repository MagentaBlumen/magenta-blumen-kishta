"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { order } from "@/db/schema/order";
import { payment } from "@/db/schema/payment";
import {
  ALL_STATUSES,
  isValidTransition,
  type OrderStatus,
} from "@/lib/admin/order-status";

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

/**
 * Transition order.status to a new value. Re-reads the CURRENT status
 * from the DB (not from form data) and validates against the state
 * machine in src/lib/admin/order-status.ts. A stale tab clicking
 * "Delivered" on an order someone else just cancelled must throw,
 * not silently reset it.
 *
 * We don't attempt to detect "no-op" transitions here (status == next)
 * - the UI already greys those buttons out, and the extra round trip
 * is harmless.
 */
export async function updateOrderStatusAction(
  orderNumberRaw: string,
  nextStatusRaw: string,
): Promise<void> {
  await requireAdmin();
  const orderNumber = String(orderNumberRaw ?? "").trim();
  if (!orderNumber) throw new Error("Ungültige Bestellnummer");

  if (!ALL_STATUSES.includes(nextStatusRaw as OrderStatus)) {
    throw new Error("Ungültiger Bestellstatus");
  }
  const nextStatus = nextStatusRaw as OrderStatus;

  const [row] = await db
    .select({ id: order.id, status: order.status })
    .from(order)
    .where(eq(order.orderNumber, orderNumber))
    .limit(1);
  if (!row) throw new Error("Bestellung nicht gefunden");

  if (!isValidTransition(row.status, nextStatus)) {
    throw new Error(
      `Übergang ${row.status} → ${nextStatus} ist nicht erlaubt.`,
    );
  }

  await db
    .update(order)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(order.id, row.id));

  revalidatePath("/admin");
  revalidatePath(`/admin/bestellung/${orderNumber}`);
}

/**
 * Set order.printed_at = now() so the Heute screen's ⎙ indicator shows
 * the Bon has been printed. Called from the print page after the
 * browser dispatches window.print(). Not a hard lock - Sandra can
 * reprint by clicking the button again - but the indicator helps
 * her avoid remaking an order she already filled.
 *
 * Idempotent: a second call just resets printed_at to a later time.
 * No status change; printing is orthogonal to the state machine.
 */
export async function markOrderPrintedAction(
  orderNumberRaw: string,
): Promise<void> {
  await requireAdmin();
  const orderNumber = String(orderNumberRaw ?? "").trim();
  if (!orderNumber) throw new Error("Ungültige Bestellnummer");

  await db
    .update(order)
    .set({ printedAt: new Date() })
    .where(eq(order.orderNumber, orderNumber));

  revalidatePath("/admin");
  revalidatePath(`/admin/bestellung/${orderNumber}`);
}
