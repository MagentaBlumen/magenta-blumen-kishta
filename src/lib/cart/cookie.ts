import "server-only";
import { cookies } from "next/headers";
import { CartCookie, CartLineCookie, EMPTY_CART_COOKIE } from "./types";

/**
 * Cart cookie read / write helpers.
 *
 * The cookie is HttpOnly + SameSite=Lax and (in prod) Secure. HttpOnly is
 * appropriate because only server code reads or mutates it - the UI reads
 * the cart via hydrateCart() from server components.
 *
 * A malformed cookie is treated as an empty cart, never an error. Cookies
 * are user-editable; the checkout re-derivation of prices is the actual
 * safety guarantee, not the cookie's shape.
 */

const COOKIE_NAME = "mb_cart";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

// -------- Low-level cookie r/w --------

export async function readCartCookie(): Promise<CartCookie> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return EMPTY_CART_COOKIE;
  return parseCartCookie(raw);
}

export async function writeCartCookie(cart: CartCookie): Promise<void> {
  (await cookies()).set(COOKIE_NAME, JSON.stringify(cart), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearCartCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

// -------- Parsing --------
//
// Cookies are user-controlled input. Validate shape aggressively; never
// throw on a bad cookie - it just means "no cart".

export function parseCartCookie(raw: string): CartCookie {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return EMPTY_CART_COOKIE;
    const l = (parsed as { l?: unknown }).l;
    if (!Array.isArray(l)) return EMPTY_CART_COOKIE;
    const lines: CartLineCookie[] = [];
    for (const raw of l) {
      const line = normaliseLine(raw);
      if (line) lines.push(line);
    }
    return { l: lines };
  } catch {
    return EMPTY_CART_COOKIE;
  }
}

function normaliseLine(raw: unknown): CartLineCookie | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p = Number(r.p);
  const v = Number(r.v);
  const q = Number(r.q);
  if (!Number.isInteger(p) || p <= 0) return null;
  if (!Number.isInteger(v) || v <= 0) return null;
  if (!Number.isInteger(q) || q <= 0) return null;
  // Cap qty at a sane upper bound so a tampered cookie can't ask for
  // 999_999 stems and lock the checkout on an oversized query.
  const cappedQty = Math.min(q, 99);
  return { p, v, q: cappedQty };
}

// -------- Pure mutations (no cookie I/O) --------
//
// Kept separate from the r/w helpers so they're trivially testable and
// so the server actions in ./actions.ts can compose them without doing
// two cookie reads.

export function addLineToCart(
  cart: CartCookie,
  productId: number,
  variantId: number,
  qty: number,
): CartCookie {
  if (qty <= 0) return cart;
  const cappedQty = Math.min(qty, 99);
  const idx = cart.l.findIndex(
    (l) => l.p === productId && l.v === variantId,
  );
  if (idx === -1) {
    return { l: [...cart.l, { p: productId, v: variantId, q: cappedQty }] };
  }
  const next = [...cart.l];
  next[idx] = {
    ...next[idx],
    q: Math.min(next[idx].q + cappedQty, 99),
  };
  return { l: next };
}

export function setLineQtyInCart(
  cart: CartCookie,
  productId: number,
  variantId: number,
  qty: number,
): CartCookie {
  if (qty <= 0) return removeLineFromCart(cart, productId, variantId);
  const cappedQty = Math.min(qty, 99);
  const idx = cart.l.findIndex(
    (l) => l.p === productId && l.v === variantId,
  );
  if (idx === -1) return cart;
  const next = [...cart.l];
  next[idx] = { ...next[idx], q: cappedQty };
  return { l: next };
}

export function removeLineFromCart(
  cart: CartCookie,
  productId: number,
  variantId: number,
): CartCookie {
  return {
    l: cart.l.filter((l) => !(l.p === productId && l.v === variantId)),
  };
}

export function totalItemCount(cart: CartCookie): number {
  let total = 0;
  for (const l of cart.l) total += l.q;
  return total;
}
