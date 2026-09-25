import "server-only";
import { cookies } from "next/headers";
import {
  CheckoutCookie,
  EMPTY_CHECKOUT_COOKIE,
} from "./types";

/**
 * Checkout progress cookie. Mirrors the cart cookie's design: HttpOnly,
 * SameSite=Lax, Secure in prod. Persists step-1 output across the
 * /kasse/lieferung -> /kasse/lieferdaten -> /kasse/bestaetigen walk.
 *
 * Not a source of truth. The reserve transaction (5f) re-derives every
 * value server-side from the IDs.
 */

const COOKIE_NAME = "mb_checkout";
const COOKIE_MAX_AGE_SECONDS = 6 * 60 * 60; // 6 hours - long enough for a
                                            // slow checkout, short enough
                                            // that a stale run/zone gets
                                            // re-resolved on next visit.

export async function readCheckoutCookie(): Promise<CheckoutCookie> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return { ...EMPTY_CHECKOUT_COOKIE };
  return parseCheckoutCookie(raw);
}

export async function writeCheckoutCookie(state: CheckoutCookie): Promise<void> {
  (await cookies()).set(COOKIE_NAME, JSON.stringify(state), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearCheckoutCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

/**
 * Merge partial updates into the cookie in one atomic-ish read-modify-write.
 * Server actions call this rather than round-tripping the whole state.
 */
export async function patchCheckoutCookie(
  patch: Partial<CheckoutCookie>,
): Promise<CheckoutCookie> {
  const current = await readCheckoutCookie();
  const next = { ...current, ...patch };
  await writeCheckoutCookie(next);
  return next;
}

// -------- Parsing --------

export function parseCheckoutCookie(raw: string): CheckoutCookie {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_CHECKOUT_COOKIE };
    const r = parsed as Record<string, unknown>;
    const out: CheckoutCookie = {};

    if (typeof r.plz === "string" && /^\d{4}$/.test(r.plz)) out.plz = r.plz;
    if (typeof r.ort === "string" && r.ort.length > 0 && r.ort.length < 100) {
      out.ort = r.ort;
    }
    if (typeof r.zid === "number" && Number.isInteger(r.zid) && r.zid > 0) {
      out.zid = r.zid;
    }
    if (r.ful === "run" || r.ful === "timed" || r.ful === "pickup") {
      out.ful = r.ful;
    }
    if (typeof r.rid === "number" && Number.isInteger(r.rid) && r.rid > 0) {
      out.rid = r.rid;
    }
    if (typeof r.rda === "string" && r.rda.length > 0 && r.rda.length < 40) {
      out.rda = r.rda;
    }
    if (typeof r.pd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.pd)) {
      out.pd = r.pd;
    }
    return out;
  } catch {
    return { ...EMPTY_CHECKOUT_COOKIE };
  }
}
