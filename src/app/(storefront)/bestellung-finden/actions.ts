"use server";

import { redirect } from "next/navigation";
import { verifyGuestLookup } from "@/lib/order-lookup/fetch";
import {
  isOrderLookupRateLimited,
  recordOrderLookupFailure,
} from "@/lib/order-lookup/rate-limit";
import { writeOrderViewToken } from "@/lib/order-lookup/token";

/**
 * Server action for the /bestellung-finden form.
 *
 * Deliberately NOT a route handler: by living inside a server action
 * the submission goes through Next.js' CSRF-protected action channel
 * and the IP is still visible via headers().
 *
 * All failure modes redirect back to the form with ?error=xxx. We do
 * NOT distinguish "wrong order number", "wrong email", or "no match
 * for this pair" to the client - a legit buyer can't tell which they
 * typo'd, and a hostile client learns nothing useful about which
 * order numbers exist in the DB.
 */

const ORDER_NUMBER_RE = /^MB-\d{8}-[0-9A-F]{8}$/;

export async function lookupOrderAction(formData: FormData): Promise<void> {
  if (await isOrderLookupRateLimited()) {
    redirect("/bestellung-finden?error=RateLimited");
  }

  const rawOrder = String(formData.get("orderNumber") ?? "")
    .trim()
    .toUpperCase();
  const rawEmail = String(formData.get("email") ?? "").trim();

  // Shape check first - a mistyped order number should not count
  // against the rate limit (user types the dashes wrong is not an
  // attack). Only genuine lookups that fail at the DB count.
  if (!ORDER_NUMBER_RE.test(rawOrder)) {
    redirect("/bestellung-finden?error=NotFound");
  }
  if (!rawEmail.includes("@") || rawEmail.length < 5) {
    redirect("/bestellung-finden?error=NotFound");
  }

  const matched = await verifyGuestLookup(rawOrder, rawEmail);
  if (!matched) {
    await recordOrderLookupFailure();
    redirect("/bestellung-finden?error=NotFound");
  }

  await writeOrderViewToken(matched);
  redirect(`/bestellung-finden/${encodeURIComponent(matched)}`);
}
