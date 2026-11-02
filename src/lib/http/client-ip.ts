import "server-only";
import { headers } from "next/headers";

/**
 * Resolve the client IP for rate-limit bucketing.
 *
 * Trust order:
 *   1. `x-real-ip` — Caddy's `reverse_proxy` sets this to the actual
 *      TCP peer. A client can't forge this because Caddy overwrites
 *      whatever came in.
 *   2. **Last** entry of `x-forwarded-for` — Caddy appends to XFF, so
 *      the final value is what Caddy itself observed. A hostile client
 *      can inject earlier entries (e.g. `X-Forwarded-For: 1.2.3.4`),
 *      but the one Caddy adds last is still truthful.
 *   3. `"unknown"` sentinel — unknown sources share a bucket, which
 *      over-blocks a single attacker; acceptable.
 *
 * DO NOT read the first XFF entry: that's attacker-controlled and
 * lets anyone pick their own rate-limit bucket per request.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();

  const realIp = h.get("x-real-ip");
  if (realIp && realIp.length > 0) return realIp.trim();

  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }

  return "unknown";
}
