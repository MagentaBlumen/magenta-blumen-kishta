import "server-only";
import { headers } from "next/headers";

/**
 * In-memory IP sliding window for the guest order-lookup form.
 *
 * Separate from the admin signin limit on purpose: public buyers retype
 * their own order number more often than Sandra retypes her password,
 * so 10 misses in 15 min is a more forgiving ceiling than signin's 5.
 *
 * Same caveats as auth/rate-limit.ts: in-process, lost on container
 * restart, per-IP only. Acceptable at florist scale; swap for Redis if
 * we ever expose the shop to serious automated enumeration.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

const failures = new Map<string, number[]>();

async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export async function isOrderLookupRateLimited(): Promise<boolean> {
  const ip = await clientIp();
  const now = Date.now();
  const recent = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length !== (failures.get(ip)?.length ?? 0)) {
    if (recent.length === 0) failures.delete(ip);
    else failures.set(ip, recent);
  }
  return recent.length >= MAX_FAILURES;
}

export async function recordOrderLookupFailure(): Promise<void> {
  const ip = await clientIp();
  const now = Date.now();
  const existing = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  existing.push(now);
  failures.set(ip, existing);
}
