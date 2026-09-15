-- =====================================================================
-- Magenta Blumen - base seed
-- Run AFTER 0000_init.sql, and BEFORE seed-delivery-zones.sql
-- (zones are a separate file because they came from her price sheet)
--
-- Idempotent: safe to re-run. Uses ON CONFLICT throughout.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Settings
-- ---------------------------------------------------------------------
-- Everything the shop might want changed without a deploy.
-- Read these at runtime. Do NOT hardcode any of them in application code.

INSERT INTO settings (key, value, description_de) VALUES
  ('same_day_cutoff_hours',     '3',   'Stunden Vorlauf vor Beginn der Tour'),
  ('max_booking_horizon_days',  '30',  'Wie weit im Voraus bestellt werden kann'),
  ('run_generation_days',       '60',  'Wie viele Tage im Voraus Touren erzeugt werden'),
  ('timed_deliveries_per_hour', '3',   'Max. Trauer-/Event-Lieferungen pro Stunde'),
  ('global_min_order_gross',    '40',  'CHF, geprueft auf Zwischensumme ohne Karte und Transport'),
  ('free_delivery_over_gross',  '120', 'CHF, ab dieser Zwischensumme ist die Lieferung gratis'),
  ('soft_launch_daily_cap',     '5',   'Max. Online-Bestellungen pro Tag beim Start'),
  ('abandoned_order_minutes',   '30',  'Nach dieser Zeit gibt der Reaper den Slot frei'),
  ('shop_timezone',             'Europe/Zurich', 'Niemals fest im Code')
ON CONFLICT (key) DO NOTHING;


-- ---------------------------------------------------------------------
-- 2. Tax rates
-- ---------------------------------------------------------------------
-- Confirmed by the Treuhaender.
--   Normalsatz         8.1%   (0.0810)
--   Reduzierter Satz   2.6%   (0.0260)
--
-- Product-group -> rate mapping lives in docs/vat-rates.md. Read it before
-- classifying a new product. Two open items still unresolved there:
--   - dried / stabilised flowers (currently 8.1%, awaiting ESTV verification)
--   - delivery fee on a MIXED-rate order (see resolveDeliveryTaxRate)
--
-- ON CONFLICT DO UPDATE, not DO NOTHING, so re-running the seed against a
-- database that predates this answer overwrites the NULL rates in place.
-- Application code must still read tax_rate.rate at runtime - never hardcode.

INSERT INTO tax_rate (code, name_de, rate) VALUES
  ('reduced',  'Reduzierter Satz', 0.0260),
  ('standard', 'Normalsatz',       0.0810)
ON CONFLICT (code) DO UPDATE SET rate = EXCLUDED.rate;


-- ---------------------------------------------------------------------
-- 3. Weekly schedule
-- ---------------------------------------------------------------------
-- weekday follows Postgres EXTRACT(DOW): 0 = Sunday.
--
-- TUESDAY is the interesting row: shop closed, but she still delivers -
-- pre-ordered only, hence 24 hours instead of 3.
-- SUNDAY delivery is deliberate and unusual for a Swiss florist. Advertise it.

INSERT INTO weekly_schedule (weekday, shop_open, delivery_enabled, min_lead_hours) VALUES
  (0, false, true,  3),   -- Sonntag
  (1, true,  true,  3),   -- Montag
  (2, false, true, 24),   -- Dienstag  <- geschlossen, aber Lieferung auf Vorbestellung
  (3, true,  true,  3),   -- Mittwoch
  (4, true,  true,  3),   -- Donnerstag
  (5, true,  true,  3),   -- Freitag
  (6, true,  true,  3)    -- Samstag
ON CONFLICT (weekday) DO NOTHING;


-- ---------------------------------------------------------------------
-- 4. Blackout dates
-- ---------------------------------------------------------------------
-- CAUTION: a wrongly blacked-out day is lost revenue. Only the days she
-- explicitly named (Q61: Ostern, Weihnachten) plus New Year are seeded.
--
-- Easter is a MOVABLE FEAST - computed below for 2026-2028, do not
-- extrapolate the pattern. Note the shift: 5 Apr 2026, 28 Mar 2027,
-- 16 Apr 2028.
--
-- TODO(aunt): confirm whether she also closes on Karfreitag, Auffahrt,
-- Pfingstmontag, 1. Mai, Bundesfeier (1. Aug) and Stephanstag (26. Dez).
-- Do NOT assume - the days AROUND these are among her busiest.

INSERT INTO blackout_date (day, reason_de) VALUES
  ('2026-04-05', 'Ostersonntag'),
  ('2026-12-25', 'Weihnachten'),
  ('2026-12-26', 'Stephanstag'),
  ('2027-01-01', 'Neujahr'),
  ('2027-03-28', 'Ostersonntag'),
  ('2027-12-25', 'Weihnachten'),
  ('2027-12-26', 'Stephanstag'),
  ('2028-01-01', 'Neujahr'),
  ('2028-04-16', 'Ostersonntag')
ON CONFLICT (day) DO NOTHING;


-- ---------------------------------------------------------------------
-- 5. Categories - ranges (what the thing IS)
-- ---------------------------------------------------------------------

INSERT INTO category (slug, name_de, kind, sort_order, is_orderable_online) VALUES
  ('blumenstraeusse',      'Blumensträusse',            'range',  1, true),
  ('schnittblumen',        'Schnittblumen',             'range',  2, true),
  ('rosen',                'Rosen',                     'range',  3, true),
  ('gestecke',             'Gestecke',                  'range',  4, true),
  ('zimmerpflanzen',       'Zimmerpflanzen',            'range',  5, true),
  ('gartenpflanzen',       'Garten- & Balkonpflanzen',  'range',  6, true),
  ('orchideen',            'Orchideen',                 'range',  7, true),
  ('dekoration',           'Dekoration',                'range',  8, true),
  ('trockenblumen',        'Trockenblumen',             'range',  9, true),
  ('stabilisierte-blumen', 'Stabilisierte Blumen',      'range', 10, true),
  ('kerzen-figuren',       'Kerzen & Figuren',          'range', 11, true),
  ('zusatzgeschenke',      'Zusatzgeschenke',           'range', 12, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------
-- 6. Categories - occasions (why you're BUYING it)
-- ---------------------------------------------------------------------
-- Nobody searches for "Schnittblumen". They think "it's my mother's birthday
-- and I'm 300km away". Occasion-first navigation matches how flowers are
-- actually bought - lifted from how the large Swiss florists organise.
--
-- hochzeit is NOT orderable online -> enquiry form.
-- trauer STAYS orderable: funeral BOUQUETS go through checkout as timed
-- deliveries. Only full ceremony arrangements are enquiry-only.

INSERT INTO category (slug, name_de, kind, sort_order, is_orderable_online) VALUES
  ('geburtstag',      'Geburtstag',           'occasion',  1, true),
  ('liebe',           'Liebe & Romantik',     'occasion',  2, true),
  ('danke',           'Danke',                'occasion',  3, true),
  ('gute-besserung',  'Gute Besserung',       'occasion',  4, true),
  ('geburt',          'Geburt',               'occasion',  5, true),
  ('entschuldigung',  'Entschuldigung',       'occasion',  6, true),
  ('einweihung',      'Einzug & Einweihung',  'occasion',  7, true),
  ('trauer',          'Trost & Trauer',       'occasion',  8, true),
  ('hochzeit',        'Hochzeit',             'occasion',  9, false),
  ('alle-anlaesse',   'Alle Anlässe',         'occasion', 10, true)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------
-- 7. Categories - seasonal
-- ---------------------------------------------------------------------
-- These appear and disappear automatically between active_from and active_to.
--
-- !! ostern and muttertag carry 2027 dates and MUST BE RESET EVERY JANUARY. !!
--
-- Easter is a movable feast (28 Mar 2027, but 16 Apr 2028 - a 19-day swing).
-- Swiss Mother's Day is the second Sunday in May (9 May 2027, 14 May 2028).
-- An AI asked to "fix the dates" will happily write a fixed date and it will
-- be silently wrong the following year. This is why the columns are editable
-- rather than computed in code.
--
-- allerheiligen matters more than it looks: grave flowers around 1 November
-- are a significant revenue line for a Swiss florist.

INSERT INTO category (slug, name_de, kind, sort_order, is_seasonal, active_from, active_to) VALUES
  ('valentinstag',  'Valentinstag',  'occasion', 20, true, '2027-01-25', '2027-02-14'),
  ('ostern',        'Ostern',        'occasion', 21, true, '2027-03-08', '2027-03-29'),
  ('muttertag',     'Muttertag',     'occasion', 22, true, '2027-04-19', '2027-05-09'),
  ('allerheiligen', 'Allerheiligen', 'occasion', 23, true, '2026-10-20', '2026-11-02'),
  ('weihnachten',   'Weihnachten',   'occasion', 24, true, '2026-11-20', '2026-12-24'),
  ('fruehling',     'Frühling',      'occasion', 25, true, '2027-03-01', '2027-05-31'),
  ('sommer',        'Sommer',        'occasion', 26, true, '2027-06-01', '2027-08-31'),
  ('herbst',        'Herbst',        'occasion', 27, true, '2026-09-01', '2026-11-30')
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------
-- 8. Colour facet
-- ---------------------------------------------------------------------
-- Colour is a FACET, not a category, and it belongs to the PRODUCT not the
-- variant - a Klein and a Gross bouquet of the same product are the same
-- colour (Q126: "she sets the colours of the flowers herself").
--
-- Promote this to a TOP-LEVEL nav item, not a sidebar filter. Colour is
-- often the customer's first decision: white for a funeral, red for
-- Valentine's.
--
-- 'bunt' has no hex - render a gradient swatch instead.

INSERT INTO attribute (key, name_de, sort_order) VALUES
  ('colour', 'Farbe', 1)
ON CONFLICT (key) DO NOTHING;

INSERT INTO attribute_value (attribute_id, value, name_de, hex, sort_order)
SELECT a.id, v.value, v.name_de, v.hex, v.sort_order
FROM attribute a
CROSS JOIN (VALUES
  ('weiss-creme',   'Weiss-Crème',    '#F5F0E6', 1),
  ('rosa-pink',     'Rosa-Pink',      '#E8A0BF', 2),
  ('rot',           'Rot',            '#C1272D', 3),
  ('orange-lachs',  'Orange-Lachs',   '#E8853B', 4),
  ('gelb',          'Gelb',           '#F2C744', 5),
  ('gruen',         'Grün',           '#6A8F4F', 6),
  ('violett-blau',  'Violett-Blau',   '#6B5B95', 7),
  ('pastell',       'Pastell',        '#E4D9E8', 8),
  ('bunt',          'Bunt',            NULL,     9)
) AS v(value, name_de, hex, sort_order)
WHERE a.key = 'colour'
ON CONFLICT (attribute_id, value) DO NOTHING;


-- ---------------------------------------------------------------------
-- 9. Loyalty tiers
-- ---------------------------------------------------------------------
-- DELIBERATELY EMPTY.
--
-- TODO(aunt): thresholds and percentages, and whether it counts ORDERS or
-- FRANCS SPENT. Ten CHF 40 orders and three CHF 200 orders reward very
-- different customers.
--
-- When it is decided, e.g.:
--   INSERT INTO loyalty_tier (name_de, min_completed_orders, percent) VALUES
--     ('Stammkunde', 5, 5.00), ('Treuekunde', 10, 10.00);
--
-- Rules to hold: never applies to delivery_fee_gross, never stacks with a
-- discount code, and "counts" means delivered AND paid.


-- ---------------------------------------------------------------------
-- 10. Delivery runs
-- ---------------------------------------------------------------------
-- Two per delivering day: 10:00-12:00 and 16:00-18:00.
--
-- This block is what the NIGHTLY JOB runs. Never generate runs on demand
-- inside a request - a slow or failed generation would break checkout.
--
-- The job needs a HEALTH CHECK: alert if the bookable horizon drops below
-- 30 days. A silently failing generator is invisible until dates run out
-- three weeks later.
--
-- capacity 5 for the soft launch on 1 December. Raise it in Einstellungen
-- once the first weeks have gone smoothly. She said she does not need a cap -
-- this is launch risk control, not Valentine's control.

INSERT INTO delivery_run (run_date, window_start, window_end, capacity)
SELECT d::date, w.s, w.e, 5
FROM generate_series(
       CURRENT_DATE,
       CURRENT_DATE + (SELECT value::int FROM settings WHERE key = 'run_generation_days'),
       interval '1 day'
     ) AS d
CROSS JOIN (VALUES (time '10:00', time '12:00'),
                   (time '16:00', time '18:00')) AS w(s, e)
JOIN weekly_schedule ws ON ws.weekday = EXTRACT(DOW FROM d)
WHERE ws.delivery_enabled = true
  AND NOT EXISTS (SELECT 1 FROM blackout_date b WHERE b.day = d::date)
ON CONFLICT (run_date, window_start) DO NOTHING;


-- ---------------------------------------------------------------------
-- Verification - run these after seeding
-- ---------------------------------------------------------------------
-- SELECT count(*) FROM settings;          -- expect 9
-- SELECT count(*) FROM weekly_schedule;   -- expect 7
-- SELECT count(*) FROM category;          -- expect 30
-- SELECT count(*) FROM attribute_value;   -- expect 9
-- SELECT count(*) FROM delivery_run;      -- expect ~105 (60 days, minus
--                                         --   blackouts, x2 windows)
-- SELECT min(run_date), max(run_date) FROM delivery_run;
-- SELECT rate FROM tax_rate;              -- expect NULL, NULL until Treuhaender
