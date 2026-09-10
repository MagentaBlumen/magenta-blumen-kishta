# Checkout — Transaction Spec

The one part to specify on paper before any code exists.

**Rule for this file:** you may generate the implementation from this spec, but you
must be able to answer, for every step, *what happens if this request arrives twice,
fails halfway through, or arrives concurrently with an identical one.*

---

## The ordering decision

Two possible sequences. Only one is safe.

**Pay first, create the order in the webhook** — wrong. The delivery slot could fill
between payment and webhook. You would have taken money for a slot you cannot honour,
on Valentine's Day, with no way to fix it except a refund and an apology.

**Reserve first, then charge** — correct. The scarce resource here is *slot capacity*,
not money. Secure the scarce thing before taking payment.

Cost of this choice: abandoned checkouts hold slots. Handled by the reaper (§6).

---

## 1. Order status is fulfilment only

`order.status` never encodes payment state. Payment lives in `payment.status`.

```
new  ->  confirmed  ->  in_production  ->  ready  ->  out_for_delivery  ->  delivered
                                             ^                              |
                                             |                              v
                                             +------------  delivery_failed
cancelled  <-  (from any state before out_for_delivery)
```

- `new` — exists and holds a slot. May or may not be paid yet.
- `confirmed` — she has seen it.
- `delivery_failed` — nobody home. She calls (Q84), then reassigns to a new run,
  which returns it to `ready`.

**An order is ACTIONABLE — appears on the Heute screen — when:**

```sql
EXISTS (SELECT 1 FROM payment p
        WHERE p.order_id = o.id
          AND (p.status = 'succeeded' OR p.method IN ('cash','invoice')))
```

Cash and invoice orders are actionable at creation; the money arrives later.

> Fraud note: cash-on-delivery on a public website is a fraud vector — anyone can
> order flowers to an address without paying. Mandatory phone verification
> mitigates it substantially, which is a genuine argument in favour of the
> registration requirement. If abuse appears, restrict cash to pickup only.

---

## 2. Phase A — reserve (synchronous, one transaction)

Everything here is server-side. **Never trust a price, a fee, or a total from the
client.** Re-derive all of it from the database.

```
BEGIN;

  -- 1. Re-price the cart from the DB. The client sends product/variant IDs and
  --    quantities, nothing else.
  --    Reject if any product is_available = false or is_online_orderable = false.

  -- 2. Resolve the destination.
  SELECT z.* FROM delivery_zone z
    JOIN delivery_zone_plz p ON p.zone_id = z.id
   WHERE p.plz = $plz AND p.ortschaft = $ortschaft;
  -- 0 rows -> "wir liefern leider nicht an diese Adresse"
  -- (PLZ 5415 covers two Ortschaften at different fees, hence both keys)

  -- 3. Minimum order check. AGAINST SUBTOTAL, NOT TOTAL.
  --    Her sheet: "Minimaler Lieferwert CHF 40.00, ohne Karte + Transport".
  --    A CHF 32 bouquet + CHF 8 delivery must NOT pass a CHF 40 check.
  IF subtotal_gross < zone.min_order_gross THEN abort;

  -- 4. Delivery fee: 0 if subtotal >= zone.free_over_gross, else zone.fee_gross.

  -- 5. Validate the slot against all seven date conditions (see
  --    catalogue-and-date-logic.md). Re-check server-side even though the UI
  --    already filtered - the UI state may be minutes stale.

  -- 6. LOCK THE RUN. This line is the whole point.
  SELECT capacity, is_closed FROM delivery_run WHERE id = $run FOR UPDATE;

  -- 7. Count, do not read a counter. There is no booked_count column.
  SELECT count(*) FROM "order"
   WHERE delivery_run_id = $run AND status <> 'cancelled';

  IF count >= capacity OR is_closed THEN abort;

  -- 8. Insert the order. Every buyer/recipient/money field is a SNAPSHOT.
  --    amount_due_gross = total_gross - giftcard_applied_gross
  --    (giftcard is always 0 in Phase 1; the CHECK constraint enforces the
  --     relationship regardless)

  -- 9. Insert order_lines. Snapshot product_name_de, variant_label_de,
  --    unit_price_gross, tax_rate. product_id is stored for REPORTING ONLY
  --    and must never be joined to fetch a price for display.
  --    Add-ons carry parent_line_id pointing at their bouquet line.

COMMIT;
```

**Timed orders** (funeral, wedding, event) skip steps 6–7 and instead lock on a
count of timed orders in the same hour:

```sql
SELECT count(*) FROM "order"
 WHERE fulfilment = 'timed'
   AND requested_delivery_at >= date_trunc('hour', $t)
   AND requested_delivery_at <  date_trunc('hour', $t) + interval '1 hour'
   AND status <> 'cancelled'
 FOR UPDATE;
```
Compare against `settings.timed_deliveries_per_hour` (3).

**Why the lock matters.** Without `FOR UPDATE`, steps 7 and 8 are separate
operations with a gap. Two customers booking the last slot simultaneously both
read `count = 19`, both compare against `capacity = 20`, both insert. You get 21
bouquets on a 20-bouquet run.

This passes every test you will ever run manually, because you cannot click twice
at the same instant. It fails exactly once a year.

---

## 3. Phase B — charge (synchronous)

```
  -- 10. ZERO-DUE SHORT CIRCUIT
  IF amount_due_gross = 0 THEN
      mark the order paid at creation;
      skip Stripe entirely;
      RETURN;
  END IF;
```

Nothing can produce a zero in Phase 1 — gift cards are deferred. Implement it
anyway. When gift cards arrive and one covers a whole order, **no PaymentIntent
exists and no webhook will ever fire.** Order-completion logic hanging off the
webhook would create the order, never mark it paid, and it would never appear on
the Heute screen. That is a silent bug in production. Five lines now; Phase 3 then
never touches the checkout core.

```
  -- 11. Create the PaymentIntent.
  --     amount   = amount_due_gross (in Rappen: multiply by 100, round, integer)
  --     currency = 'chf'    <- TWINT is CHF-only
  --     metadata = { order_id, order_number }
  --     idempotency key = order_number
  --
  --     TWINT: single-use bank redirect. No manual capture, no recurring,
  --     CHF 5000 max. So charge immediately - there is no authorise-now-
  --     capture-later option. Design refunds around that.

  -- 12. Insert the payment row: status 'pending', provider_payment_intent_id set.
```

Step 12 can fail on the partial unique index `one_live_payment_per_order
WHERE status <> 'failed'`. **That failure is the feature** — it means a live
payment already exists for this order, i.e. a double-submit. Return the existing
`client_secret` rather than creating a second intent.

Return `client_secret` to the browser. Done synchronously.

---

## 4. Phase C — confirm (asynchronous webhook)

```ts
// 13. RAW BODY. Next.js parses request bodies by default and signature
//     verification fails against parsed JSON. This burns a day for almost
//     everyone the first time and the error does not point at the cause.
const raw = await req.text();
const event = stripe.webhooks.constructEvent(raw, sig, WEBHOOK_SECRET);
```

```sql
-- 14. IDEMPOTENCY. Insert the event FIRST, before any processing.
INSERT INTO stripe_event (stripe_event_id, type, payload) VALUES (...);
-- unique violation -> this is a retry. Return 200 and STOP.
```

Stripe retries any delivery that does not return 200 promptly. Without this you
get one payment and three orders. Deduplicating in application logic is not
equivalent — the constraint holds even when the handler is wrong.

```
-- 15. Process, in one transaction:
BEGIN;
  find payment by provider_payment_intent_id;
    not found            -> log, mark event processed, COMMIT, return 200
    already 'succeeded'  -> no-op (out-of-order delivery), COMMIT, return 200

  UPDATE payment SET status = 'succeeded', paid_at = now();
  UPDATE stripe_event SET processed_at = now();
COMMIT;
```

Order status stays `new` — it is paid but she has not touched it yet.

```
-- 16. Notifications fire AFTER the commit, never inside the transaction.
--     A failing email must not roll back a successful payment.
--       -> shop  (email or SMS, her choice)
--       -> buyer (confirmation)
--       -> NEVER the recipient. Structurally impossible: notify_recipient
--          has no 'recipient' value.

-- 17. Return 200.
```

---

## 5. Failure matrix

| Event | Handling |
|---|---|
| Duplicate webhook delivery | `stripe_event_id` unique violation -> 200, stop |
| `payment_failed` then `succeeded` | Check current payment status before writing |
| `succeeded` then `payment_failed` | Ignore the failure if already succeeded |
| Intent unknown to us | Log, mark processed, 200. Never 500 — Stripe would retry forever |
| Handler throws mid-processing | Event row exists but `processed_at` is NULL. Alert on these. |
| Payment succeeded, order cancelled by reaper | See §6 |
| `amount_due = 0` | No intent, no webhook. Paid at creation. |

**Never return 500 for a business-logic problem.** Stripe will retry a 500 for
days. Return 200 and record the problem for a human.

---

## 6. The reaper — abandoned checkouts

A customer creates an order, holds a slot, and never pays. Without cleanup, slots
leak until the run looks full while nothing is being made.

Every 5 minutes:

```sql
UPDATE "order" SET status = 'cancelled'
 WHERE status = 'new'
   AND placed_at < now() - interval '30 minutes'
   AND NOT EXISTS (
     SELECT 1 FROM payment p
      WHERE p.order_id = "order".id
        AND (p.status = 'succeeded' OR p.method IN ('cash','invoice'))
   );
```

**The race:** a payment succeeds at minute 31, just after the reaper cancelled.
The webhook then finds a cancelled order holding money.

Handling: re-check run capacity. If there is room, restore the order to `new` and
alert the shop. If the run is now full, **do not silently keep the money** — flag
for manual refund and notify her immediately. This is rare and must be loud when
it happens.

30 minutes is generous for a checkout. Do not shorten it below 15 — people get
interrupted mid-payment.

---

## 7. Tests to write by hand

AI-written tests test the code *as written*, including its bugs. Fine for the
storefront, actively misleading here. Write these from the requirements, not from
the implementation:

1. **Concurrent slot booking.** Two transactions, one remaining slot. Exactly one
   succeeds. (Two real DB connections — a single-threaded test proves nothing.)
2. **Webhook replay.** Fire the same event three times. One payment, one order.
3. **Out-of-order events.** `succeeded` then `failed`. Payment stays succeeded.
4. **Unknown intent.** Returns 200, does not throw.
5. **Zero due.** Order is marked paid with no payment row.
6. **Minimum order.** Subtotal 32 + fee 8 = 40 total must be REJECTED.
7. **Reaper race.** Cancel, then deliver a success webhook. Order restored or
   flagged, never silently lost.
8. **Price change isolation.** Place an order, change the product price, re-read
   the order. It still shows the old price.
9. **PLZ 5415.** Nussbaumen resolves to CHF 12, Rieden to CHF 14.

Use the Stripe CLI (`stripe trigger`, `stripe events resend`) for 2, 3 and 4.

---

## 8. Do not let this be changed

1. `FOR UPDATE` on the run row. Not an advisory lock, not a `SELECT` without it.
2. Count orders. Never introduce a `booked_count` column.
3. `stripe_event` insert happens *before* processing, not after.
4. Raw body for signature verification.
5. Minimum order checks `subtotal`, not `total`.
6. Notifications fire after commit, outside the transaction.
7. Prices re-derived server-side. Never from the request body.
8. Money in Rappen as integers when talking to Stripe. Never floats.
