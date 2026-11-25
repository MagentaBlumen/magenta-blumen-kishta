import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed URL tokens for customer self-service flows:
 *
 *   - Password reset ("reset"): single-use, bound to the customer's
 *     CURRENT password hash, 1 h TTL. Resetting the hash invalidates
 *     every outstanding token automatically.
 *   - Email verification ("verify"): customerId + expiry only, 24 h
 *     TTL. One-shot in practice because the click endpoint stamps
 *     `email_verified_at` and we don't send another until the email
 *     changes.
 *
 * Token format: `<customerId>.<exp>.<extra?>.<hex-sig>` — dots as
 * separators, every field is dot-free.
 *   reset:  <id>.<exp>.<fp>.<sig>   fp = first 16 chars of password_hash
 *   verify: <id>.<exp>.<sig>
 *
 * Domain-separation prefix inside the HMAC input ensures a reset
 * signature can never be substituted for a verify signature or for an
 * order-lookup signature — they all share `AUTH_SECRET` as the key.
 */

const RESET_TTL_SECONDS = 60 * 60; // 1 h — short on purpose; a stolen
                                   // mailbox is the realistic threat.
const VERIFY_TTL_SECONDS = 24 * 60 * 60; // 24 h — longer because the
                                         // click is voluntary; no
                                         // feature is gated on it.

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET missing or too short for account tokens");
  }
  return s;
}

function hashFingerprint(passwordHash: string): string {
  // 16 chars = 64 bits. Changing the real hash changes the fingerprint
  // (bcrypt derives the output from the salt+rounds+plaintext, which
  // the user just set). Not a security claim on its own — the HMAC is
  // the security claim; the fingerprint is the invalidation key.
  return passwordHash.slice(0, 16);
}

// ---------- Password reset ----------

function signReset(id: number, exp: number, fp: string): string {
  return createHmac("sha256", getSecret())
    .update(`password-reset:${id}.${exp}.${fp}`)
    .digest("hex");
}

export function createPasswordResetToken(
  customerId: number,
  passwordHash: string,
): string {
  const exp = Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS;
  const fp = hashFingerprint(passwordHash);
  const sig = signReset(customerId, exp, fp);
  return `${customerId}.${exp}.${fp}.${sig}`;
}

export type VerifiedResetToken =
  | { ok: true; customerId: number }
  | { ok: false; reason: "shape" | "expired" | "signature" };

export function verifyPasswordResetToken(
  token: string,
  currentPasswordHash: string,
): VerifiedResetToken {
  const parts = token.split(".");
  if (parts.length !== 4) return { ok: false, reason: "shape" };
  const [idStr, expStr, fp, sig] = parts;
  const id = Number(idStr);
  const exp = Number(expStr);
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(exp)) {
    return { ok: false, reason: "shape" };
  }
  if (exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }
  if (fp !== hashFingerprint(currentPasswordHash)) {
    return { ok: false, reason: "signature" };
  }
  const expected = signReset(id, exp, fp);
  if (sig.length !== expected.length) return { ok: false, reason: "signature" };
  const match = timingSafeEqual(
    Buffer.from(sig, "hex"),
    Buffer.from(expected, "hex"),
  );
  if (!match) return { ok: false, reason: "signature" };
  return { ok: true, customerId: id };
}

// ---------- Email verification ----------

function signVerify(id: number, exp: number): string {
  return createHmac("sha256", getSecret())
    .update(`email-verify:${id}.${exp}`)
    .digest("hex");
}

export function createEmailVerificationToken(customerId: number): string {
  const exp = Math.floor(Date.now() / 1000) + VERIFY_TTL_SECONDS;
  const sig = signVerify(customerId, exp);
  return `${customerId}.${exp}.${sig}`;
}

export type VerifiedEmailToken =
  | { ok: true; customerId: number }
  | { ok: false; reason: "shape" | "expired" | "signature" };

export function verifyEmailVerificationToken(token: string): VerifiedEmailToken {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "shape" };
  const [idStr, expStr, sig] = parts;
  const id = Number(idStr);
  const exp = Number(expStr);
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(exp)) {
    return { ok: false, reason: "shape" };
  }
  if (exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }
  const expected = signVerify(id, exp);
  if (sig.length !== expected.length) return { ok: false, reason: "signature" };
  const match = timingSafeEqual(
    Buffer.from(sig, "hex"),
    Buffer.from(expected, "hex"),
  );
  if (!match) return { ok: false, reason: "signature" };
  return { ok: true, customerId: id };
}
