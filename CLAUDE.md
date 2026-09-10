# Magenta Blumen

Online shop for a single florist in Neuenhof AG, Switzerland. German-language
storefront, local delivery to 27 postcode zones by her own van, plus in-store
pickup. Owner is non-technical; her assistant Sandra uses the admin daily.

**Stack:** Next.js 15 (App Router) · TypeScript · Postgres 17 · Drizzle ·
Auth.js v5 · Stripe (card + TWINT) · Twilio Verify · Resend · Cloudflare R2 ·
Luxon · Tailwind + shadcn/ui · Hetzner

---

## Working agreement

- **Ask before installing any dependency.** Suggest it, say why, wait.
- **Never modify `src/db/schema/*` without flagging it first.** Say what you want
  to change and why; wait for a yes.
- **Never run git commit or git push.** Stage work; the human commits.
- **Do not create files that were not asked for.** No READMEs, no summaries,
  no example files.
- **Do not touch** `.env*`, `.gitignore`, CI secrets, firewall or backup scripts.
- **Prefer editing an existing file over creating a new one.**
- If a task needs one of the open questions at the bottom of this file,
  **use an obvious placeholder and say so.** Never guess a plausible value.

---

## Rules that do not bend

These are load-bearing. Several look like dead code or redundant complexity;
they are neither. **Do not "simplify" any of them. If one seems wrong, say so
and wait — do not change it.**

### 1. Orders snapshot. They never reference.

`order` and `order_line` store product names, prices, tax rates and addresses
as **values**, copied at checkout. `order_line.product_id` exists for reporting
only and must **never** be joined to fetch a price, name or tax rate for display.

When she raises a price in March, February's orders must still read the old one.
Joining to the live product looks tidier and silently corrupts her accounting.

### 2. Run capacity is counted under a lock. There is no counter column.

```sql
SELECT capacity, is_closed FROM delivery_run WHERE id = $1 FOR UPDATE;
SELECT count(*) FROM "order" WHERE delivery_run_id = $1 AND status <> 'cancelled';
```

Never add a `booked_count` column. A stored counter drifts on every
cancellation, abandoned payment and admin correction, and it drifts silently.
Read-compare-insert without `FOR UPDATE` passes every manual test and fails
once a year, on Valentine's Day.

### 3. Stripe webhooks: insert the event row before processing.

`stripe_event.stripe_event_id` is UNIQUE. Insert first; a unique violation means
this is a retry — return 200 and stop. Stripe retries deliveries. Deduplicating
in application logic instead is not equivalent.

Use `await req.text()` for the raw body. Next.js parses request bodies by
default and signature verification fails against parsed JSON.

### 4. One live payment per order.

Partial unique index: `ON payment (order_id) WHERE status <> 'failed'`.

Not `WHERE status = 'succeeded'`. With `= 'succeeded'` a pending payment
collides with nothing, so an order can accumulate several pending intents and
two can succeed — a double charge, with the constraint never firing.

### 5. All date arithmetic through Luxon, in Europe/Zurich.

Never bare `Date`. JavaScript's `Date` has no timezone concept. The slot system
is cutoff arithmetic against 10:00–12:00 and 16:00–18:00 windows; a naive
calculation shifts the runs by an hour on the two DST changeover Sundays.

### 6. Minimum order is checked against subtotal, not total.

Her price sheet: *"Minimaler Lieferwert CHF 40.00, ohne Karte + Transport."*
A CHF 32 bouquet plus CHF 8 delivery must be **rejected**.

### 7. No integer stock anywhere.

Availability is a boolean. Sold out renders **greyed out**, not hidden.

### 8. The recipient is never emailed.

`notify_recipient` enum is `buyer | shop | driver`. There is deliberately no
`recipient` value — almost every order is a gift and a confirmation would spoil
the surprise. Do not add the value.

### 9. Delivery zones are a postcode allowlist, keyed on (plz, ortschaft).

Never radius plus geocoding. PLZ **5415 covers two Ortschaften at different
fees** — Nussbaumen CHF 12, Rieden CHF 14 — so a plain postcode lookup cannot
price correctly. Two rows returned means show an Ortschaft picker.

### 10. Orders are never hard-deleted.

Nothing cascades from `order` — a `DELETE` should fail loudly. Swiss law
requires ten-year retention of business records. Use `status = 'cancelled'`.

Same principle elsewhere: products get `is_archived`, customers get
`anonymised_at` (null the personal fields, keep the row, orders untouched —
the revised FADP erasure path).

### 11. Columns that look unused and are not.

`order.giftcard_applied_gross` (always 0) and `order.amount_due_gross` (always
equals total) are the Phase 3 escape hatch. Their existence makes gift cards a
~45 hour additive feature instead of an 80 hour rewrite on live data.

`amount_due = 0` means **no payment row and no webhook will ever fire**. Handle
it explicitly: mark paid at creation, skip Stripe.

### 12. `order.delivery_date` and `order.sort_time` are denormalised on purpose.

They are a snapshot of `delivery_run` / `requested_delivery_at`, set at
checkout, so the Heute screen is one indexed query instead of branching on
fulfilment type and joining. **Do not normalise them away.** If an order moves
to a different run, update both.

---

## After any schema change, run this audit

`drizzle-kit` can silently drop partial and expression indexes on regeneration.
These are the money-safety guarantees:

```bash
npx drizzle-kit generate
for p in "one_live_payment_per_order" "status <> 'failed'" "lower(" \
         "plz_ortschaft_unique" "stripe_event_id"; do
  printf "%-32s " "$p"; grep -qF "$p" drizzle/*.sql && echo OK || echo MISSING
done
```

All five must print OK.

---

## Red zone — do not generate unreviewed

Write these by hand or read every line before merging. Bugs here are **silent**:
the card is charged, the log shows 200, Sentry is quiet, and no order exists.

- **Checkout → order → payment → webhook.** Follow `docs/checkout-transaction.md`
  exactly. Do not improvise the ordering.
- **Authorisation on every endpoint.** `GET /orders/1847` must verify the order
  belongs to the logged-in customer. This is the most common bug in generated
  web code, and under the revised Swiss FADP it is her legal exposure:
  recipient names, home addresses, phone numbers.
- **VAT arithmetic.** Rounding and rate assignment. Nothing errors; it is just
  wrong by a few rappen and the Treuhänder finds it a year later.
- **The seven-condition slot rule.** Generated code routinely implements the
  cutoff and drops the per-product lead time, or vice versa. Both are required.
- **Secrets, `.gitignore`, firewall, backup scripts.** Do not touch these.

**Green zone — generate freely:** catalogue and product pages, admin CRUD,
filters, forms, email templates, seed data, migrations for simple tables,
the Heute screen UI.

---

## Money

- `numeric(10,2)`, **gross** (VAT-inclusive), CHF. Swiss shops display
  VAT-inclusive prices — gross is what she types and what the customer sees.
- Postgres `numeric` returns a **string** in JS. `"78.00" - "12.00"` gives 66;
  `"78.00" + "12.00"` gives `"78.0012.00"`. Never do arithmetic on raw values.
- Stripe takes **integer Rappen**. Multiply by 100 and round. Never floats.
- `tax_rate.rate` is NULL until the Treuhänder confirms. Never hardcode 0.081
  or 0.026 anywhere — always read from `tax_rate`.

---

## Drizzle notes

```ts
// partial index
uniqueIndex('one_live_payment_per_order').on(t.orderId).where(sql`status <> 'failed'`)

// expression index
uniqueIndex('customer_email_lower_unique').on(sql`lower(${t.email})`)

// row lock, inside db.transaction()
await tx.select().from(deliveryRun).where(eq(deliveryRun.id, id)).for('update')
```

- Third table arg returns an **array** (v0.36+), not an object
- Self-reference needs `(): AnyPgColumn => table.column`
- `bigserial('x', { mode: 'number' })` for ids
- Prefer raw SQL over query-builder gymnastics for the locking paths —
  clarity beats cleverness where money is involved

---

## Twilio setup — do all of this BEFORE the first SMS sends

Rate limiting in application code cannot stop SMS pumping, because the attack
rotates both numbers and IPs. These console settings are what actually stop it,
and they are free.

- [ ] **Geo permissions: +41 only** (add DE/AT/FR/LI only if she takes EU
      orders). SMS pumping is profitable via premium international termination
      fees; Swiss mobile pays out nothing, so the attack stops being worth doing.
      **This is the single most important control.**
- [ ] **Hard spending cap CHF 100**, usage alert at CHF 30. Expected spend is
      CHF 10–20/month. This turns an unbounded loss into an email.
- [ ] **Fraud Guard enabled** (included with Verify, built for exactly this).
- [ ] **Verify send endpoint gated behind a valid order draft** — a real cart,
      resolved zone, selected slot. Never a public endpoint that accepts any
      phone number.
- [ ] Rate limits enforced via `verification_attempt`: **3/hour and 5/day per
      number, 10/hour per IP**.
- [ ] Phone normalised to **E.164** before insert (`libphonenumber-js`).
      `+41791234567` and `079 123 45 67` are the same person.
- [ ] IP stored as a **salted hash**, never raw — an IP is personal data under
      revFADP and a hash rate-limits just as well.
- [ ] Nightly cleanup of `verification_attempt` rows older than 24h.
- [ ] **Password reset goes by SMS**, not email — the email address is never
      verified, so an email reset link would let a typo lock someone out
      permanently.

If abuse ever appears despite this: Cloudflare Turnstile in front of the send
endpoint. Not on day one — it is friction on a checkout that already has some.

---

## Domain facts

**Delivery:** two runs daily, 10:00–12:00 and 16:00–18:00, including Sunday.
Tuesday the shop is closed but delivery still runs at 24h notice (per-weekday
`min_lead_hours`, not a special case in code). Cutoff 3 hours, booking horizon
one month. Funerals, weddings and events use exact timestamps outside the runs,
capped at 3 per hour.

**Products:** `pricing_mode` is `variant` (bouquets, plants, custom tiers),
`per_unit` (roses by the stem — exactly one variant, whose price is per stem),
or `enquiry` (weddings, gardening — no checkout). `is_addon` controls whether a
product appears in the add-on picker; add-ons can still be bought standalone,
in which case `parent_line_id` is NULL.

**Categories:** `kind` is `range` (what it is) or `occasion` (why you're buying).
Many-to-many. Colour is a facet in `attribute_value`, not a category, and belongs
to the product not the variant. **Seasonal `active_from`/`active_to` are editable
because Easter and Mother's Day move every year** — never compute or hardcode
them. (Easter: 5 Apr 2026, 28 Mar 2027, 16 Apr 2028.)

**Auth:** registration mandatory at checkout — email, password, phone. Phone
verified via Twilio Verify; **email is never verified**. `order.customer_id` is
nullable and orders snapshot buyer details regardless: registration is policy,
not a database constraint, so moving to guest checkout later is a one-line
change.

**Admin is three screens, not a menu tree:** Heute (today's orders by run, with
a print button per ticket), Produkte, Einstellungen. She and Sandra are not
comfortable with computers — bias hard toward one screen and printed paper.
Phone number is the primary admin search path: the caller's number is the
buyer's number.

---

## Language

German for anything customer-facing (`name_de` columns, all UI copy). English
for code, comments and identifiers. Swiss orthography in German text: **no ß**
— `Grösse`, `Sträusse`, `Schliesstage`. Swiss quotation marks: «Heute».

### Glossary

| Term | Meaning |
|---|---|
| PLZ | Postleitzahl — the 4-digit Swiss postcode |
| Ortschaft | The official place name. One PLZ can cover several |
| Gemeinde | Municipality. May contain several Ortschaften and may have no PLZ of its own (Obersiggenthal) |
| Strauss / Sträusse | Bouquet / bouquets |
| Gesteck | Arrangement (in a container, not hand-tied) |
| Trauerband | Printed ribbon on a funeral arrangement — `ribbon_text`, not `card_message` |
| Trauerfloristik | Funeral flowers as a service line |
| Treuhänder | Her accountant / fiduciary. The authority on VAT |
| MWST | Mehrwertsteuer — Swiss VAT. 8.1% standard, 2.6% reduced |
| TWINT | Dominant Swiss payment app. CHF only, single-use, no recurring, no manual capture |
| Impressum | Legally required site identity page |
| AGB | Terms and conditions |
| Abholung | In-store collection |
| Lieferwert | Order value, for the minimum threshold |
| Bon | The printed order ticket at the counter |

---

## Reference docs

- `docs/checkout-transaction.md` — the order state machine and exact transaction
  sequence. Authoritative for anything touching payment.
- `docs/catalogue-and-date-logic.md` — category taxonomy, the seven-condition
  date availability rule, timezone notes.
- `docs/delivery-zones.md` — the 27 zones and how they were verified.
- `docs/schema.md` — table-by-table rationale.
- `src/db/schema/*.ts` — comments there explain *why*, not just what. Read them
  before changing a table.

---

## Commands

```
npm run dev            next dev
npm run build          next build
npm run start          next start
npm run typecheck      tsc --noEmit
npm run lint           eslint
npm run db:up          docker compose up -d      (Postgres 17, host port 5433)
npm run db:down        docker compose down
npm run db:generate    drizzle-kit generate      (writes to ./drizzle/)
npm run db:hello       tsx scripts/hello-db.ts   (connection prover)
```

Not yet wired: `test`, `db:migrate`, `db:seed`. Until they exist, apply SQL by
hand — the exact steps live in `docs/local-setup.md` (or `START-HERE.md` while
that still exists).

Local DB URL default (baked into `drizzle.config.ts` and `src/db/client.ts`):
`postgres://magenta:magenta_dev@localhost:5433/magenta_blumen`. Override with
`DATABASE_URL` in the environment for anything else.

**Host port is 5433**, not 5432 — a native Postgres on this dev machine already
holds 5432. The container's internal port is still 5432.

---

## File layout

What exists today:

```
docker-compose.yml           Postgres 17 (host :5433 -> container :5432)
drizzle.config.ts            schema at src/db/schema/index.ts, out ./drizzle
drizzle/
  0000_init.sql              generated migration (27 tables)
  seed/
    01-base.sql              settings, tax, schedule, categories, colours,
                             blackouts, delivery-run generator
    02-delivery-zones.sql    27 zones + 27 PLZ rows
scripts/
  hello-db.ts                one-off DB scripts go here (seeds, admin tools)
src/
  app/                       Next.js App Router
    layout.tsx, page.tsx     placeholder scaffold
  db/
    client.ts                Drizzle client (postgres-js), exports `db`
    schema/                  27 tables in 8 files. Comments explain WHY.
docs/                        reference docs (see the section above)
```

Conventions to follow as new code lands (**decided now on purpose — do not
reinvent them per feature**):

- **Route handlers** live at `src/app/**/route.ts` (App Router). Webhooks under
  `src/app/api/webhooks/<provider>/route.ts` — e.g. `stripe/route.ts`. Read the
  raw body with `await req.text()` (see rule 3).
- **Server actions** default to co-location: `actions.ts` next to the page or
  component that uses them. Shared actions used by more than one page go under
  `src/lib/actions/`. Every action re-checks auth and ownership itself —
  actions are public endpoints in a URL you cannot see.
- **Storefront and admin are route groups**, sharing the same domain and DB but
  nothing else:
  - `src/app/(storefront)/…`   customer-facing pages, German copy
  - `src/app/(admin)/…`        Heute · Produkte · Einstellungen. Three screens,
                               no menu tree. Authenticated as staff.
- **Shared components** in `src/components/`; shadcn/ui primitives in
  `src/components/ui/`. Anything screen-specific stays with the screen.
- **Domain logic** (slot rule, VAT arithmetic, money helpers, PLZ resolution,
  Luxon time helpers) lives in `src/lib/` as pure functions — testable without
  a database. Money helpers here, never inline `Number(...)` on `numeric`
  strings anywhere else.
- **Env access** goes through one module (`src/lib/env.ts` when it exists) so
  a missing var fails at boot, not in the middle of a checkout.
- **Auth.js v5** config in `src/auth.ts` (project root of `src/`), route in
  `src/app/api/auth/[...nextauth]/route.ts`.

---

## Open questions — do not invent answers

- VAT: which categories are 2.6% vs 8.1%. Awaiting the Treuhänder. She said
  8.6%, which is not a Swiss rate.
- Loyalty thresholds and percentages; orders or francs spent.
- Custom bouquet tier prices (she said 40–120, exact tiers unknown).
- Rose per-stem price, min and max quantity.
- Impressum details beyond name, UID and registered address.
- Business invoicing terms (deferred to Phase 2).

Settled, for reference: Brugg minimum is CHF 50. Obersiggenthal has no PLZ of
its own; its villages keep their individual prices.

If work requires one of these, use an obvious placeholder and flag it. A
plausible wrong number is worse than a blank, because nobody goes looking
for it.
