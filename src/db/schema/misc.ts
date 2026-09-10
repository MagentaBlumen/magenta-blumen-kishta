import { sql } from 'drizzle-orm';
import {
  pgTable, bigserial, bigint, serial, integer, text, boolean, numeric, date,
  timestamp, index, check,
} from 'drizzle-orm/pg-core';
import { discountType, notifyChannel, notifyRecipient, enquiryType } from './enums';
import { order } from './order';

/* ------------------------------------------------------------------ */
/* Discounts and loyalty                                               */
/* ------------------------------------------------------------------ */

/** Applies to the whole order, not specific lines (Q93). Never combines (Q95). */
export const discountCode = pgTable(
  'discount_code',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    code: text('code').notNull().unique(),
    type: discountType('type').notNull(),
    value: numeric('value', { precision: 10, scale: 2 }).notNull(),
    minOrderGross: numeric('min_order_gross', { precision: 10, scale: 2 }),
    maxUses: integer('max_uses'),
    usesCount: integer('uses_count').notNull().default(0),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [check('discount_value_non_negative', sql`${t.value} >= 0`)],
);

/**
 * Tier is COMPUTED at checkout from a live count of the customer's
 * delivered-and-paid orders, then SNAPSHOT onto the order.
 *
 * There is deliberately no lifetime_orders counter on the customer row - it
 * drifts on every cancellation and refund. At 4-5 orders a day, counting on
 * the fly is one query and always correct.
 *
 * Rules to hold:
 *   - never applies to delivery_fee_gross
 *   - never stacks with a discount code
 *   - "counts" means delivered AND paid
 *
 * TODO(aunt): thresholds and percentages. And whether it counts ORDERS or
 * FRANCS SPENT - ten CHF 40 orders vs three CHF 200 ones reward very
 * different customers.
 */
export const loyaltyTier = pgTable(
  'loyalty_tier',
  {
    id: serial('id').primaryKey(),
    nameDe: text('name_de').notNull(),
    minCompletedOrders: integer('min_completed_orders').notNull(),
    percent: numeric('percent', { precision: 5, scale: 2 }).notNull(),
  },
  (t) => [check('tier_percent_range', sql`${t.percent} > 0 AND ${t.percent} < 100`)],
);

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

/**
 * recipient_type can only be buyer | shop | driver - see notifyRecipient in
 * enums.ts. The person RECEIVING the flowers is structurally unreachable.
 *
 * The driver is notified by SMS or WhatsApp: she said the woman who delivers
 * is older and that is enough. No app, no driver login.
 */
export const notificationLog = pgTable(
  'notification_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /* no cascade - see order.ts. Orders are never hard-deleted. */
    orderId: bigint('order_id', { mode: 'number' }).references(() => order.id),
    channel: notifyChannel('channel').notNull(),
    recipientType: notifyRecipient('recipient_type').notNull(),
    address: text('address').notNull(),
    template: text('template').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    status: text('status'),
    error: text('error'),
  },
  (t) => [index('notification_order_idx').on(t.orderId)],
);

/* ------------------------------------------------------------------ */
/* Enquiries                                                           */
/* ------------------------------------------------------------------ */

/**
 * Weddings, events, funeral ceremony work and the gardening service do not go
 * through checkout.
 *
 * The gardening service (Q12 - ordering a gardener to plant flowers on site)
 * is a booked service with a site visit and no fixed price. It cannot use a
 * shopping cart.
 *
 * Note: funeral BOUQUETS stay orderable as normal timed deliveries. Only the
 * full ceremony arrangements are enquiry-only.
 */
export const enquiry = pgTable(
  'enquiry',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    type: enquiryType('type').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    eventDate: date('event_date'),
    budgetRange: text('budget_range'),
    message: text('message'),
    status: text('status').notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('enquiry_status_idx').on(t.status, t.createdAt)],
);
