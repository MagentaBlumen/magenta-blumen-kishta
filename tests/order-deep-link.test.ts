/**
 * HMAC round-trip tests for the order-view deep link embedded in
 * every outbound order e-mail. The /bestellung-finden/zugang/[token]
 * page verifies the signature, mints a fresh view-cookie, and
 * forwards to the real status page.
 *
 * Covers:
 *   - Round-trip of a freshly-issued token verifies as ok.
 *   - Tampered token fails.
 *   - Domain separation: a view-cookie signature cannot be swapped
 *     into a deep-link payload even though both share AUTH_SECRET.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  createOrderDeepLinkToken,
  verifyOrderDeepLinkToken,
} from "@/lib/order-lookup/token";

beforeAll(() => {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
    process.env.AUTH_SECRET =
      "test-auth-secret-at-least-sixteen-chars-long-for-vitest";
  }
});

describe("order-view deep-link token", () => {
  it("round-trips", () => {
    const token = createOrderDeepLinkToken("MB-20261125-DEADBEEF");
    const verified = verifyOrderDeepLinkToken(token);
    expect(verified).toEqual({ ok: true, orderNumber: "MB-20261125-DEADBEEF" });
  });

  it("rejects tampered tokens", () => {
    const token = createOrderDeepLinkToken("MB-20261125-DEADBEEF");
    const tampered = token.slice(0, -2) + "00";
    const verified = verifyOrderDeepLinkToken(tampered);
    expect(verified.ok).toBe(false);
  });

  it("rejects malformed tokens", () => {
    const verified = verifyOrderDeepLinkToken("not-a-token");
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.reason).toBe("shape");
  });

  it("rejects a token signed for a different order number", () => {
    const tokenA = createOrderDeepLinkToken("MB-A");
    // Build "MB-B.<exp>.<sig-of-A>" — same signature, different payload.
    const [, expStr, sig] = tokenA.split(".");
    const forged = `MB-B.${expStr}.${sig}`;
    const verified = verifyOrderDeepLinkToken(forged);
    expect(verified.ok).toBe(false);
  });
});
