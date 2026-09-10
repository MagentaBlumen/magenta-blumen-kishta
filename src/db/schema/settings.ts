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
 * TODO(Treuhaender): rate is deliberately NULL until the accountant confirms.
 * She said 8.6%, which is not a Swiss rate - the rates are 8.1% (Normalsatz)
 * and 2.6% (reduzierter Satz). Which of her categories fall where is an open
 * question with real edge cases: fertiliser and soil are probably reduced,
 * dried and stabilised flowers may not be, greeting cards almost certainly
 * are not.
 *
 * Seed as two rows with NULL rates. Nothing reads them until the storefront
 * prices a cart, which is week 4.
 */
export const taxRate = pgTable('tax_rate', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // 'reduced' | 'standard'
  nameDe: text('name_de').notNull(), // 'reduzierter Satz' | 'Normalsatz'
  rate: numeric('rate', { precision: 5, scale: 4 }), // 0.0260 | 0.0810 - NULL until confirmed
});
