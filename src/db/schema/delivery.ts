import { sql } from 'drizzle-orm';
import {
  pgTable, bigserial, serial, integer, text, boolean, numeric, date, time,
  char, uniqueIndex, index, check,
} from 'drizzle-orm/pg-core';
import { deliveryMethod } from './enums';

/* ------------------------------------------------------------------ */
/* Zones                                                               */
/* ------------------------------------------------------------------ */

/**
 * 29 zones transcribed from her printed price sheet, fees CHF 8-20.
 * Handwritten corrections on that sheet override the printed values
 * (Ruetihof 10 not 12, Turgi 15 not 18).
 *
 * The list crosses cantonal borders - Otelfingen is Kanton Zuerich,
 * Killwangen / Spreitenbach / Wuerenlos are in the 8xxx range. Further proof
 * that a radius calculation would have been the wrong model.
 */
export const deliveryZone = pgTable(
  'delivery_zone',
  {
    id: serial('id').primaryKey(),
    nameDe: text('name_de').notNull(),
    method: deliveryMethod('method').notNull().default('own_van'),

    /** taxed at the standard rate, unlike the flowers themselves */
    feeGross: numeric('fee_gross', { precision: 10, scale: 2 }).notNull(),

    /**
     * Defaults to the global CHF 40, but is NOT uniform:
     * Untersiggenthal is 50, Brugg Stadt is 50 or 60 (handwriting ambiguous).
     * The postal zone needs its own, much higher - her own example was a
     * CHF 40 bouquet to Bern costing CHF 22 in postage, which doesn't work.
     */
    minOrderGross: numeric('min_order_gross', { precision: 10, scale: 2 })
      .notNull()
      .default('40.00'),

    /** NULL = delivery is never free in this zone */
    freeOverGross: numeric('free_over_gross', { precision: 10, scale: 2 }),

    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [check('zone_fee_non_negative', sql`${t.feeGross} >= 0`)],
);

/**
 * An explicit ALLOWLIST. Never radius + geocoding:
 *   - 15km straight-line is not 15km driving through the Limmattal
 *   - no third-party geocoding dependency inside checkout, failing at 16:00
 *     on 13 February
 *   - deterministic and trivially testable
 *   - she can drop a PLZ herself when a drive stops being worth it
 *
 * PLZ IS NOT THE PRIMARY KEY, and this is not over-engineering.
 *
 * Verified against the official Swiss Post directory: PLZ 5415 covers TWO
 * Ortschaften in Gemeinde Obersiggenthal - Nussbaumen AG and Rieden AG - and
 * her price sheet charges CHF 12 for one and CHF 14 for the other. A single
 * 4-digit code therefore cannot determine the fee.
 *
 * Lookup at checkout:
 *   SELECT * FROM delivery_zone_plz WHERE plz = $1
 *     1 row  -> use it
 *     2 rows -> show an Ortschaft picker (standard Swiss checkout UX)
 *     0 rows -> "wir liefern leider nicht an diese Adresse"
 */
export const deliveryZonePlz = pgTable(
  'delivery_zone_plz',
  {
    id: serial('id').primaryKey(),
    plz: char('plz', { length: 4 }).notNull(),
    /** official Ortschaftsname from the Swiss Post directory */
    ortschaft: text('ortschaft').notNull(),
    zoneId: integer('zone_id')
      .notNull()
      .references(() => deliveryZone.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('plz_ortschaft_unique').on(t.plz, t.ortschaft),
    index('plz_lookup_idx').on(t.plz),
    index('plz_zone_idx').on(t.zoneId),
  ],
);

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

/**
 * Per-weekday rules. This is how the Tuesday case is handled without a
 * special case in code:
 *
 *   Tuesday : shop_open = false, delivery_enabled = true, min_lead_hours = 24
 *             She is closed but still delivers - pre-ordered only.
 *   Sunday  : delivery_enabled = true. She specifically wants Sunday, which is
 *             unusual for a Swiss florist and worth advertising.
 *   Others  : min_lead_hours = 3
 *
 * weekday follows Postgres EXTRACT(DOW): 0 = Sunday.
 */
export const weeklySchedule = pgTable(
  'weekly_schedule',
  {
    weekday: integer('weekday').primaryKey(),
    shopOpen: boolean('shop_open').notNull().default(true),
    deliveryEnabled: boolean('delivery_enabled').notNull().default(true),
    minLeadHours: integer('min_lead_hours').notNull().default(3),
  },
  (t) => [
    check('weekday_range', sql`${t.weekday} BETWEEN 0 AND 6`),
    check('lead_hours_non_negative', sql`${t.minLeadHours} >= 0`),
  ],
);

/** Ostern, Weihnachten, her own holidays. She edits this herself. */
export const blackoutDate = pgTable('blackout_date', {
  id: serial('id').primaryKey(),
  day: date('day').notNull().unique(),
  reasonDe: text('reason_de'),
});

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

/**
 * Two per delivering day: 10:00-12:00 and 16:00-18:00.
 *
 * Generated ~60 days ahead by a nightly job. NEVER generate on demand inside
 * a request - a slow or failed generation would then break checkout. The job
 * needs a health check: alert if the bookable horizon drops below 30 days,
 * because a silently failing job is invisible until dates run out.
 *
 * NOTE: there is deliberately NO booked_count column.
 *
 * A stored counter drifts - every cancellation, every abandoned payment,
 * every admin correction is a chance for it to diverge from reality, and it
 * drifts SILENTLY. You find out on Valentine's Day when it says 18/20 and
 * there are 23 bouquets to make.
 *
 * Count the orders instead, inside the same transaction:
 *
 *   SELECT capacity, is_closed FROM delivery_run WHERE id = $1 FOR UPDATE;
 *   SELECT count(*) FROM "order"
 *     WHERE delivery_run_id = $1 AND status <> 'cancelled';
 *   -- compare, then insert
 *
 * Read-compare-insert WITHOUT the FOR UPDATE lock passes every manual test
 * you will ever run, because you cannot click twice simultaneously. It fails
 * exactly once a year, on the day that matters most.
 */
export const deliveryRun = pgTable(
  'delivery_run',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    runDate: date('run_date').notNull(),
    windowStart: time('window_start').notNull(), // 10:00 | 16:00
    windowEnd: time('window_end').notNull(), // 12:00 | 18:00

    /**
     * EDITABLE PER RUN. 8-10 bouquets/hour PER PERSON, and she calls in extra
     * staff when busy - so she raises this herself rather than you guessing.
     *
     * She said she does not need a cap (Q62, Q63). Built anyway, defaulted
     * high. It costs two hours now and cannot be added at 16:00 on
     * 13 February. It is also the soft-launch control: set to 5 on 1 December.
     */
    capacity: integer('capacity').notNull().default(20),

    /** manual override so she can close a run when overloaded */
    isClosed: boolean('is_closed').notNull().default(false),
  },
  (t) => [
    uniqueIndex('run_date_window_unique').on(t.runDate, t.windowStart),
    index('run_date_idx').on(t.runDate),
    check('run_capacity_positive', sql`${t.capacity} >= 0`),
    check('run_window_ordered', sql`${t.windowEnd} > ${t.windowStart}`),
  ],
);
