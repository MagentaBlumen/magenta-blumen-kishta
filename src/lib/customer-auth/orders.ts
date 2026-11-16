import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { order, orderLine } from "@/db/schema/order";
import { productImage } from "@/db/schema/catalogue";
import type { OrderStatus } from "@/lib/admin/order-status";

// Orders attached to a specific customer.
//
// `customer_id` is set at checkout only when the buyer was logged in.
// Guest orders stay NULL and intentionally don't show up here, per
// the policy memory ("no retroactive order claim"). If a buyer wants
// their old guest order they use /bestellung-finden.

export type CustomerOrderRow = {
  orderNumber: string;
  placedAt: Date;
  status: OrderStatus;
  recipientName: string;
  totalGross: string;
  deliveryDate: string | null;
  // Snapshot of the first non-addon line + UI thumbnail (image is a
  // live lookup from the current product_image; the NAME stays
  // snapshotted on the order_line per CLAUDE.md rule 1).
  firstLineProductName: string | null;
  firstLineVariantLabel: string | null;
  firstLineImageUrl: string | null;
};

export async function fetchCustomerOrders(
  customerId: number,
): Promise<CustomerOrderRow[]> {
  const rows = await db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      placedAt: order.placedAt,
      status: order.status,
      recipientName: order.recipientName,
      totalGross: order.totalGross,
      deliveryDate: order.deliveryDate,
    })
    .from(order)
    .where(eq(order.customerId, customerId))
    .orderBy(desc(order.placedAt))
    .limit(50);

  if (rows.length === 0) return [];

  const orderIds = rows.map((r) => r.id);

  // First non-addon line per order.
  const firstLines = await db
    .select({
      orderId: orderLine.orderId,
      lineId: orderLine.id,
      productId: orderLine.productId,
      productNameDe: orderLine.productNameDe,
      variantLabelDe: orderLine.variantLabelDe,
    })
    .from(orderLine)
    .where(
      and(inArray(orderLine.orderId, orderIds), isNull(orderLine.parentLineId)),
    )
    .orderBy(asc(orderLine.orderId), asc(orderLine.id));

  const firstByOrderId = new Map<number, (typeof firstLines)[number]>();
  for (const l of firstLines) {
    if (!firstByOrderId.has(l.orderId)) firstByOrderId.set(l.orderId, l);
  }

  const productIds = Array.from(
    new Set(
      firstLines
        .map((l) => l.productId)
        .filter((id): id is number => id !== null),
    ),
  );
  const imageByProductId = new Map<number, string>();
  if (productIds.length > 0) {
    const imgs = await db
      .select({ productId: productImage.productId, url: productImage.url })
      .from(productImage)
      .where(inArray(productImage.productId, productIds))
      .orderBy(asc(productImage.sortOrder), asc(productImage.id));
    for (const img of imgs) {
      if (!imageByProductId.has(img.productId)) {
        imageByProductId.set(img.productId, img.url);
      }
    }
  }

  return rows.map((r) => {
    const line = firstByOrderId.get(r.id) ?? null;
    return {
      orderNumber: r.orderNumber,
      placedAt: r.placedAt,
      status: r.status,
      recipientName: r.recipientName,
      totalGross: r.totalGross,
      deliveryDate: r.deliveryDate,
      firstLineProductName: line?.productNameDe ?? null,
      firstLineVariantLabel: line?.variantLabelDe ?? null,
      firstLineImageUrl:
        line?.productId != null
          ? imageByProductId.get(line.productId) ?? null
          : null,
    };
  });
}
