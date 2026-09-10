# Magenta Blumen — Database Schema (Phase 1)

Postgres. Written to be handed to an AI as a spec, not invented by one.

**Money:** every amount is `numeric(10,2)`, **gross** (VAT-inclusive), in CHF.
Swiss shops display VAT-inclusive prices, so gross is the number she types and the
number the customer sees. Net is derived at reporting time, never stored.

**Naming:** `_de` suffix marks customer-facing German text. Single language, no i18n tables.

---

## Two rules that override anything the AI suggests

**1. Orders snapshot. They never reference.**
Every order and order line stores product name, variant label, unit price, tax rate
and address **as values**. `product_id` is kept for reporting only and must never be
joined to fetch a price. When she edits a price in March, February's orders must still
read the old one.

**2. The database enforces what the code might not.**
`stripe_event.stripe_event_id` is UNIQUE — that alone makes duplicate webhook
processing impossible. Run capacity is checked inside a transaction with
`SELECT ... FOR UPDATE` on the run row. Constraints hold when the logic doesn't.

---

## 1. Catalogue

```sql
CREATE TYPE pricing_mode AS ENUM (
  'variant',   -- pick a size: bouquets, plants, custom tiers
  'per_unit',  -- quantity x unit price: roses by the stem
  'enquiry'    -- no checkout: weddings, events, funerals, gardening service
);

CREATE TYPE slot_type AS ENUM (
  'run',    -- normal: goes on a 10-12 or 16-18 delivery run
  'timed'   -- funerals/weddings: customer picks the ceremony time
);

CREATE TABLE tax_rate (
  id          serial PRIMARY KEY,
  code        text NOT NULL UNIQUE,      -- 'reduced' | 'standard'
  name_de     text NOT NULL,             -- 'reduzierter Satz' | 'Normalsatz'
  rate        numeric(5,4) NOT NULL      -- 0.0260 | 0.0810
);
-- TODO(Treuhänder): confirm the rates and which category maps to which.
-- She said 8.6%, which is not a Swiss rate. Do NOT hardcode either value
-- anywhere in application code — always read from this table.

CREATE TABLE category (
  id                   serial PRIMARY KEY,
  slug                 text NOT NULL UNIQUE,
  name_de              text NOT NULL,
  sort_order           int  NOT NULL DEFAULT 0,
  is_orderable_online  boolean NOT NULL DEFAULT true,
    -- false for: Evente, Varrimet/Trauer, Gärtnerservice -> enquiry form only
  is_seasonal          boolean NOT NULL DEFAULT false,
  active_from          date,
  active_to            date
    -- seasonal groups appear/disappear automatically (Q27)
);

CREATE TABLE product (
  id                   bigserial PRIMARY KEY,
  slug                 text NOT NULL UNIQUE,
  name_de              text NOT NULL,
  description_de       text,
  pricing_mode         pricing_mode NOT NULL DEFAULT 'variant',
  slot_type            slot_type    NOT NULL DEFAULT 'run',
  tax_rate_id          int  NOT NULL REFERENCES tax_rate(id),
  is_available         boolean NOT NULL DEFAULT true,
    -- boolean only. No integer stock anywhere. Sold out = greyed out, not hidden.
  is_online_orderable  boolean NOT NULL DEFAULT true,
  is_addon             boolean NOT NULL DEFAULT false,
    -- vase, chocolate, ribbon, card. Attaches to a parent line.
  lead_time_days       int NOT NULL DEFAULT 0,
  sort_order           int NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_category (          -- many-to-many (Q24)
  product_id  bigint REFERENCES product(id) ON DELETE CASCADE,
  category_id int    REFERENCES category(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE product_variant (
  id                bigserial PRIMARY KEY,
  product_id        bigint NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  size_label_de     text,                    -- 'Klein' | 'Mittel' | 'Gross' | NULL
  price_gross       numeric(10,2) NOT NULL,
  sale_price_gross  numeric(10,2),           -- NULL = not on sale (Q45)
  is_available      boolean NOT NULL DEFAULT true,
  min_quantity      int NOT NULL DEFAULT 1,  -- per_unit products (roses)
  max_quantity      int,
  sort_order        int NOT NULL DEFAULT 0
);
-- Size LABELS are shared vocabulary; PRICES live here, per product (Q17, Q18).
-- pricing_mode='per_unit': exactly one variant, price_gross = price per stem.
-- Custom bouquet: one product, variants at 40 / 60 / 90 / 120 (Q29, Q30).

CREATE TABLE product_image (
  id          bigserial PRIMARY KEY,
  product_id  bigint NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  url         text NOT NULL,
  alt_de      text,
  sort_order  int NOT NULL DEFAULT 0
);
```

### Attributes / filtering (Q25, Q126)

Colour and size filtering is a **facet system**, not subcategories.
Colour sits on the product, not the variant — she sets it per flower.

```sql
CREATE TABLE attribute (
  id       serial PRIMARY KEY,
  key      text NOT NULL UNIQUE,   -- 'colour'
  name_de  text NOT NULL           -- 'Farbe'
);

CREATE TABLE attribute_value (
  id            serial PRIMARY KEY,
  attribute_id  int NOT NULL REFERENCES attribute(id) ON DELETE CASCADE,
  value         text NOT NULL,     -- 'red'
  name_de       text NOT NULL,     -- 'Rot'
  hex           char(7),           -- swatch colour
  sort_order    int NOT NULL DEFAULT 0,
  UNIQUE (attribute_id, value)
);

CREATE TABLE product_attribute_value (
  product_id         bigint REFERENCES product(id) ON DELETE CASCADE,
  attribute_value_id int    REFERENCES attribute_value(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, attribute_value_id)
);
-- Filters combine with AND (Q127). Empty result renders an empty state,
-- not a 404.
```

---

## 2. Delivery zones

```sql
CREATE TYPE delivery_method AS ENUM ('own_van', 'post', 'pickup');

CREATE TABLE delivery_zone (
  id                serial PRIMARY KEY,
  name_de           text NOT NULL,              -- 'Neuenhof', 'Baden / Wettingen'
  method            delivery_method NOT NULL,
  fee_gross         numeric(10,2) NOT NULL,     -- Neuenhof = 8.00
  min_order_gross   numeric(10,2) NOT NULL DEFAULT 40.00,
  free_over_gross   numeric(10,2),              -- 120.00 (Q49); NULL = never free
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        int NOT NULL DEFAULT 0
);

CREATE TABLE delivery_zone_plz (
  zone_id  int  NOT NULL REFERENCES delivery_zone(id) ON DELETE CASCADE,
  plz      char(4) NOT NULL,
  PRIMARY KEY (plz)          -- one PLZ belongs to exactly one zone
);
```

**TODO(aunt):** the actual PLZ list with per-zone prices. Table stays empty until then.

**Postal zone needs its own `min_order_gross`, set high.** Her own example: a 40-franc
bouquet to Bern costs 22 in postage and doesn't work. Suggest 80–100 minimum for post.

**Never implement this as radius + geocoding.** An explicit allowlist is deterministic,
testable, has no third-party dependency inside checkout, and she can edit it herself.

---

## 3. Slots and the calendar

```sql
CREATE TABLE weekly_schedule (
  weekday           int PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),  -- 0=Sun
  shop_open         boolean NOT NULL DEFAULT true,
  delivery_enabled  boolean NOT NULL DEFAULT true,
  min_lead_hours    int NOT NULL DEFAULT 3
);
-- Tuesday: shop_open=false, delivery_enabled=true, min_lead_hours=24.
--   She delivers Tuesdays but they must be ordered in advance.
-- Sunday: delivery_enabled=true. She specifically wants Sunday.

CREATE TABLE blackout_date (
  id        serial PRIMARY KEY,
  day       date NOT NULL UNIQUE,
  reason_de text
);
-- Ostern, Weihnachten, her own holidays. She edits this herself.

CREATE TABLE delivery_run (
  id            bigserial PRIMARY KEY,
  run_date      date NOT NULL,
  window_start  time NOT NULL,          -- 10:00 | 16:00
  window_end    time NOT NULL,          -- 12:00 | 18:00
  capacity      int  NOT NULL DEFAULT 20,
  is_closed     boolean NOT NULL DEFAULT false,
  UNIQUE (run_date, window_start)
);
-- Capacity is EDITABLE PER RUN. 8-10 bouquets/hour per person, and she calls in
-- extra staff when busy — so she raises it herself rather than you guessing.
-- She said she doesn't need a cap. Build it anyway and default it high.
-- It costs two hours now and cannot be added at 4pm on 13 February.

-- Booking a run, inside one transaction:
--   SELECT capacity, is_closed FROM delivery_run WHERE id = $1 FOR UPDATE;
--   SELECT count(*) FROM "order" WHERE delivery_run_id = $1 AND status <> 'cancelled';
--   -- compare, then insert
-- Read-compare-insert WITHOUT the lock passes every manual test and fails
-- exactly once a year, on the day that matters most.
```

### Timed deliveries

Funerals, weddings and events carry a specific timestamp instead of a run
(the customer gives the ceremony time; she delivers an hour before).
Low volume — three at the same hour is fine — so no slot table.
The order stores `requested_delivery_at`, and booking counts existing timed
orders in that hour against a config maximum, under the same transactional lock.

---

## 4. Customers

```sql
CREATE TABLE customer (
  id                bigserial PRIMARY KEY,
  email             citext NOT NULL UNIQUE,
  phone             text,
  phone_verified_at timestamptz,
  password_hash     text NOT NULL,
  first_name        text,
  last_name         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
-- She asked for mandatory registration with phone verification (Q103).
-- FLAG: this is a real conversion cost on a gift purchase at 22:00, and it
-- brings an SMS provider and per-message billing. Recommend revisiting:
-- guest checkout, with an optional account created AFTER payment. Same order
-- history, none of the friction. The schema supports either — customer_id on
-- the order is nullable.

CREATE TABLE customer_address (
  id              bigserial PRIMARY KEY,
  customer_id     bigint NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  label_de        text,
  recipient_name  text NOT NULL,
  street          text NOT NULL,
  plz             char(4) NOT NULL,
  city            text NOT NULL,
  phone           text,
  notes           text
);
-- Address book (Q105). Orders COPY from here, they never reference it.
```

---

## 5. Orders

```sql
CREATE TYPE order_status AS ENUM (
  'new',              -- paid (or COD/invoice accepted), not yet touched
  'confirmed',        -- she has seen it
  'in_production',    -- being made
  'ready',            -- made, waiting for its run
  'out_for_delivery',
  'delivered',
  'delivery_failed',  -- nobody home / bad address -> she calls, reschedules
  'cancelled'
);

CREATE TYPE fulfilment_type AS ENUM ('run', 'timed', 'pickup', 'post');

CREATE TABLE "order" (
  id                        bigserial PRIMARY KEY,
  order_number              text NOT NULL UNIQUE,
  customer_id               bigint REFERENCES customer(id),   -- nullable: guest-capable
  status                    order_status NOT NULL DEFAULT 'new',

  -- BUYER (snapshot)
  buyer_name                text NOT NULL,
  buyer_email               text NOT NULL,
  buyer_phone               text,

  -- RECIPIENT (snapshot) — almost always a different person (Q65)
  recipient_name            text NOT NULL,
  recipient_phone           text,
  delivery_street           text,
  delivery_plz              char(4),
  delivery_city             text,
  delivery_zone_name        text,       -- snapshot of the zone name
  delivery_instructions     text,       -- Q70, Q71
  card_message              text,       -- no character limit (Q68)
  card_is_anonymous         boolean NOT NULL DEFAULT false,   -- Q69

  -- FULFILMENT
  fulfilment                fulfilment_type NOT NULL,
  delivery_run_id           bigint REFERENCES delivery_run(id),
  requested_delivery_at     timestamptz,   -- timed only: the CEREMONY time.
                                           -- She delivers ~1h before.

  -- MONEY (all snapshots, all gross)
  subtotal_gross            numeric(10,2) NOT NULL,
  discount_code_snapshot    text,
  discount_gross            numeric(10,2) NOT NULL DEFAULT 0,
  loyalty_tier_snapshot     text,
  loyalty_percent_snapshot  numeric(5,2),
  giftcard_applied_gross    numeric(10,2) NOT NULL DEFAULT 0,
  delivery_fee_gross        numeric(10,2) NOT NULL DEFAULT 0,
  total_gross               numeric(10,2) NOT NULL,
  amount_due_gross          numeric(10,2) NOT NULL,
    -- amount_due = total - giftcard_applied. If 0, there is NO payment row
    -- and no webhook will ever fire. Mark the order paid at creation.
    -- This is the bug you will otherwise ship.

  placed_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CHECK ((fulfilment = 'run')   = (delivery_run_id IS NOT NULL)),
  CHECK ((fulfilment = 'timed') = (requested_delivery_at IS NOT NULL))
);

CREATE INDEX ON "order" (delivery_run_id);
CREATE INDEX ON "order" (status, placed_at);

CREATE TABLE order_line (
  id                  bigserial PRIMARY KEY,
  order_id            bigint NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  parent_line_id      bigint REFERENCES order_line(id) ON DELETE CASCADE,
    -- add-ons (vase, chocolate, ribbon) hang off the bouquet line they belong to

  product_id          bigint REFERENCES product(id),   -- REPORTING ONLY
  variant_id          bigint REFERENCES product_variant(id),  -- REPORTING ONLY

  -- SNAPSHOT — never join to product to render an order
  product_name_de     text NOT NULL,
  variant_label_de    text,
  unit_price_gross    numeric(10,2) NOT NULL,
  tax_rate            numeric(5,4) NOT NULL,
  quantity            int NOT NULL DEFAULT 1,
  line_total_gross    numeric(10,2) NOT NULL,

  -- custom bouquet fields (Q31, Q32)
  colour_preference   text,
  avoid_notes         text     -- scented flowers, allergies
);
```

---

## 6. Payments

```sql
CREATE TYPE payment_method AS ENUM ('card', 'twint', 'cash', 'invoice');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

CREATE TABLE payment (
  id                        bigserial PRIMARY KEY,
  order_id                  bigint NOT NULL REFERENCES "order"(id),
  method                    payment_method NOT NULL,
  provider_payment_intent_id text UNIQUE,   -- NULL for cash / invoice
  amount_gross              numeric(10,2) NOT NULL,
  status                    payment_status NOT NULL DEFAULT 'pending',
  paid_at                   timestamptz,
  marked_paid_by            text,           -- cash/invoice: who at the counter
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- AT MOST ONE live payment per order. A gift card covers part, then ONE method
-- covers the rest. Never two live captures (Q130).
CREATE UNIQUE INDEX one_live_payment_per_order
  ON payment (order_id) WHERE status <> 'failed';

CREATE TABLE stripe_event (
  id              bigserial PRIMARY KEY,
  stripe_event_id text NOT NULL UNIQUE,   -- <<< THE idempotency guarantee
  type            text NOT NULL,
  payload         jsonb NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz
);
-- Insert the event FIRST. If the unique constraint rejects it, it is a retry —
-- return 200 and stop. Stripe retries failed deliveries; without this you get
-- one payment and three orders.

CREATE TABLE refund (
  id              bigserial PRIMARY KEY,
  order_id        bigint NOT NULL REFERENCES "order"(id),
  payment_id      bigint REFERENCES payment(id),
  amount_gross    numeric(10,2) NOT NULL,
  reason          text,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- She said customers just contact the shop. Fine — but the record must exist,
-- and a gift-card-funded portion refunds as restored balance, not cash.
```

**Cash on delivery / invoice (Q128, Q129):** `method='cash'|'invoice'`,
`status='pending'`, order still enters normally. Someone at the counter marks it
paid. `marked_paid_by` exists so there is an audit trail on cash.
**Recommend deferring business invoicing to Phase 2** — she left Q129 blank.

---

## 7. Gift cards

```sql
CREATE TABLE gift_card (
  id                    bigserial PRIMARY KEY,
  code                  text NOT NULL UNIQUE,
  initial_amount_gross  numeric(10,2) NOT NULL,   -- any amount (Q102)
  issued_at             timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz,              -- NULL — no expiry (Q101)
  is_active             boolean NOT NULL DEFAULT true
);
-- NO balance column. Balance is DERIVED:
--   initial_amount_gross - COALESCE(SUM(redemption.amount_gross), 0)
-- A stored balance drifts. A ledger cannot.

CREATE TYPE redemption_channel AS ENUM ('online', 'counter');

CREATE TABLE gift_card_redemption (
  id            bigserial PRIMARY KEY,
  gift_card_id  bigint NOT NULL REFERENCES gift_card(id),
  order_id      bigint REFERENCES "order"(id),   -- NULL when redeemed at the counter
  amount_gross  numeric(10,2) NOT NULL,
  channel       redemption_channel NOT NULL,
  redeemed_by   text,
  redeemed_at   timestamptz NOT NULL DEFAULT now()
);
```

Partial redemption is the normal case: a 50-franc card against a 120-franc order
leaves 50 spent, 0 remaining; against a 45-franc order it leaves 5 on the card.

**Verify the balance immediately before creating the payment intent, and decrement
only after the payment succeeds.** The same card can be used at the counter while
someone sits on the checkout page.

Counter redemption (Q99, Q131): she looks up the code, sees the balance, records a
`channel='counter'` redemption. Same ledger, no order attached.

---

## 8. Discounts and loyalty

```sql
CREATE TYPE discount_type AS ENUM ('percent', 'fixed', 'free_delivery');

CREATE TABLE discount_code (
  id               bigserial PRIMARY KEY,
  code             text NOT NULL UNIQUE,
  type             discount_type NOT NULL,
  value            numeric(10,2) NOT NULL,
  min_order_gross  numeric(10,2),
  max_uses         int,
  uses_count       int NOT NULL DEFAULT 0,
  valid_from       timestamptz,
  valid_to         timestamptz,
  is_active        boolean NOT NULL DEFAULT true
);
-- Applies to the whole order, not specific lines (Q93). Never combines (Q95).

CREATE TABLE loyalty_tier (
  id                   serial PRIMARY KEY,
  name_de              text NOT NULL,
  min_completed_orders int NOT NULL,
  percent              numeric(5,2) NOT NULL
);
-- Tier is COMPUTED at checkout from a live count of the customer's
-- delivered-and-paid orders. Do NOT store a counter on the customer row —
-- it drifts on every cancellation and refund.
-- Then SNAPSHOT the resulting percent onto the order.
-- Never applies to delivery_fee_gross. Never stacks with a discount code.
```

---

## 9. Notifications

```sql
CREATE TYPE notify_channel   AS ENUM ('email', 'sms', 'push');
CREATE TYPE notify_recipient AS ENUM ('buyer', 'shop', 'driver');
-- NOTE: there is deliberately no 'recipient' value. The person receiving the
-- flowers must NEVER be emailed — it spoils the surprise (Q66). Making it
-- absent from the enum means the mistake cannot be made.

CREATE TABLE notification_log (
  id              bigserial PRIMARY KEY,
  order_id        bigint REFERENCES "order"(id),
  channel         notify_channel NOT NULL,
  recipient_type  notify_recipient NOT NULL,
  address         text NOT NULL,
  template        text NOT NULL,
  sent_at         timestamptz,
  status          text,
  error           text
);
```

Driver notification is SMS or WhatsApp — she said the delivery woman is older and
that's enough. No mobile app, no driver login.

---

## 10. Enquiries

Weddings, events, funerals and the gardening service do not go through checkout.

```sql
CREATE TYPE enquiry_type AS ENUM ('wedding', 'event', 'funeral', 'gardening');

CREATE TABLE enquiry (
  id           bigserial PRIMARY KEY,
  type         enquiry_type NOT NULL,
  name         text NOT NULL,
  email        text NOT NULL,
  phone        text,
  event_date   date,
  budget_range text,
  message      text,
  status       text NOT NULL DEFAULT 'new',
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

The gardening service (Q12 — ordering a gardener to plant flowers on site) is a
booked service with a site visit and no fixed price. It cannot use this checkout.
Enquiry form, or leave it off Phase 1 entirely.

---

## Open items

| # | Blocked on | Effect |
|---|---|---|
| 43 | Treuhänder | `tax_rate` rows unassigned. Schema ready, data missing. |
| 48 | Aunt's PLZ list | `delivery_zone` / `delivery_zone_plz` empty. |
| 129 | Aunt | Business invoicing — recommend Phase 2. |
| 91/92 | Aunt | Tier thresholds and percentages. Count or spend? |
| 113–120 | Aunt | Impressum / AGB facts. Doesn't block the schema. |

---

## Things to not let the AI change

1. `product_id` on `order_line` is for reporting. It must never be joined to fetch a
   price, name or tax rate for display.
2. `stripe_event.stripe_event_id` UNIQUE stays. Deduplicating in application code
   instead is not equivalent.
3. `one_live_payment_per_order` stays. Multiple live captures per order is a
   different, much harder product.
4. `gift_card` has no balance column.
5. `notify_recipient` has no `'recipient'` value.
6. Run capacity is checked under `FOR UPDATE`, not with a bare count.
7. No integer stock columns anywhere. She asked for boolean availability.
