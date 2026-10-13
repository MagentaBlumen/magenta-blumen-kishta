import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { order } from "@/db/schema/order";
import type { OrderStatus } from "@/lib/admin/order-status";

/**
 * Orders attached to a specific customer.
 *
 * `customer_id` is set at checkout only when the buyer was logged in.
 * Guest orders stay NULL and intentionally don't show up here, per
 * the policy memory ("no retroactive order claim"). If a buyer wants
 * their old guest order they use /bestellung-finden.
 */

export type CustomerOrderRow = {
  orderNumber: string;
  placedAt: Date;
  status: OrderStatus;
  recipientName: string;
  totalGross: string;
  deliveryDate: string | null;
};

export async function fetchCustomerOrders(
  customerId: number,
): Promise<CustomerOrderRow[]> {
  const rows = await db
    .select({
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

  return rows;
}
