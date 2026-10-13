import "server-only";
import { headers } from "next/headers";

/**
 * In-memory brute-force protector for the admin signin flow.
 *
 * Simple sliding window: N failed attempts from a given IP in the last
 * WINDOW_MS block subsequent attempts for the same window. Record is
 * per-IP, in-process, lost on container restart. All of that is
 * acceptable at florist scale against the realistic threat (someone
 * scripting dictionary attacks against the single admin password).
 *
 * NOT acceptable as the only defense in prod if we ever expose this to
 * sophisticated attackers; a stronger stack would want:
 *   - persistent store (Redis / Postgres) so restarts don't reset
 *   - exponential backoff instead of a hard window
 *   - CAPTCHA after the first miss
 *   - per-account counters too, not just per-IP
 * All future work when the single-admin model becomes multi-user.
 */

const WINDOW_MS = 15 * 60 * 1000;   // 15 minutes
const MAX_FAILURES = 5;

const failures = new Map<string, number[]>();

async function clientIp(): Promise<string> {
  const h = await headers();
  // Caddy sets x-forwarded-for as "client, proxy1, proxy2". First
  // entry is the real client. Fall back to a sentinel so unknown
  // sources share one bucket (worst case: harmless over-blocking of
  // a single unknown attacker).
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/**
 * Returns true if the current client is currently blocked. Does NOT
 * record anything - caller decides whether this attempt counts as a
 * failure (via `recordFailure`) based on auth result.
 */
export async function isSigninRateLimited(): Promise<boolean> {
  const ip = await clientIp();
  const now = Date.now();
  const recent = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length !== (failures.get(ip)?.length ?? 0)) {
    // Prune stale entries so the map doesn't grow forever.
    if (recent.length === 0) failures.delete(ip);
    else failures.set(ip, recent);
  }
  return recent.length >= MAX_FAILURES;
}

/**
 * Record a failed signin attempt for the current client. Call ONLY
 * when authentication actually failed; successful logins should not
 * accumulate against the limit (an admin logging in + out repeatedly
 * must not lock themselves out).
 */
export async function recordSigninFailure(): Promise<void> {
  const ip = await clientIp();
  const now = Date.now();
  const existing = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  existing.push(now);
  failures.set(ip, existing);
}
