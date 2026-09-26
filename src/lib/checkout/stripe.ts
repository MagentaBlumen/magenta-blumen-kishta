import "server-only";
import Stripe from "stripe";

/**
 * Singleton Stripe server client.
 *
 * Environment variables (add to .env.local + .env.production):
 *
 *   STRIPE_SECRET_KEY               sk_test_... in dev, sk_live_... in prod.
 *                                   Server-only, NEVER prefixed with
 *                                   NEXT_PUBLIC_.
 *   STRIPE_WEBHOOK_SECRET           whsec_... . Used by the webhook route
 *                                   (Session 6c) to verify signed events.
 *                                   Different per environment.
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 *                                   pk_test_... in dev, pk_live_... in prod.
 *                                   Client-safe; used by the Payment
 *                                   Element (Session 6b) to talk to Stripe
 *                                   from the browser.
 *
 * apiVersion pin: locks us to a specific Stripe API shape so their
 * monthly backwards-incompatible changes don't drift under us. Bump
 * only when we've read the migration notes for that version.
 */

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  // Log rather than throw at module import so a missing key doesn't
  // block a build that isn't using Stripe (Docker build with no env).
  // The first call to any function below throws with a clearer message.
  console.warn(
    "[stripe] STRIPE_SECRET_KEY is not set. Card/TWINT payments will fail.",
  );
}

export const stripe = secret
  ? new Stripe(secret, { apiVersion: "2026-08-26.dahlia" })
  : null;

/**
 * Convert CHF gross (numeric string like '78.00' or a number) into the
 * integer Rappen value Stripe expects. Uses Math.round to avoid float
 * drift on values like 0.1 + 0.2.
 *
 * Never inline a `* 100` multiplication anywhere else - this is the
 * one function that touches money-to-Stripe conversion.
 */
export function chfToRappen(gross: string | number): number {
  const n = typeof gross === "string" ? Number(gross) : gross;
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`chfToRappen: invalid amount ${JSON.stringify(gross)}`);
  }
  return Math.round(n * 100);
}

/**
 * Guard so callers get a clear error rather than a null-dereference
 * when the SDK failed to initialise (missing key). Kept internal.
 */
export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      "Stripe SDK is not initialised. Set STRIPE_SECRET_KEY in .env.",
    );
  }
  return stripe;
}
