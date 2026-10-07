// Not "server-only" - the webhook tests import this directly with their
// own DB clients. All application callers go through the route handler
// under src/app/api/webhooks/stripe/, which is server-only by nature.

import { and, eq, ne, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import type Stripe from "stripe";
import { db as defaultDb } from "@/db/client";
import { deliveryRun } from "@/db/schema/delivery";
import { order } from "@/db/schema/order";
import { payment, stripeEvent } from "@/db/schema/payment";
import { settings } from "@/db/schema/settings";
import { sendOrderEmails } from "@/lib/email/send";
import { ZONE } from "./time";

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
 * Notifications (buyer + shop email) fire OUTSIDE the tx after
 * commit, via sendOrderEmails(). Never inside - a failing email
 * must not roll back a successful payment capture.
 *
 * Reaper-vs-webhook race (payment succeeded on a cancelled order)
 * is handled by tryRestoreCancelledOrder() below: restores the order
 * if capacity is still free, flags for manual refund otherwise.
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
      payload: redactStripeEvent(event),
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
  //
  // The tx returns BOTH the ProcessResult AND an optional orderId to
  // email AFTER commit. Emails must fire outside the tx per
  // docs/checkout-transaction.md §4 step 16 - a Resend outage must
  // never roll back a successful payment capture.

  type TxOutput = {
    result: ProcessResult;
    emailOrderId: number | null;
  };

  const { result, emailOrderId } = await dbClient.transaction<TxOutput>(async (tx) => {
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
      return { result: { kind: "unknown_intent" }, emailOrderId: null };
    }

    const [ord] = await tx
      .select({ id: order.id, status: order.status })
      .from(order)
      .where(eq(order.id, freshPayment.orderId))
      .limit(1);

    // -------- The reaper race (docs/checkout-transaction.md §6) ----
    //
    // Reaper cancelled at t=30:00, Stripe success webhook arrives at
    // t=30:05. The payment just succeeded on Stripe's side so the
    // money is already captured; we can't un-charge from here.
    //
    // Only applies to the SUCCEEDED event. If the race was a payment
    // that failed/cancelled after the reaper killed the order, the
    // order stays cancelled, the payment flips to failed, nothing to
    // restore - treat as a normal processed event.
    if (
      ord?.status === "cancelled" &&
      event.type === "payment_intent.succeeded"
    ) {
      // Flip the payment status first (money is on Stripe either way).
      const paymentAction = await applyPaymentTransition(
        tx,
        freshPayment.id,
        freshPayment.status,
        event.type,
      );

      // Then try to restore the order under the same lock pattern the
      // reserve transaction uses. Returns one of three outcomes.
      const outcome = await tryRestoreCancelledOrder(tx, ord.id);

      if (outcome.kind === "restored") {
        await markProcessed(
          tx,
          event.id,
          `RESTORED: payment ${paymentAction} on cancelled order ${ord.id}; capacity was free, order flipped new -> cancelled -> new`,
        );
        // Restored order: full buyer + shop confirmation flow applies.
        return {
          result: {
            kind: "flagged",
            reason: `restored order ${ord.id} after reaper race`,
          },
          emailOrderId: ord.id,
        };
      }

      // Capacity full or unavailable - order stays cancelled, payment
      // succeeded, Stripe holds the money. This is the LOUD case: a
      // human needs to issue a refund via the Stripe dashboard and
      // tell the customer. Shop email still fires so Sandra knows a
      // refund is needed; buyer email intentionally doesn't (sending
      // "thanks for your order!" on an order that didn't survive is
      // worse than sending nothing). The shop email branch itself is
      // a follow-up: for now the audit row + journalctl line is the
      // signal that a manual refund is needed.
      await markProcessed(
        tx,
        event.id,
        `MANUAL REFUND REQUIRED: payment ${paymentAction} on cancelled order ${ord.id}; ${outcome.reason}. Refund via Stripe dashboard and notify customer.`,
      );
      return {
        result: {
          kind: "flagged",
          reason: `manual refund needed for order ${ord.id} - ${outcome.reason}`,
        },
        emailOrderId: null,
      };
    }

    const action = await applyPaymentTransition(
      tx,
      freshPayment.id,
      freshPayment.status,
      event.type,
    );
    await markProcessed(tx, event.id, null);

    // Email on the first successful transition only. "already succeeded"
    // means a duplicate retry we don't want to spam Sandra for; "no-op"
    // and "ignored" branches similarly.
    const emailOrderId =
      event.type === "payment_intent.succeeded" && action.startsWith("flipped")
        ? freshPayment.orderId
        : null;

    return { result: { kind: "processed", action }, emailOrderId };
  });

  // -------- 4. Fire emails AFTER the tx commits ----------------------
  //
  // sendOrderEmails never throws. A Resend outage logs loudly in
  // journalctl but the webhook still returns 200 to Stripe. If we were
  // to await inside the tx, a slow Resend would hold the row locks the
  // handler was done with.
  if (emailOrderId !== null) {
    await sendOrderEmails(emailOrderId, dbClient);
  }

  return result;
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

// ------------------------------------------------------------------
// Reaper race: try to restore the order
// ------------------------------------------------------------------

type RestoreOutcome =
  | { kind: "restored" }
  | { kind: "cannot_restore"; reason: string };

/**
 * Re-check capacity for a cancelled order's slot. If there's room,
 * flip status back to 'new'. If not, return a reason the caller can
 * put in the audit log so the shop knows which refund to issue.
 *
 * Uses the SAME lock pattern as reserveOrder (docs/checkout-transaction.md §2):
 *   - fulfilment='run':   SELECT ... FOR UPDATE on delivery_run
 *   - fulfilment='timed': pg_advisory_xact_lock on the epoch-hour
 *   - fulfilment='pickup': no capacity concept, restore unconditionally
 *     (pickup orders not implemented in Phase 1 but defensive is cheap)
 *
 * Our order (currently 'cancelled') does NOT count toward the capacity
 * since we only count status <> 'cancelled'. After we flip it to 'new'
 * it starts counting; the capacity check runs BEFORE the flip to avoid
 * self-counting.
 */
async function tryRestoreCancelledOrder(
  tx: Parameters<Parameters<DbClient["transaction"]>[0]>[0],
  orderId: number,
): Promise<RestoreOutcome> {
  // Read fulfilment type + slot info without lock first.
  const [ord] = await tx
    .select({
      id: order.id,
      fulfilment: order.fulfilment,
      deliveryRunId: order.deliveryRunId,
      requestedDeliveryAt: order.requestedDeliveryAt,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);
  if (!ord) {
    return { kind: "cannot_restore", reason: "order row not found" };
  }

  if (ord.fulfilment === "run") {
    if (ord.deliveryRunId == null) {
      return { kind: "cannot_restore", reason: "run order has no run id" };
    }
    const [run] = await tx
      .select({
        id: deliveryRun.id,
        capacity: deliveryRun.capacity,
        isClosed: deliveryRun.isClosed,
      })
      .from(deliveryRun)
      .where(eq(deliveryRun.id, ord.deliveryRunId))
      .for("update");
    if (!run) {
      return { kind: "cannot_restore", reason: "delivery_run no longer exists" };
    }
    if (run.isClosed) {
      return { kind: "cannot_restore", reason: "delivery_run was closed" };
    }
    const [countRow] = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(order)
      .where(and(eq(order.deliveryRunId, ord.deliveryRunId), ne(order.status, "cancelled")));
    const booked = countRow?.c ?? 0;
    if (booked >= run.capacity) {
      return {
        kind: "cannot_restore",
        reason: `run full (${booked}/${run.capacity} booked)`,
      };
    }
  } else if (ord.fulfilment === "timed") {
    if (!ord.requestedDeliveryAt) {
      return { kind: "cannot_restore", reason: "timed order has no datetime" };
    }
    const dt = DateTime.fromJSDate(ord.requestedDeliveryAt, { zone: ZONE });
    if (!dt.isValid) {
      return { kind: "cannot_restore", reason: "timed datetime is invalid" };
    }
    const hourStart = dt.startOf("hour");
    const hourEnd = hourStart.plus({ hours: 1 });
    const hourEpoch = Math.floor(hourStart.toSeconds());

    await tx.execute(sql`select pg_advisory_xact_lock(${hourEpoch}::bigint)`);

    // Read the per-hour cap from settings (same as reserve).
    const [capRow] = await tx
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "timed_deliveries_per_hour"))
      .limit(1);
    const cap = capRow ? Number(capRow.value) || 3 : 3;

    const [countRow] = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(order)
      .where(
        and(
          eq(order.fulfilment, "timed"),
          ne(order.status, "cancelled"),
          sql`${order.requestedDeliveryAt} >= ${hourStart.toISO()}::timestamptz`,
          sql`${order.requestedDeliveryAt} <  ${hourEnd.toISO()}::timestamptz`,
        ),
      );
    const booked = countRow?.c ?? 0;
    if (booked >= cap) {
      return {
        kind: "cannot_restore",
        reason: `timed hour full (${booked}/${cap} booked)`,
      };
    }
  }
  // Pickup falls through - no capacity to check.

  // Capacity available - restore.
  await tx
    .update(order)
    .set({ status: "new", updatedAt: new Date() })
    .where(eq(order.id, orderId));
  return { kind: "restored" };
}

// ------------------------------------------------------------------
// stripe_event.payload redaction
// ------------------------------------------------------------------
//
// We store the full Stripe event so the audit trail has it, but we
// strip any field that could carry buyer PII. In practice our events
// (payment_intent.*) don't carry much - we never ask Stripe to collect
// shipping or send receipts - but a field could appear in a future
// event shape or if someone changes PaymentIntent creation params.
// This bounds the blast radius if the DB is ever dumped under FADP.
//
// Deliberately strip (not allowlist) so the audit trail keeps the
// rest of the event intact. Driver / metadata / status / amount all
// survive - they're what makes the audit useful.

const PII_FIELDS = new Set([
  // Known fields that may carry buyer PII.
  "shipping",
  "receipt_email",
  "billing_details",
  // Charge-level details some events embed.
  "customer",
  "customer_email",
  // Opaque personal description fields.
  "statement_descriptor_suffix",
]);

function redactStripeEvent(event: Stripe.Event): Record<string, unknown> {
  return redactValue(event) as Record<string, unknown>;
}

function redactValue(input: unknown): unknown {
  if (input === null || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(redactValue);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (PII_FIELDS.has(k)) {
      // Replace with a marker so a human reading the audit knows a
      // field was present AND redacted, as opposed to never set.
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = redactValue(v);
  }
  return out;
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
