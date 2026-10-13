import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed cookie that proves "this browser successfully looked up order X
 * within the last 24 h". The /bestellung-finden/[number] status page
 * refuses to render without it, so even someone who knows a real order
 * number can't just paste the URL to see it.
 *
 * Cookie value: `${orderNumber}.${expEpochSec}.${hmacHex}`
 *   HMAC-SHA256 over "order-lookup:${orderNumber}.${expEpochSec}" with
 *   AUTH_SECRET as the key. Prefix is domain-separation so this signature
 *   cannot be substituted for any other HMAC we might add later over the
 *   same secret.
 *
 * We do NOT store the email in the cookie - the browser already proved
 * knowledge of it to get here, no need to keep echoing it around.
 */

const COOKIE_NAME = "mb_order_view";
const TTL_SECONDS = 24 * 60 * 60; // 24h - long enough for a lazy phone
                                  // check later in the day, short enough
                                  // that a shared machine times out.

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    // Fail loudly rather than issue weak tokens. Treated as a server
    // bug - AUTH_SECRET is required for NextAuth anyway.
    throw new Error("AUTH_SECRET missing or too short for order-lookup token");
  }
  return s;
}

function sign(orderNumber: string, exp: number): string {
  return createHmac("sha256", getSecret())
    .update(`order-lookup:${orderNumber}.${exp}`)
    .digest("hex");
}

export async function writeOrderViewToken(orderNumber: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const sig = sign(orderNumber, exp);
  const value = `${orderNumber}.${exp}.${sig}`;
  (await cookies()).set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function clearOrderViewToken(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

/**
 * Returns true iff the cookie is present, signed with our secret, not
 * expired, AND bound to the exact order number passed in. Timing-safe
 * comparison so we don't leak the signature byte-by-byte.
 */
export async function verifyOrderViewToken(
  orderNumber: string,
): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  const [cookieOrder, expStr, sig] = parts;
  if (cookieOrder !== orderNumber) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;

  const expected = sign(cookieOrder, exp);
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
