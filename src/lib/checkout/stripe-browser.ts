"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Browser-side Stripe singleton.
 *
 * loadStripe() fetches Stripe.js from Stripe's CDN and caches the
 * result. Calling it many times returns the same Promise so we don't
 * add multiple <script> tags. Kept module-scoped rather than per-
 * render to preserve that dedup across component re-mounts.
 *
 * Uses NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY - this IS safe on the
 * client. The dangerous half (STRIPE_SECRET_KEY) is server-only in
 * src/lib/checkout/stripe.ts.
 */

let cached: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (cached) return cached;
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!pk) {
    console.warn(
      "[stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not set. Card/TWINT will fail.",
    );
    cached = Promise.resolve(null);
    return cached;
  }
  cached = loadStripe(pk);
  return cached;
}
