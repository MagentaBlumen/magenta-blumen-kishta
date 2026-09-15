import { pgTable, serial, text, numeric, timestamp } from 'drizzle-orm/pg-core';

/**
 * Dynamic configuration. Anything the shop might want changed without a deploy.
 *
 * Seed keys:
 *   same_day_cutoff_hours      '3'    hours of notice before a run starts
 *   max_booking_horizon_days   '30'   she said one month
 *   run_generation_days        '60'   how far ahead the nightly job creates runs
 *   timed_deliveries_per_hour  '3'    cap on funeral/event slots in one hour
 *   global_min_order_gross     '40'   CHF, checked against SUBTOTAL not total
 *   free_delivery_over_gross   '120'  CHF
 *
 * NOTE on global_min_order_gross: her price sheet says "Minimaler Lieferwert
 * CHF 40.00, ohne Karte + Transport" - the minimum is checked against the
 * product subtotal, EXCLUDING the greeting card and the delivery fee.
 * A CHF 32 bouquet plus CHF 8 delivery must NOT pass.
 */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  descriptionDe: text('description_de'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Swiss VAT rates. Referenced by product, never hardcoded in application code.
 *
 * Confirmed by the Treuhaender:
 *   Normalsatz         8.1%  (0.0810)
 *   Reduzierter Satz   2.6%  (0.0260)
 *
 * Product-group -> rate mapping lives in docs/vat-rates.md. Two items still
 * open there: dried / stabilised flowers (currently 8.1%, awaiting ESTV
 * verification) and the delivery-fee rate on a mixed-rate order (interim
 * rule: rate of the highest-value line group, encapsulated in
 * resolveDeliveryTaxRate() so it changes in one place).
 *
 * Seeded live in drizzle/seed/01-base.sql via ON CONFLICT DO UPDATE, so a
 * re-run against a database that predates this answer overwrites the NULL
 * rows in place. Application code must always read the rate from this table -
 * never hardcode 0.0260 or 0.0810.
 */
export const taxRate = pgTable('tax_rate', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // 'reduced' | 'standard'
  nameDe: text('name_de').notNull(), // 'reduzierter Satz' | 'Normalsatz'
  rate: numeric('rate', { precision: 5, scale: 4 }), // 0.0260 | 0.0810
});
