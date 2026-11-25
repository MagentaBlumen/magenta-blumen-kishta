import "server-only";
import { clientIp } from "@/lib/http/client-ip";

/**
 * Per-IP sliding-window limiter for the public /kontakt form. Separate
 * from auth and order-lookup limiters so spam-bot activity on the
 * contact form doesn't lock out legitimate password-reset or
 * order-lookup attempts from the same IP.
 *
 * Same in-memory tradeoffs as the other limiters here — fine at
 * florist scale, swap for a shared store if the site ever actually
 * gets hammered.
 */

const WINDOW_MS = 5 * 60 * 1000;
const MAX_SUBMISSIONS = 3;

const submissions = new Map<string, number[]>();

export async function isContactFormRateLimited(): Promise<boolean> {
  const ip = await clientIp();
  const now = Date.now();
  const recent = (submissions.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length === 0) submissions.delete(ip);
  else submissions.set(ip, recent);
  return recent.length >= MAX_SUBMISSIONS;
}

export async function recordContactFormSubmission(): Promise<void> {
  const ip = await clientIp();
  const now = Date.now();
  const existing = (submissions.get(ip) ?? []).filter(
    (t) => now - t < WINDOW_MS,
  );
  existing.push(now);
  submissions.set(ip, existing);
}
