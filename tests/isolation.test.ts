/**
 * Order isolation invariants (CLAUDE.md red zone #2).
 *
 * These tests must fail if someone later drops a guard. Each one
 * exercises the same pure helper or query predicate that the real
 * route uses - not a parallel implementation.
 *
 * Four invariants, one per `it`:
 *   1. The customer order list query filters on `order.customer_id`,
 *      so customer A never sees customer B's order.
 *   2. `canSeeOrderView` refuses a logged-out viewer with no token.
 *   3. `canSeeOrderView` refuses a logged-in customer who is not the
 *      owner (would also refuse an admin session - the helper only
 *      recognises `role === "customer"`).
 *   4. A guest order (`customer_id IS NULL`) is invisible to any
 *      logged-in customer via the orders query AND via the detail
 *      helper.
 *
 * To confirm a test still bites, temporarily drop the guard it guards
 * and run just this file:
 *   - test 1/4: delete the `where(eq(order.customerId, customerId))`
 *     clause in `fetchCustomerOrders`.
 *   - test 2/3: in `canSeeOrderView`, `return true` unconditionally.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, like, sql } from "drizzle-orm";
import postgres from "postgres";
import type { Session } from "next-auth";
import * as schema from "@/db/schema";
import { customer } from "@/db/schema/customer";
import { order, orderLine } from "@/db/schema/order";
import { payment } from "@/db/schema/payment";
import { fetchCustomerOrders } from "@/lib/customer-auth/orders";
import { canSeeOrderView } from "@/lib/order-lookup/access";
import { fetchGuestOrderView } from "@/lib/order-lookup/fetch";

const URL_STR =
  process.env.DATABASE_URL ??
  "postgres://magenta:magenta_dev@localhost:5433/magenta_blumen";

const TEST_TAG = "__isolation_test__";
const EMAIL_A = `${TEST_TAG}-a@example.invalid`;
const EMAIL_B = `${TEST_TAG}-b@example.invalid`;
const ORDER_A = `${TEST_TAG}-ORDER-A`;
const ORDER_B = `${TEST_TAG}-ORDER-B`;
const ORDER_GUEST = `${TEST_TAG}-ORDER-GUEST`;

const adminClient = postgres(URL_STR, { max: 2 });
const admin = drizzle(adminClient, { schema });

let customerAId: number;
let customerBId: number;

async function cleanupByTag(): Promise<void> {
  const stale = await admin
    .select({ id: order.id })
    .from(order)
    .where(like(order.orderNumber, `${TEST_TAG}%`));
  for (const o of stale) {
    await admin.delete(orderLine).where(eq(orderLine.orderId, o.id));
    await admin.delete(payment).where(eq(payment.orderId, o.id));
    await admin.delete(order).where(eq(order.id, o.id));
  }
  await admin
    .delete(customer)
    .where(sql`lower(${customer.email}) like ${TEST_TAG + "%"}`);
}

async function insertOrder(
  orderNumber: string,
  customerId: number | null,
): Promise<void> {
  await admin.insert(order).values({
    orderNumber,
    customerId,
    buyerName: `${TEST_TAG} buyer`,
    buyerEmail: `${orderNumber.toLowerCase()}@example.invalid`,
    recipientName: `${TEST_TAG} recipient`,
    fulfilment: "pickup",
    subtotalGross: "40.00",
    totalGross: "40.00",
    amountDueGross: "40.00",
  });
}

beforeAll(async () => {
  await cleanupByTag();

  const [a] = await admin
    .insert(customer)
    .values({
      email: EMAIL_A,
      passwordHash: "x",
    })
    .returning({ id: customer.id });
  customerAId = a.id;

  const [b] = await admin
    .insert(customer)
    .values({
      email: EMAIL_B,
      passwordHash: "x",
    })
    .returning({ id: customer.id });
  customerBId = b.id;

  await insertOrder(ORDER_A, customerAId);
  await insertOrder(ORDER_B, customerBId);
  await insertOrder(ORDER_GUEST, null);
});

afterAll(async () => {
  await cleanupByTag();
  await adminClient.end();
});

function customerSession(customerId: number): Session {
  return {
    user: { role: "customer", customerId },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

describe("order isolation", () => {
  it("customer A cannot see customer B's order via the /konto list query", async () => {
    const aRows = await fetchCustomerOrders(customerAId);
    const aNumbers = aRows.map((r) => r.orderNumber);

    expect(aNumbers).toContain(ORDER_A);
    expect(aNumbers).not.toContain(ORDER_B);
    expect(aNumbers).not.toContain(ORDER_GUEST);

    const bRows = await fetchCustomerOrders(customerBId);
    const bNumbers = bRows.map((r) => r.orderNumber);

    expect(bNumbers).toContain(ORDER_B);
    expect(bNumbers).not.toContain(ORDER_A);
    expect(bNumbers).not.toContain(ORDER_GUEST);
  });

  it("a logged-out viewer cannot see /bestellung-finden/[number] without a token", async () => {
    const view = await fetchGuestOrderView(ORDER_A);
    expect(view).not.toBeNull();

    // Null session, no token. The page must notFound() - helper says no.
    expect(canSeeOrderView(null, view!.customerId, false)).toBe(false);
    // A null session with a valid token IS allowed - that's the guest
    // magic-link path. Belt + braces: confirm the helper agrees.
    expect(canSeeOrderView(null, view!.customerId, true)).toBe(true);
  });

  it("customer B cannot open customer A's /bestellung-finden detail", async () => {
    const view = await fetchGuestOrderView(ORDER_A);
    expect(view).not.toBeNull();

    // B is logged in, no token. The helper must say no, even though B's
    // session is valid.
    expect(
      canSeeOrderView(customerSession(customerBId), view!.customerId, false),
    ).toBe(false);
    // A's own session, no token, does see their order.
    expect(
      canSeeOrderView(customerSession(customerAId), view!.customerId, false),
    ).toBe(true);
    // An admin session is NOT a customer and must NOT satisfy the
    // customer-ownership branch. Admins use /admin/bestellung/[number],
    // which has its own guard (requireAdmin) - the customer route is
    // a different surface.
    const adminSession: Session = {
      user: { role: "admin" },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    };
    expect(canSeeOrderView(adminSession, view!.customerId, false)).toBe(false);
  });

  it("a guest order is not reachable through any customer's /konto view", async () => {
    const aRows = await fetchCustomerOrders(customerAId);
    const bRows = await fetchCustomerOrders(customerBId);
    expect(aRows.map((r) => r.orderNumber)).not.toContain(ORDER_GUEST);
    expect(bRows.map((r) => r.orderNumber)).not.toContain(ORDER_GUEST);

    // The guest order is also not claimable through the detail helper
    // by any logged-in customer: its customer_id is null, and the
    // ownership predicate rejects when either side is null.
    const view = await fetchGuestOrderView(ORDER_GUEST);
    expect(view).not.toBeNull();
    expect(view!.customerId).toBeNull();
    expect(
      canSeeOrderView(customerSession(customerAId), view!.customerId, false),
    ).toBe(false);
    expect(
      canSeeOrderView(customerSession(customerBId), view!.customerId, false),
    ).toBe(false);
  });
});
