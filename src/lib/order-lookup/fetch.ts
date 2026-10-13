import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { order, orderLine } from "@/db/schema/order";
import { payment } from "@/db/schema/payment";
import { deliveryRun } from "@/db/schema/delivery";
import type { OrderStatus } from "@/lib/admin/order-status";

/**
 * Server-side lookup helpers for the guest "wo ist meine Bestellung"
 * flow. Keeps the exact SQL shape (one match, lowercase-email compare)
 * in one place so the server action and the detail page can't drift.
 */

/**
 * Credential check for the form submission. True iff an order with
 * this exact `orderNumber` and this `email` (case-insensitive) exists.
 *
 * Returns the orderNumber on match so the caller can issue a token for
 * the canonical form (we don't want to echo back whatever casing the
 * user typed for the order number if the schema ever stored
 * mixed-case; today it's always upper, but belt + braces).
 */
export async function verifyGuestLookup(
  orderNumber: string,
  email: string,
): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!orderNumber || !normalizedEmail) return null;

  const [row] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(
      and(
        eq(order.orderNumber, orderNumber),
        sql`lower(${order.buyerEmail}) = ${normalizedEmail}`,
      ),
    )
    .limit(1);

  return row?.orderNumber ?? null;
}

export type GuestOrderView = {
  orderNumber: string;
  status: OrderStatus;
  placedAt: Date;
  fulfilment: "run" | "timed" | "pickup" | "post";
  recipientName: string;
  deliveryStreet: string | null;
  deliveryPlz: string | null;
  deliveryCity: string | null;
  deliveryContext: "residential" | "business" | "hospital" | "funeral";
  deliveryDate: string | null;
  sortTime: string | null;
  requestedDeliveryAt: Date | null;
  cardMessage: string | null;
  cardIsAnonymous: boolean;
  ribbonText: string | null;
  subtotalGross: string;
  deliveryFeeGross: string;
  giftcardAppliedGross: string;
  totalGross: string;
  amountDueGross: string;
  lines: {
    id: number;
    productNameDe: string;
    variantLabelDe: string | null;
    quantity: number;
    unitPriceGross: string;
    lineTotalGross: string;
  }[];
  paymentSummary: {
    isPaid: boolean;
    method: "cash" | "invoice" | "card" | "twint" | null;
  };
  run: {
    runDate: string;
    windowStart: string;
    windowEnd: string;
  } | null;
};

/**
 * Fetches the subset of order data we're willing to show to a buyer
 * who proved the order# + email combo. Deliberately NARROWER than
 * admin's fetchOrderDetail:
 *   - no buyer phone / recipient phone (buyer knows their own; recipient
 *     phone is not theirs to see outside admin)
 *   - no internal notes
 *   - no stripe intent id / payment method details beyond "paid? yes/no"
 *   - no refund log
 * The buyer wants to know "did my order go through, is it on its way".
 */
export async function fetchGuestOrderView(
  orderNumber: string,
): Promise<GuestOrderView | null> {
  const [o] = await db
    .select()
    .from(order)
    .where(eq(order.orderNumber, orderNumber))
    .limit(1);
  if (!o) return null;

  const [lines, payments, runs] = await Promise.all([
    db
      .select({
        id: orderLine.id,
        productNameDe: orderLine.productNameDe,
        variantLabelDe: orderLine.variantLabelDe,
        quantity: orderLine.quantity,
        unitPriceGross: orderLine.unitPriceGross,
        lineTotalGross: orderLine.lineTotalGross,
      })
      .from(orderLine)
      .where(eq(orderLine.orderId, o.id))
      .orderBy(asc(orderLine.id)),
    db
      .select({
        method: payment.method,
        status: payment.status,
      })
      .from(payment)
      .where(eq(payment.orderId, o.id)),
    o.deliveryRunId
      ? db
          .select({
            runDate: deliveryRun.runDate,
            windowStart: deliveryRun.windowStart,
            windowEnd: deliveryRun.windowEnd,
          })
          .from(deliveryRun)
          .where(eq(deliveryRun.id, o.deliveryRunId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  // "Paid?" collapses the payment table down to one boolean the buyer
  // actually wants. If the order is giftcard-fully-covered (future
  // phase 3), amount_due = 0 and there are no payment rows - treat as
  // paid.
  const amountDueZero = Number(o.amountDueGross) === 0;
  const hasSucceeded = payments.some((p) => p.status === "succeeded");
  const isPaid = amountDueZero || hasSucceeded;
  // If multiple payment rows (unusual), prefer the live one's method.
  const live =
    payments.find((p) => p.status !== "failed") ?? payments[0] ?? null;

  return {
    orderNumber: o.orderNumber,
    status: o.status,
    placedAt: o.placedAt,
    fulfilment: o.fulfilment,
    recipientName: o.recipientName,
    deliveryStreet: o.deliveryStreet,
    deliveryPlz: o.deliveryPlz,
    deliveryCity: o.deliveryCity,
    deliveryContext: o.deliveryContext,
    deliveryDate: o.deliveryDate,
    sortTime: o.sortTime,
    requestedDeliveryAt: o.requestedDeliveryAt,
    cardMessage: o.cardMessage,
    cardIsAnonymous: o.cardIsAnonymous,
    ribbonText: o.ribbonText,
    subtotalGross: o.subtotalGross,
    deliveryFeeGross: o.deliveryFeeGross,
    giftcardAppliedGross: o.giftcardAppliedGross,
    totalGross: o.totalGross,
    amountDueGross: o.amountDueGross,
    lines,
    paymentSummary: {
      isPaid,
      method: live?.method ?? null,
    },
    run: runs[0] ?? null,
  };
}
