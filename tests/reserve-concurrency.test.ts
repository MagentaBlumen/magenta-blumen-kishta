/**
 * Concurrency test for the reserve transaction.
 *
 * The FOR UPDATE lock on delivery_run is the whole reason the reserve
 * transaction exists in one piece. Without it, two customers booking
 * the last slot both read count = N-1, both compare against capacity = N,
 * both insert - one bouquet over-book. Passes every manual test you
 * can run by hand (you cannot click twice simultaneously), fails once
 * a year on the day it matters.
 *
 * This test proves the lock is working by using TWO REAL DATABASE
 * CONNECTIONS. A pool client can serialise the statements and the test
 * would pass whether or not the lock exists - which is worse than no
 * test, because it lies.
 *
 * Requires a running local Postgres (docker compose up -d). Run with:
 *   npm test
 *
 * The test creates a self-contained delivery_run with capacity=1,
 * plus a product/variant/tax_rate/zone, drives two parallel reserve
 * calls, asserts exactly one succeeds, then cleans up its own rows.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { DateTime } from "luxon";
import * as schema from "@/db/schema";
import { product, productVariant } from "@/db/schema/catalogue";
import { deliveryRun, deliveryZone, deliveryZonePlz } from "@/db/schema/delivery";
import { order, orderLine } from "@/db/schema/order";
import { payment } from "@/db/schema/payment";
import { taxRate as taxRateTable } from "@/db/schema/settings";
import { reserveOrder, ReserveError } from "@/lib/checkout/reserve";
import type { CartCookie } from "@/lib/cart/types";
import type { CheckoutCookie } from "@/lib/checkout/types";

const URL_STR =
  process.env.DATABASE_URL ??
  "postgres://magenta:magenta_dev@localhost:5433/magenta_blumen";

// Fixed test IDs / labels so cleanup can find them even if a run
// crashed halfway through last time. Deliberately weird to avoid
// colliding with anything a human might seed.
const TEST_TAG = "__concurrency_test__";
const TEST_PLZ = "9997";
const TEST_ORT = "Testort Concurrency";
const TEST_ZONE_NAME = TEST_TAG + " zone";
const TEST_PRODUCT_SLUG = TEST_TAG + "-product";

// Two clients that MUST use separate physical connections. max: 1
// gives each client its own pool of exactly one, so concurrent
// operations against clientA don't share a connection with clientB.
// Two promises on ONE client can serialise inside the driver and give
// a false positive on this test.
const clientA = postgres(URL_STR, { max: 1 });
const clientB = postgres(URL_STR, { max: 1 });
// A third client for setup / teardown so the two participants stay
// pristine.
const adminClient = postgres(URL_STR, { max: 2 });

const dbA = drizzle(clientA, { schema });
const dbB = drizzle(clientB, { schema });
const admin = drizzle(adminClient, { schema });

let productId: number;
let variantId: number;
let zoneId: number;
let runId: number;

async function insertTestFixtures(): Promise<void> {
  // Pre-clean anything a previous crashed run may have left behind.
  // Our test IDs are fixed strings (TEST_PLZ, TEST_PRODUCT_SLUG,
  // TEST_ZONE_NAME) so a re-insert would collide on unique indexes
  // otherwise. Order matches the cleanup path: orders + lines + payments
  // -> zone plz + zone -> variant + product.
  await cleanupByLookup();

  // Standard tax rate row is assumed to exist (seeded in
  // drizzle/seed/01-base.sql). Try to find one; if missing, insert.
  let [stdRate] = await admin
    .select({ id: taxRateTable.id })
    .from(taxRateTable)
    .where(eq(taxRateTable.code, "reduced"))
    .limit(1);
  if (!stdRate) {
    const inserted = await admin
      .insert(taxRateTable)
      .values({
        code: TEST_TAG + "-rate",
        nameDe: TEST_TAG + " Testsatz",
        rate: "0.0260",
      })
      .returning({ id: taxRateTable.id });
    stdRate = inserted[0];
  }

  const [insertedProduct] = await admin
    .insert(product)
    .values({
      slug: TEST_PRODUCT_SLUG,
      nameDe: TEST_TAG + " product",
      pricingMode: "variant",
      taxRateId: stdRate.id,
      isAvailable: true,
      isOnlineOrderable: true,
    })
    .returning({ id: product.id });
  productId = insertedProduct.id;

  const [insertedVariant] = await admin
    .insert(productVariant)
    .values({
      productId,
      sizeLabelDe: "Test",
      priceGross: "50.00",
      isAvailable: true,
    })
    .returning({ id: productVariant.id });
  variantId = insertedVariant.id;

  const [insertedZone] = await admin
    .insert(deliveryZone)
    .values({
      nameDe: TEST_ZONE_NAME,
      method: "own_van",
      feeGross: "10.00",
      minOrderGross: "40.00",
      freeOverGross: "120.00",
    })
    .returning({ id: deliveryZone.id });
  zoneId = insertedZone.id;

  await admin.insert(deliveryZonePlz).values({
    plz: TEST_PLZ,
    ortschaft: TEST_ORT,
    zoneId,
  });

  // Run tomorrow at an UNUSUAL time (04:15-05:15) that generate-runs
  // never creates. The seeded generator only ever inserts 10:00 and
  // 16:00 windows, so the (run_date, window_start) unique index is
  // free at 04:15. Reserve doesn't cutoff-check inside the tx (that
  // happens in the slot picker upstream) so the odd time is harmless.
  const tomorrow = DateTime.now()
    .setZone("Europe/Zurich")
    .plus({ days: 1 })
    .toISODate();
  if (!tomorrow) throw new Error("Test setup: tomorrow's date invalid");

  const [insertedRun] = await admin
    .insert(deliveryRun)
    .values({
      runDate: tomorrow,
      windowStart: "04:15:00",
      windowEnd: "05:15:00",
      capacity: 1,
      isClosed: false,
    })
    .returning({ id: deliveryRun.id });
  runId = insertedRun.id;
}

/**
 * Delete any test rows a previous crashed run may have left behind.
 * Idempotent - safe to run when nothing exists.
 */
async function cleanupByLookup(): Promise<void> {
  // Find and drop any orders on runs at the test's unusual time (matches
  // our fixture time only). Any such row must be ours.
  const staleRuns = await admin
    .select({ id: deliveryRun.id })
    .from(deliveryRun)
    .where(eq(deliveryRun.windowStart, "04:15:00"));
  for (const r of staleRuns) {
    const orders = await admin
      .select({ id: order.id })
      .from(order)
      .where(eq(order.deliveryRunId, r.id));
    for (const o of orders) {
      await admin.delete(orderLine).where(eq(orderLine.orderId, o.id));
      await admin.delete(payment).where(eq(payment.orderId, o.id));
      await admin.delete(order).where(eq(order.id, o.id));
    }
    await admin.delete(deliveryRun).where(eq(deliveryRun.id, r.id));
  }

  // Drop the test PLZ mapping + zone if present.
  await admin
    .delete(deliveryZonePlz)
    .where(eq(deliveryZonePlz.plz, TEST_PLZ));
  await admin
    .delete(deliveryZone)
    .where(eq(deliveryZone.nameDe, TEST_ZONE_NAME));

  // Drop test product + its variants.
  const staleProducts = await admin
    .select({ id: product.id })
    .from(product)
    .where(eq(product.slug, TEST_PRODUCT_SLUG));
  for (const p of staleProducts) {
    await admin
      .delete(productVariant)
      .where(eq(productVariant.productId, p.id));
    await admin.delete(product).where(eq(product.id, p.id));
  }
}

async function cleanupTestFixtures(): Promise<void> {
  // Delete in FK-safe order. order_line -> payment -> order -> everything else.
  // Only touch rows tied to our test product / zone / run.
  if (runId != null) {
    // Cascade through orders on this run.
    const orders = await admin
      .select({ id: order.id })
      .from(order)
      .where(eq(order.deliveryRunId, runId));
    for (const o of orders) {
      await admin.delete(orderLine).where(eq(orderLine.orderId, o.id));
      await admin.delete(payment).where(eq(payment.orderId, o.id));
    }
    // Now delete the orders (bypasses the "no cascade" convention, but
    // this is test data, not customer records - not subject to the
    // 10-year retention rule).
    if (orders.length > 0) {
      for (const o of orders) {
        await admin.delete(order).where(eq(order.id, o.id));
      }
    }
    await admin.delete(deliveryRun).where(eq(deliveryRun.id, runId));
  }
  if (zoneId != null) {
    await admin
      .delete(deliveryZonePlz)
      .where(eq(deliveryZonePlz.zoneId, zoneId));
    await admin.delete(deliveryZone).where(eq(deliveryZone.id, zoneId));
  }
  if (variantId != null) {
    await admin.delete(productVariant).where(eq(productVariant.id, variantId));
  }
  if (productId != null) {
    await admin.delete(product).where(eq(product.id, productId));
  }
  // Leave tax_rate rows alone - we may have re-used the seeded 'reduced' row.
}

beforeAll(async () => {
  await insertTestFixtures();
});

afterAll(async () => {
  await cleanupTestFixtures();
  await Promise.all([clientA.end(), clientB.end(), adminClient.end()]);
});

describe("reserve capacity lock", () => {
  it("exactly one of two concurrent reserves wins on a capacity=1 run", async () => {
    const cart: CartCookie = {
      l: [{ p: productId, v: variantId, q: 1 }],
    };
    const checkout: CheckoutCookie = {
      plz: TEST_PLZ,
      ort: TEST_ORT,
      zid: zoneId,
      ful: "run",
      rid: runId,
      bn: "Test Buyer A",
      be: "test-a@example.invalid",
      bp: "+41 79 000 00 00",
      rn: "Test Recipient A",
      st: "Teststrasse 1",
      dc: "residential",
    };
    const checkoutB: CheckoutCookie = {
      ...checkout,
      bn: "Test Buyer B",
      be: "test-b@example.invalid",
      rn: "Test Recipient B",
    };

    const [resA, resB] = await Promise.allSettled([
      reserveOrder({ cart, checkout, paymentMethod: "invoice" }, dbA),
      reserveOrder(
        { cart, checkout: checkoutB, paymentMethod: "invoice" },
        dbB,
      ),
    ]);

    const successes = [resA, resB].filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof reserveOrder>>> =>
        r.status === "fulfilled",
    );
    const failures = [resA, resB].filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    // The whole point of the test.
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // The failure must be a ReserveError (business condition), not a
    // random DB error. If it's the wrong type we've regressed the
    // classification and a real customer would see "500 Internal
    // Server Error" instead of "ausgebucht".
    const failMsg = String(failures[0].reason?.message ?? "");
    expect(failMsg).toMatch(/ausgebucht/i);

    // Sanity: the winner's order actually exists in the DB.
    const winner = successes[0].value;
    const [row] = await admin
      .select({ id: order.id, orderNumber: order.orderNumber })
      .from(order)
      .where(eq(order.id, winner.orderId));
    expect(row?.orderNumber).toBe(winner.orderNumber);

    // Sanity: booked_count is now 1 for the run.
    const bookedOrders = await admin
      .select({ id: order.id })
      .from(order)
      .where(eq(order.deliveryRunId, runId));
    expect(bookedOrders).toHaveLength(1);
  });

  it("ReserveError is what the caller sees when the run fills", async () => {
    // After the previous test, the run is full. A third attempt should
    // fail with the same message.
    const cart: CartCookie = { l: [{ p: productId, v: variantId, q: 1 }] };
    const checkout: CheckoutCookie = {
      plz: TEST_PLZ,
      ort: TEST_ORT,
      zid: zoneId,
      ful: "run",
      rid: runId,
      bn: "Test Buyer C",
      be: "test-c@example.invalid",
      bp: "+41 79 000 00 00",
      rn: "Test Recipient C",
      st: "Teststrasse 3",
      dc: "residential",
    };

    await expect(
      reserveOrder({ cart, checkout, paymentMethod: "invoice" }, dbA),
    ).rejects.toBeInstanceOf(ReserveError);
  });
});
