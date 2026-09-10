import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * How a product is priced.
 *  variant  – customer picks a size/tier. Bouquets (Klein/Mittel/Gross),
 *             plants, and the "you choose the flowers" tiers.
 *  per_unit – quantity x unit price. Roses by the stem.
 *             INVARIANT: exactly one variant row, whose price_gross is the
 *             price of ONE stem, not of the product. Enforced by CHECK below.
 *  enquiry  – no checkout at all. Weddings, events, gardening service.
 */
export const pricingMode = pgEnum('pricing_mode', ['variant', 'per_unit', 'enquiry']);

/**
 * run   – goes on a normal 10-12 or 16-18 delivery round.
 * timed – customer gives an exact time (funerals, weddings). Delivered ~1h before.
 */
export const slotType = pgEnum('slot_type', ['run', 'timed']);

/**
 * range    – what the thing IS (Schnittblumen, Zimmerpflanzen)
 * occasion – why you're BUYING it (Geburtstag, Trauer, Valentinstag)
 * A product normally sits in one range and several occasions.
 */
export const categoryKind = pgEnum('category_kind', ['range', 'occasion']);

export const deliveryMethod = pgEnum('delivery_method', ['own_van', 'post', 'pickup']);

export const orderStatus = pgEnum('order_status', [
  'new',
  'confirmed',
  'in_production',
  'ready',
  'out_for_delivery',
  'delivered',
  'delivery_failed',
  'cancelled',
]);

export const fulfilmentType = pgEnum('fulfilment_type', ['run', 'timed', 'pickup', 'post']);

/**
 * Where the flowers are actually going. Drives which extra fields the
 * checkout asks for and what the printed ticket shows.
 *  residential – normal home delivery
 *  business    – reception desk, company name matters
 *  hospital    – needs ward + room. Many Swiss hospitals accept bouquets only
 *                (no soil, no floral foam) and nothing to intensive care.
 *  funeral     – church / cemetery / Abdankungshalle, ceremony time,
 *                name of the deceased, family contact number.
 */
export const deliveryContext = pgEnum('delivery_context', [
  'residential',
  'business',
  'hospital',
  'funeral',
]);

export const paymentMethod = pgEnum('payment_method', ['card', 'twint', 'cash', 'invoice']);

export const paymentStatus = pgEnum('payment_status', [
  'pending',
  'succeeded',
  'failed',
  'refunded',
]);

export const notifyChannel = pgEnum('notify_channel', ['email', 'sms', 'push']);

/**
 * DELIBERATELY has no 'recipient' value.
 *
 * The person receiving the flowers must NEVER be emailed - almost every order
 * is a gift and a confirmation to the recipient spoils the surprise (Q66).
 * Leaving the value out of the enum makes that mistake impossible to make,
 * rather than something a future developer has to remember.
 */
export const notifyRecipient = pgEnum('notify_recipient', ['buyer', 'shop', 'driver']);

export const discountType = pgEnum('discount_type', ['percent', 'fixed', 'free_delivery']);

export const enquiryType = pgEnum('enquiry_type', ['wedding', 'event', 'funeral', 'gardening']);
