/**
 * `anonymiseCustomer(id)` must:
 *   - null the customer's personal fields
 *   - delete the customer's address-book rows
 *   - leave every order row untouched (ten-year accounting retention,
 *     CLAUDE.md rule 10 + the order-snapshot rule 1)
 *
 * This test drives the real helper against the local Postgres, places
 * an order with a full snapshot (buyer + delivery), and asserts both
 * halves of the invariant.
 *
 * Removing the DELETE on customer_address in
 * src/lib/customer-auth/anonymise.ts breaks the "addresses gone" leg.
 * Removing the `.returning()` / id mismatch breaks the "found" leg.
 * Touching any `UPDATE "order"` here would fail the snapshot
 * assertions below.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, like, sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { customer, customerAddress } from "@/db/schema/customer";
import { order, orderLine } from "@/db/schema/order";
import { payment } from "@/db/schema/payment";
import { anonymiseCustomer } from "@/lib/customer-auth/anonymise";

const URL_STR =
  process.env.DATABASE_URL ??
  "postgres://magenta:magenta_dev@localhost:5433/magenta_blumen";

const TEST_TAG = "__anonymise_test__";
const EMAIL = `${TEST_TAG}@example.invalid`;
const ORDER_NUMBER = `${TEST_TAG}-ORDER-1`;

const adminClient = postgres(URL_STR, { max: 2 });
const admin = drizzle(adminClient, { schema });

let customerId: number;

async function cleanupByTag(): Promise<void> {
  const staleOrders = await admin
    .select({ id: order.id })
    .from(order)
    .where(like(order.orderNumber, `${TEST_TAG}%`));
  for (const o of staleOrders) {
    await admin.delete(orderLine).where(eq(orderLine.orderId, o.id));
    await admin.delete(payment).where(eq(payment.orderId, o.id));
    await admin.delete(order).where(eq(order.id, o.id));
  }
  await admin
    .delete(customer)
    .where(sql`lower(${customer.email}) like ${TEST_TAG + "%"}`);
}

beforeAll(async () => {
  await cleanupByTag();

  const [c] = await admin
    .insert(customer)
    .values({
      email: EMAIL,
      firstName: "Hans",
      lastName: "Muster",
      phone: "+41 79 000 00 00",
      passwordHash: "$2b$12$plausibleHashShape0123456789abcdefghijABCDEF",
    })
    .returning({ id: customer.id });
  customerId = c.id;

  await admin.insert(customerAddress).values([
    {
      customerId,
      labelDe: "Zuhause",
      recipientName: "Hans Muster",
      street: "Teststrasse 1",
      plz: "5432",
      city: "Neuenhof",
      phone: "+41 79 000 00 00",
    },
    {
      customerId,
      labelDe: "Büro",
      recipientName: "Hans Muster",
      street: "Testweg 7",
      plz: "5400",
      city: "Baden",
      phone: null,
    },
  ]);

  await admin.insert(order).values({
    orderNumber: ORDER_NUMBER,
    customerId,
    buyerName: "Hans Muster",
    buyerEmail: EMAIL,
    buyerPhone: "+41 79 000 00 00",
    recipientName: "Anna Empfaenger",
    recipientPhone: "+41 79 111 11 11",
    deliveryStreet: "Beispielweg 7",
    deliveryPlz: "5432",
    deliveryCity: "Neuenhof",
    fulfilment: "pickup",
    subtotalGross: "48.00",
    totalGross: "48.00",
    amountDueGross: "48.00",
  });
});

afterAll(async () => {
  await cleanupByTag();
  await adminClient.end();
});

describe("anonymiseCustomer", () => {
  it("nulls the customer's personal fields and drops the address book", async () => {
    // Snapshot the order BEFORE anonymisation so the comparison below
    // is against the pre-state, not a value we just computed.
    const [orderBefore] = await admin
      .select({
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        buyerPhone: order.buyerPhone,
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
        deliveryStreet: order.deliveryStreet,
        deliveryPlz: order.deliveryPlz,
        deliveryCity: order.deliveryCity,
        totalGross: order.totalGross,
      })
      .from(order)
      .where(eq(order.orderNumber, ORDER_NUMBER))
      .limit(1);

    const result = await anonymiseCustomer(customerId, admin);
    expect(result.found).toBe(true);
    expect(result.addressesDeleted).toBe(2);
    // Snapshot of the pre-anonymisation fields is returned so the
    // caller can send the FADP farewell mail after commit.
    expect(result.snapshot).toEqual({
      email: EMAIL,
      firstName: "Hans",
      lastName: "Muster",
    });

    // Customer row: personal fields gone, email rewritten, lockout
    // string in passwordHash, anonymisedAt stamped.
    const [customerAfter] = await admin
      .select()
      .from(customer)
      .where(eq(customer.id, customerId))
      .limit(1);

    expect(customerAfter).toBeDefined();
    expect(customerAfter!.firstName).toBeNull();
    expect(customerAfter!.lastName).toBeNull();
    expect(customerAfter!.phone).toBeNull();
    expect(customerAfter!.email).toBe(`anonymised-${customerId}@local.invalid`);
    expect(customerAfter!.passwordHash).toBe("ANONYMISED-NO-LOGIN");
    expect(customerAfter!.anonymisedAt).not.toBeNull();

    // Address book: wiped.
    const addressesAfter = await admin
      .select({ id: customerAddress.id })
      .from(customerAddress)
      .where(eq(customerAddress.customerId, customerId));
    expect(addressesAfter).toHaveLength(0);

    // Order row: snapshot intact. Every buyer and delivery field we
    // captured before anonymisation must still read identically.
    const [orderAfter] = await admin
      .select({
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        buyerPhone: order.buyerPhone,
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
        deliveryStreet: order.deliveryStreet,
        deliveryPlz: order.deliveryPlz,
        deliveryCity: order.deliveryCity,
        totalGross: order.totalGross,
      })
      .from(order)
      .where(eq(order.orderNumber, ORDER_NUMBER))
      .limit(1);

    expect(orderAfter).toEqual(orderBefore);
  });

  it("returns found=false when the customer id is unknown", async () => {
    const result = await anonymiseCustomer(0, admin);
    expect(result.found).toBe(false);
    expect(result.addressesDeleted).toBe(0);
    expect(result.snapshot).toBeNull();
  });

  it("skips the snapshot on an already-anonymised customer so the farewell mail isn't re-sent", async () => {
    // First call: real anonymisation, returns a snapshot.
    const first = await anonymiseCustomer(customerId, admin);
    expect(first.found).toBe(true);

    // Second call: row's anonymisedAt is now set, so the helper must
    // not hand us back the (now rewritten) email again.
    const second = await anonymiseCustomer(customerId, admin);
    expect(second.found).toBe(true);
    expect(second.snapshot).toBeNull();
  });
});
