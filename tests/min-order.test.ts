/**
 * Minimum-order rule: the check runs against SUBTOTAL, not TOTAL.
 *
 * From CLAUDE.md rule 6 and docs/checkout-transaction.md §2 step 3:
 *   Her price sheet: "Minimaler Lieferwert CHF 40.00, ohne Karte + Transport."
 *   A CHF 32 bouquet + CHF 8 delivery must NOT pass a CHF 40 check.
 *
 * If reserve.ts ever regresses to comparing against total_gross, this
 * test catches it - subtotal=32, delivery=8, total=40 must fail.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
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

const TEST_TAG = "__min_order_test__";
const TEST_PLZ = "9996";
const TEST_ORT = "Testort MinOrder";
const TEST_ZONE_NAME = TEST_TAG + " zone";
const TEST_PRODUCT_SLUG = TEST_TAG + "-product";
const TEST_WINDOW_START = "04:30:00"; // unusual so generate-runs can't collide

const adminClient = postgres(URL_STR, { max: 2 });
const admin = drizzle(adminClient, { schema });

let productId: number;
let variantId: number;
let zoneId: number;
let runId: number;

async function cleanupByLookup(): Promise<void> {
  const staleRuns = await admin
    .select({ id: deliveryRun.id })
    .from(deliveryRun)
    .where(eq(deliveryRun.windowStart, TEST_WINDOW_START));
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
  await admin.delete(deliveryZonePlz).where(eq(deliveryZonePlz.plz, TEST_PLZ));
  await admin.delete(deliveryZone).where(eq(deliveryZone.nameDe, TEST_ZONE_NAME));
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

beforeAll(async () => {
  await cleanupByLookup();

  // Product priced at CHF 32 (below the CHF 40 zone minimum).
  const [rate] = await admin
    .select({ id: taxRateTable.id })
    .from(taxRateTable)
    .where(eq(taxRateTable.code, "reduced"))
    .limit(1);

  const [p] = await admin
    .insert(product)
    .values({
      slug: TEST_PRODUCT_SLUG,
      nameDe: TEST_TAG + " product",
      pricingMode: "variant",
      taxRateId: rate?.id ?? null,
      isAvailable: true,
      isOnlineOrderable: true,
    })
    .returning({ id: product.id });
  productId = p.id;

  const [v] = await admin
    .insert(productVariant)
    .values({
      productId,
      sizeLabelDe: "Klein",
      priceGross: "32.00",
      isAvailable: true,
    })
    .returning({ id: productVariant.id });
  variantId = v.id;

  // Zone with min_order=40 and fee=8. Exactly the "32 + 8 = 40 must
  // still reject" scenario the doc calls out.
  const [z] = await admin
    .insert(deliveryZone)
    .values({
      nameDe: TEST_ZONE_NAME,
      method: "own_van",
      feeGross: "8.00",
      minOrderGross: "40.00",
      freeOverGross: "120.00",
    })
    .returning({ id: deliveryZone.id });
  zoneId = z.id;

  await admin.insert(deliveryZonePlz).values({
    plz: TEST_PLZ,
    ortschaft: TEST_ORT,
    zoneId,
  });

  const runDate = new Date();
  runDate.setDate(runDate.getDate() + 1);
  const iso = runDate.toISOString().slice(0, 10);

  const [r] = await admin
    .insert(deliveryRun)
    .values({
      runDate: iso,
      windowStart: TEST_WINDOW_START,
      windowEnd: "05:30:00",
      capacity: 5,
      isClosed: false,
    })
    .returning({ id: deliveryRun.id });
  runId = r.id;
});

afterAll(async () => {
  await cleanupByLookup();
  await adminClient.end();
});

describe("min-order rule (checks SUBTOTAL, not TOTAL)", () => {
  it("rejects when subtotal < zone.min_order even if subtotal + fee reaches the threshold", async () => {
    // subtotal = 32.00 (one variant at 32)
    // fee     =  8.00 (zone fee)
    // total   = 40.00 -> equals the zone minimum
    // If reserve checked total, this would PASS (bug). It must fail.
    const cart: CartCookie = {
      l: [{ p: productId, v: variantId, q: 1 }],
    };
    const checkout: CheckoutCookie = {
      plz: TEST_PLZ,
      ort: TEST_ORT,
      zid: zoneId,
      ful: "run",
      rid: runId,
      bn: "Test Min-Order Buyer",
      be: "min-order@example.invalid",
      bp: "+41 79 000 00 00",
      rn: "Test Recipient",
      st: "Teststrasse 32",
      dc: "residential",
    };

    let caught: unknown;
    try {
      await reserveOrder({ cart, checkout, paymentMethod: "invoice" });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ReserveError);
    const msg = (caught as Error)?.message ?? "";
    expect(msg).toMatch(/Mindestbestellwert/i);

    // Also confirm no order was actually inserted.
    const orders = await admin
      .select({ id: order.id })
      .from(order)
      .where(eq(order.deliveryRunId, runId));
    expect(orders).toHaveLength(0);
  });

  it("accepts when subtotal alone meets the minimum (qty=2 = 64 > 40)", async () => {
    // Sanity: qty=2 -> subtotal=64, above the 40 minimum, order goes
    // through. If this ever fails, the rejection case above is
    // misleading (maybe the fixture zone or product is misconfigured).
    const cart: CartCookie = {
      l: [{ p: productId, v: variantId, q: 2 }],
    };
    const checkout: CheckoutCookie = {
      plz: TEST_PLZ,
      ort: TEST_ORT,
      zid: zoneId,
      ful: "run",
      rid: runId,
      bn: "Test Min-Order Buyer",
      be: "min-order@example.invalid",
      bp: "+41 79 000 00 00",
      rn: "Test Recipient",
      st: "Teststrasse 32",
      dc: "residential",
    };

    const result = await reserveOrder({ cart, checkout, paymentMethod: "invoice" });
    expect(result.orderNumber).toMatch(/^MB-\d{8}-[0-9A-F]{8}$/);
    expect(result.totalGross).toBe("72.00"); // 64 + 8 fee
  });
});
