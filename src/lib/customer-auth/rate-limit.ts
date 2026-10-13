import "server-only";
import { headers } from "next/headers";

/**
 * IP sliding window for customer signup + signin.
 *
 * 10 attempts per 15 min is more forgiving than admin (5) because
 * public customers typo their own passwords more than Sandra does and
 * accounts have less destructive potential than admin. Still tight
 * enough that a dictionary attack against the single-admin threat
 * model doesn't scale here either.
 *
 * Same caveats as the other in-memory limiters.
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

export async function isCustomerAuthRateLimited(): Promise<boolean> {
  const ip = await clientIp();
  const now = Date.now();
  const recent = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length !== (failures.get(ip)?.length ?? 0)) {
    if (recent.length === 0) failures.delete(ip);
    else failures.set(ip, recent);
  }
  return recent.length >= MAX_FAILURES;
}

export async function recordCustomerAuthFailure(): Promise<void> {
  const ip = await clientIp();
  const now = Date.now();
  const existing = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  existing.push(now);
  failures.set(ip, existing);
}
