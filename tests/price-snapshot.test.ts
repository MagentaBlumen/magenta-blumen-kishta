/**
 * Rule 1 test: orders snapshot, they never reference.
 *
 * From CLAUDE.md:
 *   "When she raises a price in March, February's orders must still
 *   read the old one. Joining to the live product looks tidier and
 *   silently corrupts her accounting."
 *
 * Concretely: create a variant priced at CHF 45, place an order,
 * change the variant price to CHF 99, re-read the order_line. It must
 * still show CHF 45. If a future refactor joins to the live variant
 * for display (which is what generated code does by default), this
 * test fails.
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
import { reserveOrder } from "@/lib/checkout/reserve";
import type { CartCookie } from "@/lib/cart/types";
import type { CheckoutCookie } from "@/lib/checkout/types";

const URL_STR =
  process.env.DATABASE_URL ??
  "postgres://magenta:magenta_dev@localhost:5433/magenta_blumen";

const TEST_TAG = "__price_snapshot_test__";
const TEST_PLZ = "9995";
const TEST_ORT = "Testort PriceSnapshot";
const TEST_ZONE_NAME = TEST_TAG + " zone";
const TEST_PRODUCT_SLUG = TEST_TAG + "-product";
const TEST_WINDOW_START = "04:45:00";

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
      sizeLabelDe: "Mittel",
      // The pre-raise price. The order should snapshot this value.
      priceGross: "45.00",
      isAvailable: true,
    })
    .returning({ id: productVariant.id });
  variantId = v.id;

  const [z] = await admin
    .insert(deliveryZone)
    .values({
      nameDe: TEST_ZONE_NAME,
      method: "own_van",
      feeGross: "10.00",
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
      windowEnd: "05:45:00",
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

describe("order_line price snapshot (rule 1)", () => {
  it("stores the price at purchase time and does not follow later variant edits", async () => {
    // 1. Place an order at price 45.
    const cart: CartCookie = {
      l: [{ p: productId, v: variantId, q: 1 }],
    };
    const checkout: CheckoutCookie = {
      plz: TEST_PLZ,
      ort: TEST_ORT,
      zid: zoneId,
      ful: "run",
      rid: runId,
      bn: "Test Snapshot Buyer",
      be: "snapshot@example.invalid",
      bp: "+41 79 000 00 00",
      rn: "Test Recipient",
      st: "Teststrasse 45",
      dc: "residential",
    };
    const result = await reserveOrder({
      cart,
      checkout,
      paymentMethod: "invoice",
    });

    // Fetch the freshly-written line.
    const [lineAtCreation] = await admin
      .select({
        unitPriceGross: orderLine.unitPriceGross,
        lineTotalGross: orderLine.lineTotalGross,
        productNameDe: orderLine.productNameDe,
        variantLabelDe: orderLine.variantLabelDe,
      })
      .from(orderLine)
      .where(eq(orderLine.orderId, result.orderId))
      .limit(1);

    expect(lineAtCreation).toBeDefined();
    expect(lineAtCreation!.unitPriceGross).toBe("45.00");
    expect(lineAtCreation!.lineTotalGross).toBe("45.00");
    expect(lineAtCreation!.productNameDe).toBe(TEST_TAG + " product");
    expect(lineAtCreation!.variantLabelDe).toBe("Mittel");

    // 2. Change the LIVE variant + product to see if the order_line
    //    row follows. It must NOT.
    await admin
      .update(productVariant)
      .set({ priceGross: "99.00", sizeLabelDe: "Riesig" })
      .where(eq(productVariant.id, variantId));
    await admin
      .update(product)
      .set({ nameDe: TEST_TAG + " product (RENAMED)" })
      .where(eq(product.id, productId));

    // 3. Re-read the SAME order_line row.
    const [lineAfterChange] = await admin
      .select({
        unitPriceGross: orderLine.unitPriceGross,
        lineTotalGross: orderLine.lineTotalGross,
        productNameDe: orderLine.productNameDe,
        variantLabelDe: orderLine.variantLabelDe,
      })
      .from(orderLine)
      .where(eq(orderLine.orderId, result.orderId))
      .limit(1);

    // The snapshot must be unchanged.
    expect(lineAfterChange!.unitPriceGross).toBe("45.00");
    expect(lineAfterChange!.lineTotalGross).toBe("45.00");
    expect(lineAfterChange!.productNameDe).toBe(TEST_TAG + " product");
    expect(lineAfterChange!.variantLabelDe).toBe("Mittel");

    // 4. Sanity: the live variant/product DID change - the snapshot
    //    is genuinely independent, not just that no update happened.
    const [liveVariant] = await admin
      .select({ priceGross: productVariant.priceGross, sizeLabelDe: productVariant.sizeLabelDe })
      .from(productVariant)
      .where(eq(productVariant.id, variantId))
      .limit(1);
    expect(liveVariant.priceGross).toBe("99.00");
    expect(liveVariant.sizeLabelDe).toBe("Riesig");
  });
});
