import { sql } from 'drizzle-orm';
import {
  pgTable, bigserial, bigint, text, char, timestamp, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

/**
 * Guest checkout is the default. Accounts are OPTIONAL, offered after payment
 * on the confirmation page ("Ihre Daten für das nächste Mal speichern?"). Every
 * order snapshots buyer name / email / phone regardless of whether an account
 * exists, so the checkout writes an order.customer_id of NULL for guests.
 *
 * Email is verified by link once an account is created, but NOTHING is gated
 * on the click. The account works immediately; the click only unlocks the
 * password-reset flow. Gating on a clicked link would strand people who
 * mistyped their address.
 *
 * Password reset goes by EMAIL (single-use token, short expiry, invalidated on
 * use). If a customer requests a reset on an unverified address, tell them
 * plainly and route them to the shop.
 *
 * The phone is REQUIRED at checkout (Q84, Q85: failed deliveries are recovered
 * by phone) but NOT verified. Format-validate client-side against a Swiss
 * pattern and echo back for confirmation - a typo is the realistic failure,
 * not fraud.
 *
 * This design is a scope reduction from an earlier plan that required Twilio
 * Verify at checkout. See CLAUDE.md open questions for the cash-on-delivery
 * fallback if unverified guests are ever abused.
 */
export const customer = pgTable(
  'customer',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    email: text('email').notNull(),
    phone: text('phone'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    passwordHash: text('password_hash').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /**
     * Revised Swiss FADP: a customer may request erasure. But her orders must
     * be retained for accounting (ten years), and orders snapshot the buyer
     * details anyway.
     *
     * So we ANONYMISE rather than delete: null out email, phone, names and
     * password_hash, set this timestamp, keep the row. Foreign keys stay
     * intact, past orders are untouched, and the person is unidentifiable
     * from the customer table.
     *
     * Never hard-delete a customer who has orders.
     */
    anonymisedAt: timestamp('anonymised_at', { withTimezone: true }),
  },
  (t) => [
    /**
     * Functional unique index rather than the citext extension - one less
     * extension to install on the Hetzner box.
     * Always look customers up with lower(email) = lower($1).
     */
    uniqueIndex('customer_email_lower_unique').on(sql`lower(${t.email})`),
    index('customer_phone_idx').on(t.phone),
  ],
);

/**
 * Address book for repeat senders (Q105).
 * Orders COPY from here. They never reference it - see the snapshot rule
 * in order.ts.
 */
export const customerAddress = pgTable(
  'customer_address',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    customerId: bigint('customer_id', { mode: 'number' })
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    labelDe: text('label_de'),
    recipientName: text('recipient_name').notNull(),
    street: text('street').notNull(),
    plz: char('plz', { length: 4 }).notNull(),
    city: text('city').notNull(),
    phone: text('phone'),
    notes: text('notes'),
  },
  (t) => [index('address_customer_idx').on(t.customerId)],
);

