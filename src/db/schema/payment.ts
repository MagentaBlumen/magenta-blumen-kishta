import { sql } from 'drizzle-orm';
import {
  pgTable, bigserial, bigint, text, numeric, timestamp, jsonb, uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { paymentMethod, paymentStatus } from './enums';
import { order } from './order';

/**
 * AT MOST ONE LIVE PAYMENT PER ORDER.
 *
 * A gift card covers part of the total, then ONE method covers the rest.
 * Never two live captures - "part TWINT, part Visa" is a materially harder
 * product and she does not need it.
 *
 * The partial unique index below uses  WHERE status <> 'failed',
 * NOT  WHERE status = 'succeeded'.
 *
 * The difference matters. With = 'succeeded', a pending payment collides with
 * nothing, so an order can accumulate several pending intents. A webhook
 * arrives, then a second for a different intent, and both can succeed before
 * either is written - a double charge, with the constraint never firing
 * because it only watched the finished state. <> 'failed' blocks a second
 * live payment from the moment it is created.
 */
export const payment = pgTable(
  'payment',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => order.id),

    method: paymentMethod('method').notNull(),
    /** NULL for cash and invoice */
    providerPaymentIntentId: text('provider_payment_intent_id').unique(),

    amountGross: numeric('amount_gross', { precision: 10, scale: 2 }).notNull(),
    status: paymentStatus('status').notNull().default('pending'),
    paidAt: timestamp('paid_at', { withTimezone: true }),

    /** cash / invoice: who at the counter marked it paid. Audit trail. */
    markedPaidBy: text('marked_paid_by'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('one_live_payment_per_order')
      .on(t.orderId)
      .where(sql`status <> 'failed'`),
    index('payment_status_idx').on(t.status),
  ],
);

/**
 * THE idempotency guarantee.
 *
 * Stripe RETRIES failed webhook deliveries. Insert the event row FIRST; if
 * the unique constraint rejects it, this is a retry - return 200 and stop.
 *
 * Without this you get one payment and three orders. Deduplicating in
 * application code instead is NOT equivalent: the constraint holds even when
 * the handler is wrong, which on a first project it sometimes will be.
 *
 * Reminder for the handler: Next.js parses request bodies by default and
 * signature verification fails against parsed JSON. Use await req.text() and
 * pass that raw string to stripe.webhooks.constructEvent.
 */
export const stripeEvent = pgTable(
  'stripe_event',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    stripeEventId: text('stripe_event_id').notNull().unique(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
  },
  (t) => [index('stripe_event_processed_idx').on(t.processedAt)],
);

/**
 * She said customers just contact the shop (Q86, Q90) - fine, but the record
 * must exist. When gift cards arrive in Phase 3, a gift-card-funded portion
 * refunds as RESTORED BALANCE, not cash.
 */
export const refund = pgTable(
  'refund',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => order.id),
    paymentId: bigint('payment_id', { mode: 'number' }).references(() => payment.id),
    amountGross: numeric('amount_gross', { precision: 10, scale: 2 }).notNull(),
    reason: text('reason'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('refund_order_idx').on(t.orderId)],
);
