import { sql } from 'drizzle-orm';
import {
  pgTable, bigserial, bigint, text, char, timestamp, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

/**
 * Phase 1 requires registration at checkout: email, password, phone.
 *
 * The PHONE is verified via Twilio Verify. The EMAIL is never verified -
 * it is a contact channel, not an identity check. An email round-trip at
 * 22:00 loses people who would otherwise have finished, and the phone is
 * what she actually needs: Q84 and Q85 are both "we just call them", so a
 * working number IS the failure-recovery mechanism for this business.
 *
 * Consequence to remember: with no verified email, PASSWORD RESET MUST GO BY
 * SMS. An email reset link would let someone who mistyped their address lock
 * themselves out permanently with no recovery path. Same Twilio integration.
 *
 * NOTE: customer_id on the order table is deliberately NULLABLE, and orders
 * snapshot buyer name / email / phone regardless. Registration is mandatory
 * BY POLICY, not by database constraint. Moving to guest checkout later is
 * then a one-line change rather than a migration on live data.
 */
export const customer = pgTable(
  'customer',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    email: text('email').notNull(),
    phone: text('phone'),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
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

/**
 * SMS rate limiting for phone verification.
 *
 * Twilio Verify already caps CODE GUESSES (5 checks per verification, expiring
 * after ~10 minutes). This table caps SEND REQUESTS, which is the part that
 * costs money.
 *
 * Two limits, because they stop different attacks:
 *   per phone  - 3 per hour, 5 per day. Stops one number being spammed, and
 *                stops Twilio flagging the account for odd traffic.
 *   per IP     - 10 per hour. Stops the EXPENSIVE attack: a thousand different
 *                numbers, each a fresh SMS at full price, where a per-number
 *                limit never fires because no number repeats.
 *
 * NORMALISE THE PHONE TO E.164 BEFORE INSERTING. "+41791234567" and
 * "079 123 45 67" are the same person; storing both makes the limit trivially
 * bypassable by reformatting.
 *
 * The IP is HASHED, not stored raw - an IP address is personal data under the
 * revised Swiss FADP, and a salted hash rate-limits just as well.
 *
 * Cleanup: delete rows older than 24h on the nightly job. This table should
 * never grow past a few hundred rows.
 */
export const verificationAttempt = pgTable(
  'verification_attempt',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** E.164, normalised */
    phone: text('phone').notNull(),
    /** salted hash of the request IP, never the raw address */
    ipHash: text('ip_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('verification_phone_idx').on(t.phone, t.createdAt),
    index('verification_ip_idx').on(t.ipHash, t.createdAt),
  ],
);
