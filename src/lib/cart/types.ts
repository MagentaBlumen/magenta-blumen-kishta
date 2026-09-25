/**
 * Cart types.
 *
 * The cookie layer holds IDs and quantities ONLY - never a price, never a
 * subtotal, never a total. Prices re-derive server-side at hydrate time.
 * If a cookie ever carries a total and checkout trusts it, someone edits
 * the cookie to make a CHF 95 bouquet cost CHF 5 and Stripe charges it.
 *
 * See src/lib/cart/hydrate.ts for the DB-side re-derivation, and
 * src/lib/cart/actions.ts for the server actions that mutate the cookie.
 */

// -------- On-the-wire cookie shape --------
//
// Field names are single letters to keep the cookie small (browsers cap
// per-cookie storage at ~4 KB; each line is 3 tiny numbers). A cart of 20
// items encodes to ~600 chars, well within limits.

export type CartLineCookie = {
  /** product.id */
  p: number;
  /** product_variant.id */
  v: number;
  /** quantity, integer >= 1 */
  q: number;
};

export type CartCookie = {
  l: CartLineCookie[];
};

export const EMPTY_CART_COOKIE: CartCookie = { l: [] };

// -------- Runtime / hydrated shape --------
//
// What server components + the cart / checkout UI actually consume. Every
// monetary value here originated in the DB read done by hydrateCart(),
// never in the cookie.

export type HydratedCartLine = {
  productId: number;
  variantId: number;
  qty: number;

  // Display fields (server-derived).
  productSlug: string;
  productNameDe: string;
  variantLabelDe: string | null;
  imageUrl: string | null;
  imageAlt: string | null;

  // Money (server-derived from live DB rows).
  unitPriceGross: string;     // numeric(10,2) as string, per project convention
  lineTotalGross: string;     // qty * unitPriceGross, formatted to 2dp

  // Tax rate is deliberately NOT fetched here - the cart display doesn't
  // show VAT breakdown. Checkout (5f) joins tax_rate via product.tax_rate_id
  // as part of the reserve transaction and snapshots it onto order_line.

  isAvailable: boolean;       // product + variant both available
};

export type HydratedCart = {
  lines: HydratedCartLine[];

  /** Sum of lineTotalGross across all lines, formatted 2dp. */
  subtotalGross: string;

  /** How many lines the cookie carried that had to be dropped (product
   *  archived / variant deleted / etc). The cart UI shows a "1 Artikel
   *  wurde entfernt" notice when this is > 0. */
  droppedCount: number;
};
