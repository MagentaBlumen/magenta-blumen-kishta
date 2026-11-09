import "server-only";
import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { customer, customerAddress } from "@/db/schema/customer";
import { order } from "@/db/schema/order";

export type CustomerListRow = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: Date;
  anonymisedAt: Date | null;
  orderCount: number;
};

/**
 * Admin customer list. Optional text filter against name / email /
 * phone (case-insensitive). Anonymised accounts are included but the
 * list UI dims them.
 */
export async function fetchCustomerList(
  rawQuery?: string,
): Promise<CustomerListRow[]> {
  const q = (rawQuery ?? "").trim();
  const like = q ? `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%` : null;

  const conds = like
    ? [
        ilike(customer.email, like),
        ilike(customer.firstName, like),
        ilike(customer.lastName, like),
        ilike(customer.phone, like),
      ]
    : [];

  const rows = await db
    .select({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      createdAt: customer.createdAt,
      anonymisedAt: customer.anonymisedAt,
      orderCount: sql<number>`(
        SELECT COUNT(*)::int FROM "order" o
        WHERE o.customer_id = ${customer.id}
      )`,
    })
    .from(customer)
    .where(conds.length > 0 ? or(...conds) : undefined)
    .orderBy(desc(customer.createdAt))
    .limit(200);

  return rows;
}

export type CustomerDetail = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  anonymisedAt: Date | null;
  orders: {
    id: number;
    orderNumber: string;
    status: typeof order.status.enumValues[number];
    placedAt: Date;
    recipientName: string;
    deliveryCity: string | null;
    deliveryPlz: string | null;
    totalGross: string;
    deliveryDate: string | null;
  }[];
  addresses: {
    id: number;
    labelDe: string | null;
    recipientName: string;
    street: string;
    plz: string;
    city: string;
    phone: string | null;
    notes: string | null;
  }[];
};

export async function fetchCustomerDetail(
  id: number,
): Promise<CustomerDetail | null> {
  const [row] = await db
    .select({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      createdAt: customer.createdAt,
      emailVerifiedAt: customer.emailVerifiedAt,
      anonymisedAt: customer.anonymisedAt,
    })
    .from(customer)
    .where(eq(customer.id, id))
    .limit(1);
  if (!row) return null;

  const [orders, addresses] = await Promise.all([
    db
      .select({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        placedAt: order.placedAt,
        recipientName: order.recipientName,
        deliveryCity: order.deliveryCity,
        deliveryPlz: order.deliveryPlz,
        totalGross: order.totalGross,
        deliveryDate: order.deliveryDate,
      })
      .from(order)
      .where(eq(order.customerId, id))
      .orderBy(desc(order.placedAt))
      .limit(200),
    db
      .select({
        id: customerAddress.id,
        labelDe: customerAddress.labelDe,
        recipientName: customerAddress.recipientName,
        street: customerAddress.street,
        plz: customerAddress.plz,
        city: customerAddress.city,
        phone: customerAddress.phone,
        notes: customerAddress.notes,
      })
      .from(customerAddress)
      .where(eq(customerAddress.customerId, id))
      .orderBy(asc(customerAddress.labelDe), asc(customerAddress.recipientName)),
  ]);

  return { ...row, orders, addresses };
}

