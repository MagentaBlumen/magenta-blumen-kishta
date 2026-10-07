import "server-only";
import { and, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { order } from "@/db/schema/order";
import { todayZ } from "@/lib/checkout/time";

/**
 * The query the Heute screen runs.
 *
 * Shows ACTIONABLE orders only. From docs/checkout-transaction.md §1:
 *   "An order is ACTIONABLE - appears on the Heute screen - when:
 *      EXISTS (SELECT 1 FROM payment p
 *              WHERE p.order_id = o.id
 *                AND (p.status = 'succeeded' OR p.method IN ('cash','invoice')))"
 *
 * So card/twint orders only show up once the webhook has flipped the
 * payment to succeeded; cash + invoice orders are actionable at
 * creation (admin flips payment later via mark-paid).
 *
 * Two buckets:
 *   - delivery_date = today in Europe/Zurich (any status except
 *     cancelled). Delivered orders stay visible so Sandra can see
 *     "4 done, 3 to go" at a glance.
 *   - delivery_date < today AND status IN (ready, out_for_delivery,
 *     delivery_failed). These never got finished yesterday - Übertrag.
 *     Shown as a single "yesterday-stuck" section at the top so she
 *     can't miss them.
 */

export type HeuteOrder = {
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
  fulfilment: "run" | "timed" | "pickup" | "post";
  recipientName: string;
  recipientPhone: string | null;
  buyerName: string;
  buyerPhone: string | null;
  deliveryStreet: string | null;
  deliveryPlz: string | null;
  deliveryCity: string | null;
  deliveryContext: "residential" | "business" | "hospital" | "funeral";
  deliveryWard: string | null;
  deliveryRoom: string | null;
  deliveryRunId: number | null;
  deliveryDate: string | null;
  sortTime: string | null;
  requestedDeliveryAt: Date | null;
  routeStopOrder: number | null;
  totalGross: string;
  printedAt: Date | null;
  itemCount: number;
  paymentStatus: "pending" | "succeeded" | "failed" | "refunded" | null;
  paymentMethod: "cash" | "invoice" | "card" | "twint" | null;
};

export async function fetchHeuteOrders(): Promise<HeuteOrder[]> {
  const today = todayZ();
  const todayIso = today.toISODate() ?? "";

  const actionable = sql`EXISTS (
    SELECT 1 FROM payment p
    WHERE p.order_id = ${order.id}
      AND (p.status = 'succeeded' OR p.method IN ('cash','invoice'))
  )`;

  const dateFilter = sql`(
    ${order.deliveryDate} = ${todayIso}
    OR (${order.deliveryDate} < ${todayIso}
        AND ${order.status} IN ('ready','out_for_delivery','delivery_failed'))
  )`;

  const rows = await db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      fulfilment: order.fulfilment,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      buyerName: order.buyerName,
      buyerPhone: order.buyerPhone,
      deliveryStreet: order.deliveryStreet,
      deliveryPlz: order.deliveryPlz,
      deliveryCity: order.deliveryCity,
      deliveryContext: order.deliveryContext,
      deliveryWard: order.deliveryWard,
      deliveryRoom: order.deliveryRoom,
      deliveryRunId: order.deliveryRunId,
      deliveryDate: order.deliveryDate,
      sortTime: order.sortTime,
      requestedDeliveryAt: order.requestedDeliveryAt,
      routeStopOrder: order.routeStopOrder,
      totalGross: order.totalGross,
      printedAt: order.printedAt,
      // Correlated subqueries - cheap at florist scale (max tens of
      // orders per day). If this ever becomes a problem, flatten to
      // joins with GROUP BY.
      itemCount: sql<number>`(SELECT COUNT(*) FROM "order_line" ol WHERE ol.order_id = ${order.id})::int`,
      paymentStatus: sql<HeuteOrder["paymentStatus"]>`(
        SELECT p.status FROM payment p WHERE p.order_id = ${order.id} LIMIT 1
      )`,
      paymentMethod: sql<HeuteOrder["paymentMethod"]>`(
        SELECT p.method FROM payment p WHERE p.order_id = ${order.id} LIMIT 1
      )`,
    })
    .from(order)
    .where(and(actionable, ne(order.status, "cancelled"), dateFilter))
    .orderBy(order.deliveryDate, order.sortTime, order.routeStopOrder);

  return rows as HeuteOrder[];
}

// ------------------------------------------------------------------
// Grouping for the UI
// ------------------------------------------------------------------

export type HeuteGroup = {
  key: string;
  labelDe: string;
  subLabelDe?: string;
  orders: HeuteOrder[];
};

/**
 * Group fetched orders for display:
 *   1. Übertrag von gestern (if any delivery_date < today).
 *   2. Vormittag 10-12 (run slots with window_start-ish starting 10).
 *   3. Nachmittag 16-18.
 *   4. Trauer / Event (timed).
 *   5. Abholung (pickup).
 *
 * sortTime strings are 'HH:MM:SS' in Postgres; we match on the first
 * two chars. Timed orders have no sortTime bucket - they land in the
 * timed section regardless of hour.
 */
export function groupHeuteOrders(
  rows: HeuteOrder[],
  todayIso: string,
): HeuteGroup[] {
  const carryover: HeuteOrder[] = [];
  const morning: HeuteOrder[] = [];
  const afternoon: HeuteOrder[] = [];
  const timed: HeuteOrder[] = [];
  const pickup: HeuteOrder[] = [];
  const other: HeuteOrder[] = [];

  for (const o of rows) {
    if (o.deliveryDate && o.deliveryDate < todayIso) {
      carryover.push(o);
      continue;
    }
    if (o.fulfilment === "pickup") {
      pickup.push(o);
      continue;
    }
    if (o.fulfilment === "timed") {
      timed.push(o);
      continue;
    }
    if (o.fulfilment === "run") {
      if (o.sortTime?.startsWith("10")) morning.push(o);
      else if (o.sortTime?.startsWith("16")) afternoon.push(o);
      else other.push(o);
      continue;
    }
    other.push(o);
  }

  const groups: HeuteGroup[] = [];
  if (carryover.length > 0) {
    groups.push({
      key: "carryover",
      labelDe: "Übertrag",
      subLabelDe: "Nicht ausgeliefert gestern",
      orders: carryover,
    });
  }
  if (morning.length > 0) {
    groups.push({
      key: "run-am",
      labelDe: "Vormittag",
      subLabelDe: "10:00–12:00",
      orders: morning,
    });
  }
  if (afternoon.length > 0) {
    groups.push({
      key: "run-pm",
      labelDe: "Nachmittag",
      subLabelDe: "16:00–18:00",
      orders: afternoon,
    });
  }
  if (timed.length > 0) {
    groups.push({
      key: "timed",
      labelDe: "Trauer / Event",
      subLabelDe: "Genauer Zeitpunkt",
      orders: timed,
    });
  }
  if (pickup.length > 0) {
    groups.push({
      key: "pickup",
      labelDe: "Abholung",
      subLabelDe: "Im Laden",
      orders: pickup,
    });
  }
  if (other.length > 0) {
    groups.push({
      key: "other",
      labelDe: "Andere Termine",
      orders: other,
    });
  }
  return groups;
}

// ------------------------------------------------------------------
// Display labels
// ------------------------------------------------------------------

export function statusLabelDe(s: HeuteOrder["status"]): string {
  switch (s) {
    case "new":
      return "Neu";
    case "confirmed":
      return "Bestätigt";
    case "in_production":
      return "In Produktion";
    case "ready":
      return "Fertig";
    case "out_for_delivery":
      return "Unterwegs";
    case "delivered":
      return "Geliefert";
    case "delivery_failed":
      return "Lieferung fehlgeschlagen";
    case "cancelled":
      return "Storniert";
  }
}

export function contextLabelDe(c: HeuteOrder["deliveryContext"]): string {
  switch (c) {
    case "residential":
      return "Privat";
    case "business":
      return "Firma";
    case "hospital":
      return "Spital";
    case "funeral":
      return "Trauer";
  }
}

export function paymentDisplayDe(
  status: HeuteOrder["paymentStatus"],
  method: HeuteOrder["paymentMethod"],
): string {
  if (!method) return "–";
  if (method === "cash") {
    return status === "succeeded" ? "Bar bezahlt" : "Bar offen";
  }
  if (method === "invoice") {
    return status === "succeeded" ? "Rechnung bezahlt" : "Rechnung offen";
  }
  // card / twint
  if (status === "succeeded") return method === "twint" ? "TWINT ✓" : "Karte ✓";
  if (status === "failed") return "fehlgeschlagen";
  return method === "twint" ? "TWINT ausstehend" : "Karte ausstehend";
}
