import { sql } from 'drizzle-orm';
import {
  pgTable, bigserial, bigint, integer, text, boolean, numeric, char, date, time,
  timestamp, index, check, type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { orderStatus, fulfilmentType, deliveryContext } from './enums';
import { customer } from './customer';
import { deliveryRun } from './delivery';
import { product, productVariant } from './catalogue';

/**
 * ===================================================================
 * RULE 1 - ORDERS SNAPSHOT. THEY NEVER REFERENCE.
 * ===================================================================
 * Every money and address value below is a VALUE, copied at checkout.
 * product_id and variant_id on order_line exist for REPORTING ONLY and must
 * never be joined to fetch a price, a name or a tax rate for display.
 *
 * When she raises the Fruehlingsstrauss from 45 to 49 in March, every
 * February order must still read 45.
 *
 * AI-generated code gets this wrong by default. It will hand you
 * order_line.product_id joined to the current price. That looks correct and
 * silently corrupts her accounting the first time she edits anything.
 */
export const order = pgTable(
  'order',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orderNumber: text('order_number').notNull().unique(),

    /** NULLABLE on purpose - the guest-checkout escape hatch. See customer.ts */
    customerId: bigint('customer_id', { mode: 'number' }).references(() => customer.id),

    status: orderStatus('status').notNull().default('new'),

    /* ---------------- buyer (snapshot) ---------------- */
    buyerName: text('buyer_name').notNull(),
    buyerEmail: text('buyer_email').notNull(),
    buyerPhone: text('buyer_phone'),
    buyerPhoneVerifiedAt: timestamp('buyer_phone_verified_at', { withTimezone: true }),

    /* ---------------- recipient (snapshot) ----------------
     * Q65: almost always a gift, so the recipient is a DIFFERENT PERSON.
     * Q66: the recipient must NEVER be emailed - it spoils the surprise.
     *      Enforced structurally by the notify_recipient enum having no
     *      'recipient' value.
     */
    recipientName: text('recipient_name').notNull(),
    recipientPhone: text('recipient_phone'),
    deliveryStreet: text('delivery_street'),
    deliveryPlz: char('delivery_plz', { length: 4 }),
    deliveryCity: text('delivery_city'),
    deliveryZoneName: text('delivery_zone_name'),

    /** residential | business | hospital | funeral - drives extra fields */
    deliveryContext: deliveryContext('delivery_context').notNull().default('residential'),

    /** hospital deliveries: many Swiss hospitals need ward + room */
    deliveryWard: text('delivery_ward'),
    deliveryRoom: text('delivery_room'),

    /** funeral: church / cemetery, name of the deceased, family contact */
    deceasedName: text('deceased_name'),
    familyContactPhone: text('family_contact_phone'),

    deliveryInstructions: text('delivery_instructions'),

    /** handwritten card. No character limit (Q68). */
    cardMessage: text('card_message'),
    cardIsAnonymous: boolean('card_is_anonymous').notNull().default(false),

    /**
     * Trauerband. Separate from card_message on purpose - it is PRINTED,
     * has a hard character limit, and is a different physical object.
     */
    ribbonText: text('ribbon_text'),

    /* ---------------- fulfilment ---------------- */
    fulfilment: fulfilmentType('fulfilment').notNull(),
    /* Conditionally required: order_run_requires_run_id below enforces
       (fulfilment='run') = (deliveryRunId IS NOT NULL). Column stays nullable
       at the DB level so timed / pickup / post orders can carry NULL here. */
    deliveryRunId: bigint('delivery_run_id', { mode: 'number' }).references(
      () => deliveryRun.id,
    ),

    /**
     * timed only. This is the CEREMONY time, not the delivery time -
     * she delivers roughly an hour before. Capped at 3 per hour
     * (settings.timed_deliveries_per_hour), checked under the same
     * FOR UPDATE pattern as run capacity.
     */
    requestedDeliveryAt: timestamp('requested_delivery_at', { withTimezone: true }),

    /**
     * SNAPSHOT for the Heute screen, set at checkout. Denormalised on purpose.
     *
     * Run orders carry delivery_run_id; timed orders carry
     * requested_delivery_at. Without these two columns the Heute query has to
     * branch on fulfilment type and join delivery_run, which is two code paths
     * and awkward to index - on the one screen Sandra uses every day.
     *
     * With them it is one indexed query:
     *   WHERE delivery_date = $today AND status <> 'cancelled'
     *   ORDER BY sort_time, route_stop_order
     *
     * Populate at checkout, in Europe/Zurich:
     *   run    -> run.run_date, run.window_start
     *   timed  -> requested_delivery_at date and time
     *   pickup -> the pickup date and time
     *
     * These are a VIEW of the source of truth, not the source of truth. If the
     * order is moved to another run, update both.
     */
    deliveryDate: date('delivery_date'),
    sortTime: time('sort_time'),

    /** manual sequence so she can drag the van's stops into driving order */
    routeStopOrder: integer('route_stop_order'),

    /** print-locking on the counter printer - stops one order being made twice */
    printedAt: timestamp('printed_at', { withTimezone: true }),

    /**
     * Shop-only. Never rendered to the customer, never printed on the ticket.
     * "Customer called about the address", "second attempt Saturday".
     */
    internalNotes: text('internal_notes'),

    /* ---------------- money (all gross, all snapshots) ---------------- */
    subtotalGross: numeric('subtotal_gross', { precision: 10, scale: 2 }).notNull(),

    discountCodeSnapshot: text('discount_code_snapshot'),
    discountGross: numeric('discount_gross', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),

    /** computed at checkout from a live count, then FROZEN here */
    loyaltyTierSnapshot: text('loyalty_tier_snapshot'),
    loyaltyPercentSnapshot: numeric('loyalty_percent_snapshot', { precision: 5, scale: 2 }),

    /**
     * PHASE 3 ESCAPE HATCH. Always 0 in Phase 1, since gift cards are deferred.
     *
     * Do NOT let anyone remove this column on the grounds that it is unused.
     * Its existence is what makes gift cards a ~45 hour additive feature later
     * instead of an 80 hour rewrite of orders, payments and checkout on live
     * production data.
     */
    giftcardAppliedGross: numeric('giftcard_applied_gross', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),

    /** taxed at the standard rate even though the flowers are reduced */
    deliveryFeeGross: numeric('delivery_fee_gross', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    deliveryFeeTaxRate: numeric('delivery_fee_tax_rate', { precision: 5, scale: 4 }),

    totalGross: numeric('total_gross', { precision: 10, scale: 2 }).notNull(),

    /**
     * amount_due = total - giftcard_applied.
     *
     * WHEN THIS IS 0 THERE IS NO PAYMENT ROW AND NO WEBHOOK WILL EVER FIRE.
     * Order-completion logic that hangs off the webhook will create the order,
     * never mark it paid, and it will never appear on the Heute screen.
     *
     * Handle it explicitly: if amount_due = 0, mark paid at creation and skip
     * the payment step. Nothing can produce a zero in Phase 1 - implement it
     * anyway, so Phase 3 never has to touch the checkout core.
     */
    amountDueGross: numeric('amount_due_gross', { precision: 10, scale: 2 }).notNull(),

    placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('order_run_idx').on(t.deliveryRunId),
    /** the Heute screen: one indexed query, no branching on fulfilment type */
    index('order_delivery_date_idx').on(t.deliveryDate, t.sortTime),
    /** phone lookup is the primary admin search path - the caller's number */
    index('order_buyer_phone_idx').on(t.buyerPhone),
    index('order_recipient_phone_idx').on(t.recipientPhone),
    index('order_recipient_name_idx').on(t.recipientName),
    index('order_buyer_name_idx').on(t.buyerName),
    index('order_status_placed_idx').on(t.status, t.placedAt),
    index('order_customer_idx').on(t.customerId),
    /** the Heute screen: today's orders by run, then by manual route order */
    index('order_today_idx').on(t.deliveryRunId, t.routeStopOrder),
    index('order_timed_idx').on(t.requestedDeliveryAt),

    check(
      'order_run_requires_run_id',
      sql`(${t.fulfilment} = 'run') = (${t.deliveryRunId} IS NOT NULL)`,
    ),
    check(
      'order_timed_requires_datetime',
      sql`(${t.fulfilment} = 'timed') = (${t.requestedDeliveryAt} IS NOT NULL)`,
    ),
    check(
      'order_amount_due_consistent',
      sql`${t.amountDueGross} = ${t.totalGross} - ${t.giftcardAppliedGross}`,
    ),
    check('order_amount_due_non_negative', sql`${t.amountDueGross} >= 0`),
  ],
);

export const orderLine = pgTable(
  'order_line',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => order.id),
    /* NO onDelete cascade, deliberately. Orders are NEVER hard-deleted -
       Swiss law requires ten-year retention of business records, and a stray
       DELETE would take the accounting history with it. Use status =
       'cancelled'. A DELETE should fail loudly. */

    /**
     * Add-ons (vase, chocolate, ribbon) hang off the bouquet line they belong
     * to, so the printed ticket shows what goes with what.
     *
     * NULL = bought standalone, which is allowed - is_addon controls whether
     * a product appears in the add-on picker, not whether it can be ordered
     * on its own.
     */
    parentLineId: bigint('parent_line_id', { mode: 'number' }).references(
      (): AnyPgColumn => orderLine.id,
      { onDelete: 'cascade' },
    ),

    /* -------- REPORTING ONLY. Never join these to render an order. -------- */
    productId: bigint('product_id', { mode: 'number' }).references(() => product.id),
    variantId: bigint('variant_id', { mode: 'number' }).references(() => productVariant.id),

    /* -------- SNAPSHOT -------- */
    productNameDe: text('product_name_de').notNull(),
    variantLabelDe: text('variant_label_de'),
    unitPriceGross: numeric('unit_price_gross', { precision: 10, scale: 2 }).notNull(),
    /** 0.0260 or 0.0810, frozen at purchase time */
    taxRate: numeric('tax_rate', { precision: 5, scale: 4 }),
    quantity: integer('quantity').notNull().default(1),
    lineTotalGross: numeric('line_total_gross', { precision: 10, scale: 2 }).notNull(),

    /* -------- custom bouquet fields (Q31, Q32) -------- */
    colourPreference: text('colour_preference'),
    /** scented flowers, allergies - she asked for this specifically */
    avoidNotes: text('avoid_notes'),
  },
  (t) => [
    index('line_order_idx').on(t.orderId),
    index('line_parent_idx').on(t.parentLineId),
    check('line_quantity_positive', sql`${t.quantity} > 0`),
  ],
);
