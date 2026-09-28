import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { requireStripe } from "@/lib/checkout/stripe";
import { processStripeEvent } from "@/lib/checkout/webhook";

/**
 * POST /api/webhooks/stripe
 *
 * Contract from docs/checkout-transaction.md rules 3 + §4:
 *
 *   1. Read the RAW body via req.text(). Next parses request bodies
 *      by default for handlers using .json() - Stripe signature
 *      verification fails against parsed JSON. This burns a day for
 *      almost everyone the first time.
 *
 *   2. constructEvent throws on bad signature -> 400. We do NOT want
 *      Stripe to retry an unsignable delivery.
 *
 *   3. processStripeEvent handles idempotency itself (unique
 *      constraint on stripe_event.stripe_event_id). Duplicate
 *      deliveries return early inside the pure function.
 *
 *   4. Return 200 for everything except signature failure. NEVER
 *      500 for a business condition. Stripe would retry a 500 for
 *      three days and there is no recovery path for "we don't know
 *      this intent." Uncaught throws still surface as 500 - reserved
 *      for real infrastructure faults (DB down).
 *
 *   5. Notifications (buyer + shop email) land in Session 6f and
 *      fire AFTER the tx inside processStripeEvent commits.
 *
 * Local dev: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
 * and copy the whsec_... it prints into STRIPE_WEBHOOK_SECRET.
 */

// Explicit runtime: node (not edge). Stripe SDK uses Node crypto for
// signature verification.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Better to fail loudly here than let Stripe think we accepted
    // an unsigned event.
    return jsonResponse(500, { error: "webhook not configured" });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse(400, { error: "missing stripe-signature header" });
  }

  const rawBody = await req.text();

  const stripe = requireStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    // Bad signature. 400 = permanent failure, Stripe won't retry.
    return jsonResponse(400, {
      error: "invalid signature",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const result = await processStripeEvent(event);
    // Log the result so `journalctl` shows what happened. Stripe
    // ignores the body but a human tail doesn't.
    console.log(
      `[stripe-webhook] ${event.type} ${event.id} -> ${JSON.stringify(result)}`,
    );
    return jsonResponse(200, { received: true, result });
  } catch (err) {
    // Real infrastructure fault (DB down, etc). Return 500 so Stripe
    // retries. Log with the event id so the tail can correlate.
    console.error(
      `[stripe-webhook] ${event.type} ${event.id} threw:`,
      err,
    );
    return jsonResponse(500, {
      error: "processing failed",
      eventId: event.id,
    });
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return NextResponse.json(body, { status });
}
