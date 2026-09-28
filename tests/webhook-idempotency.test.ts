/**
 * Stripe webhook handler tests. Covers three of the doc's hand-written
 * test cases:
 *
 *   #2 - webhook replay. Fire the same event three times. One
 *        payment, one order (i.e. exactly one state transition;
 *        subsequent deliveries no-op).
 *   #3 - out-of-order events. succeeded then failed. Payment stays
 *        succeeded.
 *   #4 - unknown intent. Returns processed=ignored, does not throw.
 *
 * The pure handler processStripeEvent() is called directly with a
 * synthesised Stripe.Event object. Signature verification is a
 * property of the HTTP layer (route.ts); we test the state machine.
 *
 * A separate integration test could exercise the full HTTP path via
 * stripe.webhooks.generateTestHeaderString() - deferring that until
 * we hit a real signature-verification bug (route is 20 lines).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import type Stripe from "stripe";
import * as schema from "@/db/schema";
import { product, productVariant } from "@/db/schema/catalogue";
import { deliveryRun, deliveryZone, deliveryZonePlz } from "@/db/schema/delivery";
import { order, orderLine } from "@/db/schema/order";
import { payment, stripeEvent } from "@/db/schema/payment";
import { taxRate as taxRateTable } from "@/db/schema/settings";
import { processStripeEvent } from "@/lib/checkout/webhook";

const URL_STR =
  process.env.DATABASE_URL ??
  "postgres://magenta:magenta_dev@localhost:5433/magenta_blumen";

const TEST_TAG = "__webhook_test__";
const TEST_PLZ = "9994";
const TEST_ORT = "Testort Webhook";
const TEST_ZONE_NAME = TEST_TAG + " zone";
const TEST_PRODUCT_SLUG = TEST_TAG + "-product";
const TEST_WINDOW_START = "04:50:00";
const TEST_INTENT_ID = "pi_test_webhook_placeholder";

const adminClient = postgres(URL_STR, { max: 2 });
const admin = drizzle(adminClient, { schema });

let productId: number;
let zoneId: number;
let runId: number;
let orderId: number;
let paymentId: number;
// variantId inserted so cleanup finds it; not otherwise referenced by
// tests, hence the void assignment inside beforeAll.

async function cleanupByLookup(): Promise<void> {
  // Wipe any stripe_event rows we may have inserted for this test.
  // Match by our fixed event-id prefix so we can't nuke real events.
  const staleEvents = await admin
    .select({ id: stripeEvent.id, sid: stripeEvent.stripeEventId })
    .from(stripeEvent);
  for (const e of staleEvents) {
    if (e.sid.startsWith("evt_test_webhook_")) {
      await admin.delete(stripeEvent).where(eq(stripeEvent.id, e.id));
    }
  }

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

  await admin
    .insert(productVariant)
    .values({
      productId,
      sizeLabelDe: "Test",
      priceGross: "50.00",
      isAvailable: true,
    });

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
      windowEnd: "05:50:00",
      capacity: 5,
      isClosed: false,
    })
    .returning({ id: deliveryRun.id });
  runId = r.id;

  // Insert an order + payment directly, skipping reserveOrder (which
  // would create a real Stripe PaymentIntent). Test uses a fake intent
  // id so the webhook can find the payment by
  // provider_payment_intent_id.
  const [o] = await admin
    .insert(order)
    .values({
      orderNumber: "MB-99999999-WHTEST01",
      status: "new",
      buyerName: "Test Webhook",
      buyerEmail: "webhook@example.invalid",
      buyerPhone: "+41 79 000 00 00",
      recipientName: "Test Recipient",
      deliveryStreet: "Teststrasse 1",
      deliveryPlz: TEST_PLZ,
      deliveryCity: TEST_ORT,
      deliveryZoneName: TEST_ZONE_NAME,
      deliveryContext: "residential",
      fulfilment: "run",
      deliveryRunId: runId,
      deliveryDate: iso,
      sortTime: TEST_WINDOW_START,
      subtotalGross: "50.00",
      deliveryFeeGross: "10.00",
      totalGross: "60.00",
      amountDueGross: "60.00",
    })
    .returning({ id: order.id });
  orderId = o.id;

  const [pay] = await admin
    .insert(payment)
    .values({
      orderId,
      method: "card",
      providerPaymentIntentId: TEST_INTENT_ID,
      amountGross: "60.00",
      status: "pending",
    })
    .returning({ id: payment.id });
  paymentId = pay.id;
});

afterAll(async () => {
  await cleanupByLookup();
  await adminClient.end();
});

/**
 * Build a minimal Stripe.Event-shaped object for payment_intent.*
 * events. Only fields the handler reads need to be real.
 */
function fakeEvent(
  eventId: string,
  type:
    | "payment_intent.succeeded"
    | "payment_intent.payment_failed"
    | "payment_intent.canceled"
    | "customer.updated",
  intentId: string,
): Stripe.Event {
  return {
    id: eventId,
    object: "event",
    api_version: "2026-08-26.dahlia",
    created: Math.floor(Date.now() / 1000),
    type,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: intentId,
        object: "payment_intent",
        amount: 6000,
        currency: "chf",
        status:
          type === "payment_intent.succeeded"
            ? "succeeded"
            : type === "payment_intent.canceled"
              ? "canceled"
              : "requires_payment_method",
        // The rest of PaymentIntent's fields the handler doesn't read.
      } as unknown as Stripe.PaymentIntent,
    },
  } as Stripe.Event;
}

async function readPayment(): Promise<{ status: string; paidAt: Date | null }> {
  const [row] = await admin
    .select({ status: payment.status, paidAt: payment.paidAt })
    .from(payment)
    .where(eq(payment.id, paymentId))
    .limit(1);
  return { status: row.status, paidAt: row.paidAt };
}

async function countEvents(prefix: string): Promise<number> {
  const rows = await admin
    .select({ sid: stripeEvent.stripeEventId })
    .from(stripeEvent);
  return rows.filter((r) => r.sid.startsWith(prefix)).length;
}

describe("webhook handler state machine", () => {
  it("processes a payment_intent.succeeded exactly once, even fired thrice", async () => {
    // Reset payment status for this test (fixtures are shared across
    // suite; tests run sequentially per file with fileParallelism off).
    await admin
      .update(payment)
      .set({ status: "pending", paidAt: null })
      .where(eq(payment.id, paymentId));

    const eventId = "evt_test_webhook_replay_001";
    const ev = fakeEvent(eventId, "payment_intent.succeeded", TEST_INTENT_ID);

    const r1 = await processStripeEvent(ev);
    const r2 = await processStripeEvent(ev);
    const r3 = await processStripeEvent(ev);

    expect(r1.kind).toBe("processed");
    if (r1.kind === "processed") {
      expect(r1.action).toMatch(/flipped/);
    }
    // Second + third are duplicates - the UNIQUE (stripe_event_id)
    // constraint caught them.
    expect(r2.kind).toBe("duplicate");
    expect(r3.kind).toBe("duplicate");

    // Exactly one row in stripe_event for this id.
    expect(await countEvents("evt_test_webhook_replay_001")).toBe(1);

    // Payment reached succeeded exactly once and paid_at is set.
    const p = await readPayment();
    expect(p.status).toBe("succeeded");
    expect(p.paidAt).not.toBeNull();
  });

  it("out-of-order: fails after succeeded is ignored, payment stays succeeded", async () => {
    // Preconditions from previous test: payment already succeeded.
    // Fire a failed event with a fresh id (new event id = new row).
    const failEvent = fakeEvent(
      "evt_test_webhook_outoforder_002",
      "payment_intent.payment_failed",
      TEST_INTENT_ID,
    );
    const result = await processStripeEvent(failEvent);

    // The processing itself is fine - it's just a no-op state
    // transition. Handler returns processed/'ignored fail after success'.
    expect(result.kind).toBe("processed");
    if (result.kind === "processed") {
      expect(result.action).toMatch(/ignored fail after success/);
    }

    const p = await readPayment();
    expect(p.status).toBe("succeeded");
    expect(p.paidAt).not.toBeNull();
  });

  it("unknown intent: returns unknown_intent, does not throw", async () => {
    const strangerEvent = fakeEvent(
      "evt_test_webhook_stranger_003",
      "payment_intent.succeeded",
      "pi_test_intent_we_do_not_know",
    );
    const result = await processStripeEvent(strangerEvent);

    expect(result.kind).toBe("unknown_intent");

    // The event row still exists (idempotency) and is marked processed
    // with the reason so a tail can see what happened.
    const [row] = await admin
      .select({
        processedAt: stripeEvent.processedAt,
        error: stripeEvent.error,
      })
      .from(stripeEvent)
      .where(eq(stripeEvent.stripeEventId, "evt_test_webhook_stranger_003"))
      .limit(1);
    expect(row.processedAt).not.toBeNull();
    expect(row.error).toMatch(/no payment row matches intent/);
  });

  it("payment_intent.canceled on a pending payment flips to failed", async () => {
    // Fresh payment row via a second order - previous test left the
    // shared payment at succeeded and we don't want to undo it.
    const [ord2] = await admin
      .insert(order)
      .values({
        orderNumber: "MB-99999999-WHTEST02",
        status: "new",
        buyerName: "Test Webhook 2",
        buyerEmail: "webhook2@example.invalid",
        buyerPhone: "+41 79 000 00 00",
        recipientName: "Test Recipient",
        deliveryStreet: "Teststrasse 2",
        deliveryPlz: TEST_PLZ,
        deliveryCity: TEST_ORT,
        deliveryZoneName: TEST_ZONE_NAME,
        deliveryContext: "residential",
        fulfilment: "run",
        deliveryRunId: runId,
        deliveryDate: new Date().toISOString().slice(0, 10),
        sortTime: TEST_WINDOW_START,
        subtotalGross: "50.00",
        deliveryFeeGross: "10.00",
        totalGross: "60.00",
        amountDueGross: "60.00",
      })
      .returning({ id: order.id });

    const secondIntentId = "pi_test_second_intent";
    const [pay2] = await admin
      .insert(payment)
      .values({
        orderId: ord2.id,
        method: "twint",
        providerPaymentIntentId: secondIntentId,
        amountGross: "60.00",
        status: "pending",
      })
      .returning({ id: payment.id });

    const cancelEvent = fakeEvent(
      "evt_test_webhook_cancel_004",
      "payment_intent.canceled",
      secondIntentId,
    );
    const result = await processStripeEvent(cancelEvent);
    expect(result.kind).toBe("processed");

    const [row] = await admin
      .select({ status: payment.status })
      .from(payment)
      .where(eq(payment.id, pay2.id))
      .limit(1);
    expect(row.status).toBe("failed");
  });

  it("ignored event type is recorded in audit trail and no-ops on payment", async () => {
    const ev = fakeEvent(
      "evt_test_webhook_ignored_005",
      "customer.updated",
      TEST_INTENT_ID,
    );
    const result = await processStripeEvent(ev);
    expect(result.kind).toBe("ignored");

    const [row] = await admin
      .select({ processedAt: stripeEvent.processedAt })
      .from(stripeEvent)
      .where(eq(stripeEvent.stripeEventId, "evt_test_webhook_ignored_005"))
      .limit(1);
    expect(row.processedAt).not.toBeNull();

    // The original test payment is still at succeeded from the first
    // test - the ignored customer.updated shouldn't have touched it.
    const p = await readPayment();
    expect(p.status).toBe("succeeded");
  });
});
