import "server-only";
import { Resend } from "resend";

/**
 * Singleton Resend server client.
 *
 * Environment variables (add to .env.local + .env.production):
 *
 *   RESEND_API_KEY          re_... from the Resend dashboard.
 *                           Server-only; never prefixed with NEXT_PUBLIC_.
 *   RESEND_FROM_ADDRESS     Sender address (e.g. info@magenta-blumen.ch).
 *                           Must belong to a Resend-verified domain
 *                           (DNS SPF + DKIM records). Until the real
 *                           magenta-blumen.ch transfer completes, use
 *                           the stopgap domain's inbox.
 *   RESEND_SHOP_ADDRESS     Where the shop-notification email lands.
 *                           Can be the same as RESEND_FROM_ADDRESS or
 *                           a dedicated inbox like orders@... .
 *
 * None of these are required at import time - the SDK is initialised
 * only if the key is present, and send helpers no-op gracefully if
 * either the client or the from-address is missing. This matters so
 * local dev + CI + Docker build don't need a real Resend account.
 */

const apiKey = process.env.RESEND_API_KEY;

export const resend = apiKey ? new Resend(apiKey) : null;

export function fromAddress(): string | null {
  return process.env.RESEND_FROM_ADDRESS ?? null;
}

export function shopAddress(): string | null {
  return process.env.RESEND_SHOP_ADDRESS ?? null;
}

/**
 * True when the SDK + from-address are both configured. Call sites
 * use this to skip send attempts without logging an error - a quiet
 * no-op is correct in environments without Resend wired up.
 */
export function isEmailConfigured(): boolean {
  return resend !== null && fromAddress() !== null;
}
