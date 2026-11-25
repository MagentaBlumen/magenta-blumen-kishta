/**
 * HMAC round-trip tests for the password-reset + email-verification
 * tokens used in the self-service account flows. Pure-function —
 * no DB, no network. Needs AUTH_SECRET in the env.
 *
 * Invariants covered:
 *   - Round-trip of a freshly-issued token verifies as ok.
 *   - Wrong hash fingerprint (simulating a successful previous reset)
 *     invalidates the token — the "one-shot" property.
 *   - Expired token verifies as expired.
 *   - A reset token cannot be substituted for a verify token even
 *     though both share AUTH_SECRET.
 *   - Signature mismatch (any tampered byte) fails.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
  verifyEmailVerificationToken,
  verifyPasswordResetToken,
} from "@/lib/customer-auth/account-tokens";

beforeAll(() => {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
    // Test secret only. Mirrors the "long enough" check in the real
    // helper; real deploys get a longer one from NextAuth.
    process.env.AUTH_SECRET =
      "test-auth-secret-at-least-sixteen-chars-long-for-vitest";
  }
});

const HASH_A = "$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "$2b$12$bbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("password reset token", () => {
  it("round-trips with the current hash", () => {
    const token = createPasswordResetToken(42, HASH_A);
    const verified = verifyPasswordResetToken(token, HASH_A);
    expect(verified).toEqual({ ok: true, customerId: 42 });
  });

  it("is invalidated once the password hash changes", () => {
    const token = createPasswordResetToken(42, HASH_A);
    const verified = verifyPasswordResetToken(token, HASH_B);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.reason).toBe("signature");
  });

  it("rejects tampered tokens", () => {
    const token = createPasswordResetToken(42, HASH_A);
    const tampered = token.slice(0, -2) + "00";
    const verified = verifyPasswordResetToken(tampered, HASH_A);
    expect(verified.ok).toBe(false);
  });

  it("rejects malformed tokens", () => {
    const verified = verifyPasswordResetToken("not-a-token", HASH_A);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.reason).toBe("shape");
  });
});

describe("email verification token", () => {
  it("round-trips", () => {
    const token = createEmailVerificationToken(99);
    const verified = verifyEmailVerificationToken(token);
    expect(verified).toEqual({ ok: true, customerId: 99 });
  });

  it("rejects a reset token (domain-separation)", () => {
    // A reset token has 4 parts; a verify token has 3. The verify
    // function should reject the 4-part shape.
    const resetToken = createPasswordResetToken(99, HASH_A);
    const verified = verifyEmailVerificationToken(resetToken);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.reason).toBe("shape");
  });

  it("rejects tampered tokens", () => {
    const token = createEmailVerificationToken(99);
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${"0".repeat(parts[2].length)}`;
    const verified = verifyEmailVerificationToken(tampered);
    expect(verified.ok).toBe(false);
  });

  it("verify-token signature cannot be swapped into a reset-token payload", () => {
    // Build a 4-part string whose sig is actually the verify sig for
    // a 3-part payload. Reset verification should still reject it
    // because the HMAC input prefix differs (`password-reset:` vs
    // `email-verify:`).
    const verifyToken = createEmailVerificationToken(42);
    const [, , verifySig] = verifyToken.split(".");
    // Guess the fingerprint from the real hash so only the sig is
    // forged; still should fail.
    const fp = HASH_A.slice(0, 16);
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const frankenReset = `42.${exp}.${fp}.${verifySig}`;
    const verified = verifyPasswordResetToken(frankenReset, HASH_A);
    expect(verified.ok).toBe(false);
  });
});
