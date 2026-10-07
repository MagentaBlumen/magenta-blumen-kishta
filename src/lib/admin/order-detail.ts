import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { order, orderLine } from "@/db/schema/order";
import { payment, refund } from "@/db/schema/payment";
import { deliveryRun } from "@/db/schema/delivery";

/**
 * Fetch everything the admin order-detail page shows for one order.
 *
 * Reads order_line SNAPSHOTS (rule 1 - never join back to the live
 * product/variant for display). Also pulls the active payment row and
 * any refund rows, plus the delivery run meta so the slot label is
 * accurate.
 */

export async function fetchOrderDetail(orderNumber: string) {
  const [o] = await db
    .select()
    .from(order)
    .where(eq(order.orderNumber, orderNumber))
    .limit(1);
  if (!o) return null;

  const [lines, payments, refunds, run] = await Promise.all([
    db
      .select({
        id: orderLine.id,
        productNameDe: orderLine.productNameDe,
        variantLabelDe: orderLine.variantLabelDe,
        unitPriceGross: orderLine.unitPriceGross,
        taxRate: orderLine.taxRate,
        quantity: orderLine.quantity,
        lineTotalGross: orderLine.lineTotalGross,
        colourPreference: orderLine.colourPreference,
        avoidNotes: orderLine.avoidNotes,
      })
      .from(orderLine)
      .where(eq(orderLine.orderId, o.id))
      .orderBy(asc(orderLine.id)),
    db
      .select({
        id: payment.id,
        method: payment.method,
        providerPaymentIntentId: payment.providerPaymentIntentId,
        amountGross: payment.amountGross,
        status: payment.status,
        paidAt: payment.paidAt,
        markedPaidBy: payment.markedPaidBy,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .where(eq(payment.orderId, o.id))
      .orderBy(asc(payment.id)),
    db
      .select({
        id: refund.id,
        amountGross: refund.amountGross,
        reason: refund.reason,
        createdBy: refund.createdBy,
        createdAt: refund.createdAt,
      })
      .from(refund)
      .where(eq(refund.orderId, o.id))
      .orderBy(asc(refund.id)),
    o.deliveryRunId
      ? db
          .select({
            id: deliveryRun.id,
            runDate: deliveryRun.runDate,
            windowStart: deliveryRun.windowStart,
            windowEnd: deliveryRun.windowEnd,
            capacity: deliveryRun.capacity,
            isClosed: deliveryRun.isClosed,
          })
          .from(deliveryRun)
          .where(eq(deliveryRun.id, o.deliveryRunId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    order: o,
    lines,
    payments,
    refunds,
    run: run[0] ?? null,
  };
}
