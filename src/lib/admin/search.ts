import "server-only";
import { ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { order } from "@/db/schema/order";
import { payment } from "@/db/schema/payment";

/**
 * Phone-first admin search.
 *
 * From CLAUDE.md: "Phone number is the primary admin search path:
 * the caller's number is the buyer's number."
 *
 * Match strategy:
 *   1. Phone: strip EVERYTHING but digits from both the query AND
 *      the stored column, then substring-match. Handles the five
 *      common Swiss formats:
 *        +41 79 000 00 00   →  41790000000
 *        0041 79 000 00 00  →  41790000000
 *        079 000 00 00      →  0790000000
 *        079000 0000        →  0790000000
 *        790000000          →   790000000
 *      Also drops a leading '0' from the query so "079..." matches
 *      a stored "+41 79...".
 *   2. Order number: ILIKE substring. "MB-2026" or just the hex
 *      suffix both work.
 *   3. Buyer name / recipient name: ILIKE substring.
 *
 * Phone conditions are only ORed in when the query carries >=3
 * digits - otherwise an empty digit-strip would match every row.
 */

export type SearchResult = {
  id: number;
  orderNumber: string;
  status:
    | "new"
    | "confirmed"
    | "in_production"
    | "ready"
    | "out_for_delivery"
    | "delivered"
    | "delivery_failed"
    | "cancelled";
  placedAt: Date;
  buyerName: string;
  buyerPhone: string | null;
  recipientName: string;
  recipientPhone: string | null;
  deliveryStreet: string | null;
  deliveryPlz: string | null;
  deliveryCity: string | null;
  deliveryContext: "residential" | "business" | "hospital" | "funeral";
  deliveryDate: string | null;
  sortTime: string | null;
  requestedDeliveryAt: Date | null;
  fulfilment: "run" | "timed" | "pickup" | "post";
  totalGross: string;
  paymentStatus: "pending" | "succeeded" | "failed" | "refunded" | null;
  paymentMethod: "cash" | "invoice" | "card" | "twint" | null;
};

const MAX_RESULTS = 50;

export async function searchOrders(rawQuery: string): Promise<SearchResult[]> {
  const q = rawQuery.trim();
  if (q.length === 0) return [];

  // Digit-only form of the query. Also drop a leading 0 so "079..."
  // matches stored "+41 79..." (the leading 0 is a national-dialing
  // artefact, never part of the number itself).
  let digits = q.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");

  const nameLike = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  const orderNumberLike = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;

  // Conditions: always include name + order number. Add phone-digit
  // ones only if the user typed enough digits.
  const includePhone = digits.length >= 3;

  const buyerPhoneCond = includePhone
    ? sql`regexp_replace(coalesce(${order.buyerPhone}, ''), '[^0-9]', '', 'g') ILIKE ${"%" + digits + "%"}`
    : null;
  const recipientPhoneCond = includePhone
    ? sql`regexp_replace(coalesce(${order.recipientPhone}, ''), '[^0-9]', '', 'g') ILIKE ${"%" + digits + "%"}`
    : null;

  const conds = [
    ilike(order.orderNumber, orderNumberLike),
    ilike(order.buyerName, nameLike),
    ilike(order.recipientName, nameLike),
  ];
  if (buyerPhoneCond) conds.push(buyerPhoneCond);
  if (recipientPhoneCond) conds.push(recipientPhoneCond);

  const rows = await db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      placedAt: order.placedAt,
      buyerName: order.buyerName,
      buyerPhone: order.buyerPhone,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      deliveryStreet: order.deliveryStreet,
      deliveryPlz: order.deliveryPlz,
      deliveryCity: order.deliveryCity,
      deliveryContext: order.deliveryContext,
      deliveryDate: order.deliveryDate,
      sortTime: order.sortTime,
      requestedDeliveryAt: order.requestedDeliveryAt,
      fulfilment: order.fulfilment,
      totalGross: order.totalGross,
      paymentStatus: sql<SearchResult["paymentStatus"]>`(
        SELECT p.status FROM ${payment} p WHERE p.order_id = ${order.id} LIMIT 1
      )`,
      paymentMethod: sql<SearchResult["paymentMethod"]>`(
        SELECT p.method FROM ${payment} p WHERE p.order_id = ${order.id} LIMIT 1
      )`,
    })
    .from(order)
    .where(or(...conds))
    .orderBy(sql`${order.placedAt} DESC`)
    .limit(MAX_RESULTS);

  return rows as SearchResult[];
}
