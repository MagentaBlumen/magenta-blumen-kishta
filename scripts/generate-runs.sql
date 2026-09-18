-- =====================================================================
-- Extend the delivery-run horizon.
--
-- Idempotent: ON CONFLICT (run_date, window_start) DO NOTHING. Safe to
-- re-run at any cadence. Nightly is intentional - see the health check
-- in scripts/generate-runs.sh.
--
-- Reads run_generation_days from settings (seeded to 60). Two windows
-- per delivering day: 10:00-12:00, 16:00-18:00. Skips days where
-- weekly_schedule.delivery_enabled = false and any blackout_date row.
--
-- Capacity: hardcoded 5. This is the SOFT LAUNCH cap. When she raises
-- it in Einstellungen post-launch, edit this file and redeploy - it
-- only affects runs generated FROM THEN ON. Existing runs keep their
-- original capacity (deliberate: existing bookings must not have the
-- ground shifted under them).
--
-- Sourced from: drizzle/seed/01-base.sql section 10. Kept in sync by
-- hand; if you change one, change the other.
-- =====================================================================

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
