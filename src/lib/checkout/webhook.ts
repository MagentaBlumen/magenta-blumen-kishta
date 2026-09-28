// Not "server-only" - the webhook tests import this directly with their
// own DB clients. All application callers go through the route handler
// under src/app/api/webhooks/stripe/, which is server-only by nature.

import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db as defaultDb } from "@/db/client";
import { order } from "@/db/schema/order";
import { payment, stripeEvent } from "@/db/schema/payment";

/**
 * The Stripe webhook handler, split out from the HTTP route so tests
 * can call it directly with a synthesised event.
 *
 * Contract from docs/checkout-transaction.md §4:
 *
 *   1. Insert stripe_event row FIRST. The UNIQUE (stripe_event_id)
 *      constraint IS the idempotency guarantee - a retry lands here
 *      as a violation and we return early.
 *
 *   2. Process only if we own this intent. Unknown intent (not in
 *      any payment.provider_payment_intent_id) is logged, marked
 *      processed, and returned successful. Stripe would retry a 500
 *      for days.
 *
 *   3. Out-of-order events: if we already flipped to 'succeeded' and
 *      a 'failed' arrives afterwards, ignore. If we already 'failed'
 *      and a 'succeeded' arrives, upgrade to succeeded (the doc's
 *      §5 failure matrix).
 *
 *   4. NEVER throw for a business condition Stripe should NOT retry.
 *      Route handler catches unhandled throws and returns 500 to
 *      Stripe, which then retries the event for up to 3 days. That
 *      is fine for infrastructure faults (DB down) but wrong for
 *      "we don't know this intent" - hence rule 2.
 *
 * Notifications (buyer + shop email) land in Session 6f and fire
 * OUTSIDE this handler after the tx commits.
 *
 * Reaper-vs-webhook race (payment succeeded on a cancelled order)
 * is 6d - detected here today but only marked with the error field
 * on the stripe_event row; restore-or-refund logic comes later.
 */

type DbClient = typeof defaultDb;

/**
 * Outcome of processing one event. Returned so the route handler can
 * log something useful in the response body; Stripe ignores the body
 * but a human tailing journalctl doesn't.
 */
export type ProcessResult =
  | { kind: "processed"; action: string }
  | { kind: "duplicate" }
  | { kind: "unknown_intent" }
  | { kind: "ignored"; reason: string }
  | { kind: "flagged"; reason: string };

export async function processStripeEvent(
  event: Stripe.Event,
  dbClient: DbClient = defaultDb,
): Promise<ProcessResult> {
  // -------- 1. Idempotency: insert first, catch dup --------
  //
  // Any second delivery of the same event id fails on the UNIQUE
  // constraint. Drizzle re-throws a PostgresError; the code 23505 is
  // "unique_violation".
  try {
    await dbClient.insert(stripeEvent).values({
      stripeEventId: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { kind: "duplicate" };
    }
    throw err;
  }

  // -------- 2. Route on event type --------
  //
  // Only payment_intent.* are meaningful in Phase 1. Others (customer
  // events, etc) are inserted-and-ignored so the audit trail has them.

  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed" ||
    event.type === "payment_intent.canceled"
  ) {
    return processPaymentIntentEvent(event, dbClient);
  }

  // Anything else: audit-recorded, no action.
  await markProcessed(dbClient, event.id, null);
  return { kind: "ignored", reason: `event type ${event.type} not handled` };
}

async function processPaymentIntentEvent(
  event: Stripe.Event,
  dbClient: DbClient,
): Promise<ProcessResult> {
  // The event.data.object shape narrows to PaymentIntent for these
  // three event types. Cast because Stripe's union is very wide.
  const intent = event.data.object as Stripe.PaymentIntent;

  // Look up our payment row by the intent id we stored at reserve time.
  const [row] = await dbClient
    .select({
      id: payment.id,
      orderId: payment.orderId,
      status: payment.status,
    })
    .from(payment)
    .where(eq(payment.providerPaymentIntentId, intent.id))
    .limit(1);

  if (!row) {
    // Rule 2 - unknown intent. Log, mark processed, do NOT throw.
    // Stripe would retry a 500 forever; there's no recovery path.
    await markProcessed(
      dbClient,
      event.id,
      `no payment row matches intent ${intent.id}`,
    );
    return { kind: "unknown_intent" };
  }

  // -------- 3. Wrap the payment + order updates in one tx --------

  return dbClient.transaction(async (tx) => {
    // Re-read inside the tx to get a fresh view of order.status +
    // payment.status. Everything below decides based on this.
    const [freshPayment] = await tx
      .select({
        id: payment.id,
        orderId: payment.orderId,
        status: payment.status,
      })
      .from(payment)
      .where(eq(payment.id, row.id))
      .limit(1);
    if (!freshPayment) {
      // Shouldn't happen - payment row was just found. If it did, the
      // row was hard-deleted (never should happen either) - defensive.
      await markProcessed(
        tx,
        event.id,
        `payment ${row.id} disappeared during processing`,
      );
      return { kind: "unknown_intent" };
    }

    const [ord] = await tx
      .select({ id: order.id, status: order.status })
      .from(order)
      .where(eq(order.id, freshPayment.orderId))
      .limit(1);

    // -------- The reaper race hint --------
    //
    // Full handler lands in 6d. For now we detect and log; the payment
    // still gets processed so the money isn't lost - the ORDER just
    // stays cancelled. A human running `journalctl -u ...` sees the
    // 'flagged' status and can restore or refund manually.
    if (ord?.status === "cancelled") {
      // Update payment status the same as any other, but flag the
      // event and return so the route can log loudly.
      const action = await applyPaymentTransition(
        tx,
        freshPayment.id,
        freshPayment.status,
        event.type,
      );
      await markProcessed(
        tx,
        event.id,
        `WARNING: payment ${action} for CANCELLED order ${ord.id} (reaper race)`,
      );
      return {
        kind: "flagged",
        reason: `payment ${action} on cancelled order ${ord.id}`,
      };
    }

    const action = await applyPaymentTransition(
      tx,
      freshPayment.id,
      freshPayment.status,
      event.type,
    );
    await markProcessed(tx, event.id, null);
    return { kind: "processed", action };
  });
}

/**
 * Apply the state-machine rules from docs/checkout-transaction.md §5:
 *
 *   succeeded event on pending  -> flip to succeeded, set paid_at
 *   succeeded event on succeeded -> no-op (duplicate on retry)
 *   succeeded event on failed    -> upgrade to succeeded (out of order)
 *   failed event on pending      -> flip to failed
 *   failed event on succeeded    -> ignore (out of order; success wins)
 *   canceled event on pending    -> flip to failed
 *   canceled event on succeeded  -> ignore
 *
 * Returns a short label for logging.
 */
async function applyPaymentTransition(
  tx: Parameters<Parameters<DbClient["transaction"]>[0]>[0],
  paymentId: number,
  currentStatus: "pending" | "succeeded" | "failed" | "refunded",
  eventType: string,
): Promise<string> {
  const isSuccess = eventType === "payment_intent.succeeded";
  const isFail =
    eventType === "payment_intent.payment_failed" ||
    eventType === "payment_intent.canceled";

  if (isSuccess) {
    if (currentStatus === "succeeded") return "already succeeded";
    await tx
      .update(payment)
      .set({ status: "succeeded", paidAt: new Date() })
      .where(eq(payment.id, paymentId));
    return currentStatus === "failed"
      ? "upgraded failed -> succeeded (out of order)"
      : "flipped pending -> succeeded";
  }

  if (isFail) {
    if (currentStatus === "succeeded") return "ignored fail after success";
    if (currentStatus === "failed") return "already failed";
    await tx
      .update(payment)
      .set({ status: "failed" })
      .where(eq(payment.id, paymentId));
    return `flipped ${currentStatus} -> failed`;
  }

  return `no-op for ${eventType}`;
}

async function markProcessed(
  db: DbClient | Parameters<Parameters<DbClient["transaction"]>[0]>[0],
  eventId: string,
  errorText: string | null,
): Promise<void> {
  await db
    .update(stripeEvent)
    .set({ processedAt: new Date(), error: errorText })
    .where(eq(stripeEvent.stripeEventId, eventId));
}

/**
 * Postgres SQLSTATE 23505 = unique_violation. Drizzle wraps the
 * postgres.js error in a DrizzleQueryError, so the code we want is
 * on err.cause. Handle both shapes (bare postgres error or wrapped)
 * defensively - a schema-driver upgrade shouldn't silently regress
 * idempotency.
 */
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const top = err as { code?: unknown; cause?: unknown };
  if (top.code === "23505") return true;
  if (top.cause && typeof top.cause === "object") {
    const cause = top.cause as { code?: unknown };
    if (cause.code === "23505") return true;
  }
  return false;
}
