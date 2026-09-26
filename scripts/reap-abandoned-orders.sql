-- ---------------------------------------------------------------------
-- Reaper: cancel abandoned checkouts.
-- ---------------------------------------------------------------------
--
-- Authoritative spec: docs/checkout-transaction.md §6.
--
-- An order in status='new' that has held a slot for more than 30 minutes
-- with no successful payment (and not a cash/invoice order, which are
-- actionable at creation and settled later) is cancelled here. The
-- freed slot goes back into the capacity pool for the next customer.
--
-- The `abandoned_order_minutes` threshold lives in settings so it can
-- be tuned without a redeploy. The doc explicitly says "do not shorten
-- below 15" — people get interrupted mid-payment.
--
-- IDEMPOTENCY: the WHERE clause only matches rows the reaper hasn't
-- yet processed (status='new' + placed_at older than threshold). Running
-- the same query twice back-to-back is safe: the second call sees no
-- rows to update.
--
-- RACE with a late-arriving successful payment (Session 6, once Stripe
-- is wired):
--   1. reaper cancels order at t = 30:00
--   2. payment_succeeded webhook arrives at t = 30:05
--   3. webhook finds a cancelled order holding money
--   Handling (in the webhook, not here): re-check run capacity, restore
--   the order to 'new' if there's room, otherwise flag for manual refund
--   and notify the shop LOUDLY. See docs/checkout-transaction.md §6.
--
-- In Phase 1 (cash + invoice only) the reaper is effectively a no-op —
-- every order it could touch has a payment.method IN ('cash','invoice')
-- and is thus filtered out by the NOT EXISTS clause. Kept anyway so:
--   (a) the code path exists + is tested before Stripe (Session 6),
--   (b) if a customer ever manages to create an order with no payment
--       row (a bug), the slot is still eventually reclaimed.

WITH threshold AS (
  SELECT
    -- Minutes to wait before treating a 'new' order as abandoned.
    -- Falls back to 30 if the setting is missing or garbled.
    COALESCE(
      NULLIF(value, '')::int,
      30
    ) AS minutes
  FROM settings
  WHERE key = 'abandoned_order_minutes'
)
UPDATE "order" o
   SET status = 'cancelled',
       updated_at = now()
  FROM threshold t
 WHERE o.status = 'new'
   AND o.placed_at < now() - (t.minutes || ' minutes')::interval
   AND NOT EXISTS (
     SELECT 1
       FROM payment p
      WHERE p.order_id = o.id
        AND (p.status = 'succeeded' OR p.method IN ('cash', 'invoice'))
   );
