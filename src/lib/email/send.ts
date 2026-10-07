import "server-only";
import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/db/client";
import { order, orderLine } from "@/db/schema/order";
import { payment } from "@/db/schema/payment";
import {
  fromAddress,
  isEmailConfigured,
  resend,
  shopAddress,
} from "./resend";
import {
  buyerConfirmationEmail,
  shopNotificationEmail,
  type OrderEmailData,
  type OrderEmailLine,
} from "./templates";

/**
 * Send both the buyer confirmation + shop notification for one order.
 *
 * NEVER THROWS. From docs/checkout-transaction.md §4 step 16:
 *   "A failing email must not roll back a successful payment."
 *
 * Caller fires this AFTER the DB transaction commits. If email send
 * fails, we log and move on - the order is good, the money is good,
 * the audit trail is good. Resend-side failures (rate limit, domain
 * not verified, bad from-address) show up in Resend's dashboard; we
 * surface them in server logs.
 *
 * Quietly no-ops when Resend isn't configured (no API key or no from
 * address). That's the right behaviour for CI builds and for the
 * stretch between code landing and the stopgap domain being bought.
 */

type DbClient = typeof defaultDb;

export async function sendOrderEmails(
  orderId: number,
  dbClient: DbClient = defaultDb,
): Promise<{ buyer: "sent" | "skipped" | "failed"; shop: "sent" | "skipped" | "failed" }> {
  if (!isEmailConfigured()) {
    console.log(
      `[email] skipping sends for order ${orderId}: RESEND_API_KEY or RESEND_FROM_ADDRESS not set`,
    );
    return { buyer: "skipped", shop: "skipped" };
  }

  let data: OrderEmailData;
  try {
    data = await loadOrderEmailData(orderId, dbClient);
  } catch (err) {
    console.error(
      `[email] failed to load order ${orderId} for email dispatch:`,
      err,
    );
    return { buyer: "failed", shop: "failed" };
  }

  const [buyerOutcome, shopOutcome] = await Promise.all([
    sendBuyer(data),
    sendShop(data),
  ]);
  return { buyer: buyerOutcome, shop: shopOutcome };
}

async function sendBuyer(data: OrderEmailData): Promise<"sent" | "failed"> {
  const from = fromAddress();
  if (!resend || !from) return "failed";
  const tmpl = buyerConfirmationEmail(data);
  try {
    const { error } = await resend.emails.send({
      from,
      to: data.buyerEmail,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (error) {
      console.error(
        `[email] buyer send failed for ${data.orderNumber}:`,
        error,
      );
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error(
      `[email] buyer send threw for ${data.orderNumber}:`,
      err,
    );
    return "failed";
  }
}

async function sendShop(data: OrderEmailData): Promise<"sent" | "failed"> {
  const from = fromAddress();
  const shop = shopAddress() ?? from;
  if (!resend || !from || !shop) return "failed";
  const tmpl = shopNotificationEmail(data);
  try {
    const { error } = await resend.emails.send({
      from,
      to: shop,
      replyTo: data.buyerEmail,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (error) {
      console.error(
        `[email] shop send failed for ${data.orderNumber}:`,
        error,
      );
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error(
      `[email] shop send threw for ${data.orderNumber}:`,
      err,
    );
    return "failed";
  }
}

/**
 * Pull everything the templates need in one round of queries.
 * Deliberately reads order_line SNAPSHOTS - never joins back to
 * product (rule 1). Price shown in the email is what was captured
 * at reserve time, even if the live product price has since changed.
 */
export async function loadOrderEmailData(
  orderId: number,
  dbClient: DbClient = defaultDb,
): Promise<OrderEmailData> {
  const [o] = await dbClient
    .select()
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);
  if (!o) throw new Error(`order ${orderId} not found`);

  const [lines, [pay]] = await Promise.all([
    dbClient
      .select({
        productNameDe: orderLine.productNameDe,
        variantLabelDe: orderLine.variantLabelDe,
        quantity: orderLine.quantity,
        unitPriceGross: orderLine.unitPriceGross,
        lineTotalGross: orderLine.lineTotalGross,
      })
      .from(orderLine)
      .where(eq(orderLine.orderId, orderId)),
    dbClient
      .select({ method: payment.method })
      .from(payment)
      .where(eq(payment.orderId, orderId))
      .limit(1),
  ]);

  // Fall back to 'invoice' for the (rare) amount_due=0 orders that
  // skipped the payment-row insert. Templates handle the label.
  const paymentMethod: OrderEmailData["paymentMethod"] = pay?.method ?? "invoice";

  const emailLines: OrderEmailLine[] = lines.map((l) => ({
    productNameDe: l.productNameDe,
    variantLabelDe: l.variantLabelDe,
    quantity: l.quantity,
    unitPriceGross: l.unitPriceGross,
    lineTotalGross: l.lineTotalGross,
  }));

  return {
    orderNumber: o.orderNumber,
    buyerName: o.buyerName,
    buyerEmail: o.buyerEmail,
    buyerPhone: o.buyerPhone ?? "",
    recipientName: o.recipientName,
    recipientPhone: o.recipientPhone,
    deliveryStreet: o.deliveryStreet ?? "",
    deliveryPlz: o.deliveryPlz ?? "",
    deliveryCity: o.deliveryCity ?? "",
    deliveryZoneName: o.deliveryZoneName ?? "",
    fulfilment: o.fulfilment,
    deliveryDate: o.deliveryDate,
    sortTime: o.sortTime,
    requestedDeliveryAt: o.requestedDeliveryAt,
    cardMessage: o.cardMessage,
    cardIsAnonymous: o.cardIsAnonymous,
    ribbonText: o.ribbonText,
    deliveryInstructions: o.deliveryInstructions,
    deliveryContext: o.deliveryContext,
    deliveryWard: o.deliveryWard,
    deliveryRoom: o.deliveryRoom,
    deceasedName: o.deceasedName,
    familyContactPhone: o.familyContactPhone,
    subtotalGross: o.subtotalGross,
    deliveryFeeGross: o.deliveryFeeGross,
    totalGross: o.totalGross,
    paymentMethod,
    lines: emailLines,
  };
}
