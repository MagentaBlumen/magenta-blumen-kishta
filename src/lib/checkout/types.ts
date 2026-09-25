/**
 * Checkout session types.
 *
 * Progressive state persisted in the mb_checkout cookie as the customer
 * walks through /kasse/lieferung -> /kasse/lieferdaten -> /kasse/bestaetigen.
 * Every field is optional because the customer fills in fields as they go.
 *
 * At reserve time (5f) the checkout server action re-validates everything
 * server-side from these IDs - the cookie is a UX affordance, not a
 * source of truth. Same principle as the cart cookie.
 */

// -------- On-the-wire cookie shape --------
//
// Field names abbreviated for cookie size + so the shape is stable if
// the customer's cookie survives a schema-adjacent rename.

export type DeliveryContextCookie = "residential" | "business" | "hospital" | "funeral";

export type CheckoutCookie = {
  // -------- Step 1: PLZ + slot --------
  /** delivery_zone_plz.plz - always 4 chars once set */
  plz?: string;
  /** delivery_zone_plz.ortschaft - required to disambiguate PLZ 5415 case */
  ort?: string;
  /** delivery_zone.id resolved from (plz, ort). Kept so subsequent steps
   *  don't re-run the join; re-validated at reserve time. */
  zid?: number;

  /** 'run' | 'timed' | 'pickup'. Determines which slot field is set. */
  ful?: "run" | "timed" | "pickup";

  /** delivery_run.id for fulfilment='run' */
  rid?: number;

  /** ISO-8601 with tz offset for fulfilment='timed'. Ceremony time. */
  rda?: string;

  /** ISO date (YYYY-MM-DD) for fulfilment='pickup'. Pickup happens at
   *  the shop, no run, no timed slot needed. */
  pd?: string;

  // -------- Step 2: buyer + recipient + context --------
  // Field names are short so the cookie stays comfortably under 4 KB
  // even with a long card message + delivery instructions. Comments
  // below map each to its order.* column so the reserve step in 5f is
  // a mechanical translation.

  /** buyer.name */                bn?: string;
  /** buyer.email */               be?: string;
  /** buyer.phone (required, not verified) */ bp?: string;

  /** recipient.name */            rn?: string;
  /** recipient.phone */           rp?: string;
  /** delivery_street */           st?: string;

  /** delivery_context enum */     dc?: DeliveryContextCookie;
  /** hospital ward */             dw?: string;
  /** hospital room */             dm?: string;
  /** funeral deceased name */     dn?: string;
  /** funeral family contact */    fc?: string;

  /** delivery_instructions (free text) */    di?: string;
  /** card_message */                          cm?: string;
  /** card_is_anonymous */                     ca?: boolean;
  /** ribbon_text (Trauerband) */              rt?: string;
};

export const EMPTY_CHECKOUT_COOKIE: CheckoutCookie = {};

// -------- Zone resolution results --------

export type ResolvedZone = {
  zoneId: number;
  zoneNameDe: string;
  ortschaft: string;
  plz: string;
  feeGross: string;         // numeric string
  minOrderGross: string;    // numeric string, may exceed the global 40
  freeOverGross: string | null;
};

export type PlzLookupResult =
  | { kind: "none" }                                           // 0 rows
  | { kind: "single"; zone: ResolvedZone }                     // 1 row
  | { kind: "picker"; options: PlzPickerOption[] };            // 2+ rows

export type PlzPickerOption = {
  ortschaft: string;
  zoneId: number;
  zoneNameDe: string;
  feeGross: string;
  minOrderGross: string;
};
