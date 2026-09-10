# Catalogue Taxonomy & Date Logic

Companion to `schema.md`. Category seed data plus the exact rules for which
delivery dates are offerable. Patterns adapted from fleurop.ch, sized for a
single shop with one van.

---

## Part 1 — Categories

Two kinds, both many-to-many on product via `product_category`.

```sql
ALTER TABLE category ADD COLUMN kind text NOT NULL DEFAULT 'range';
-- 'range'    -> what the thing IS      (Schnittblumen, Zimmerpflanzen)
-- 'occasion' -> why you're BUYING it   (Geburtstag, Trauer)
```

A product normally sits in **one range** and **several occasions**.
A red rose bouquet: range `blumenstraeusse`, occasions `liebe`, `valentinstag`,
`geburtstag`. Colour is not a category — it lives in `attribute_value`.

### Ranges

| slug | name_de | notes |
|---|---|---|
| `blumenstraeusse` | Blumensträusse | `pricing_mode='variant'`, S/M/L |
| `schnittblumen` | Schnittblumen | |
| `rosen` | Rosen | `pricing_mode='per_unit'` — customer picks the stem count |
| `gestecke` | Gestecke | |
| `zimmerpflanzen` | Zimmerpflanzen | *lule për mbrenda* |
| `gartenpflanzen` | Garten- & Balkonpflanzen | *lule për përjashta*, seasonal |
| `orchideen` | Orchideen | |
| `dekoration` | Dekoration | parent of the three below |
| `trockenblumen` | Trockenblumen | *lule të thara* |
| `stabilisierte-blumen` | Stabilisierte Blumen | *lule të stabilizuara* |
| `kerzen-figuren` | Kerzen & Figuren | *llamba, figura* |
| `zusatzgeschenke` | Zusatzgeschenke | vase, chocolate, ribbon — `is_addon=true` |
| `gutscheine` | Gutscheine | Phase 3 |

### Occasions — evergreen

| slug | name_de |
|---|---|
| `geburtstag` | Geburtstag |
| `liebe` | Liebe & Romantik |
| `danke` | Danke |
| `gute-besserung` | Gute Besserung |
| `geburt` | Geburt |
| `entschuldigung` | Entschuldigung |
| `einweihung` | Einzug & Einweihung |
| `trauer` | Trost & Trauer |
| `hochzeit` | Hochzeit |
| `alle-anlaesse` | Alle Anlässe |

`hochzeit` and the event side of `trauer` are `is_orderable_online = false`
→ enquiry form. But **funeral bouquets that go on a timed delivery stay
orderable** — only the full ceremony arrangements are enquiry-only.

### Occasions — seasonal

`is_seasonal = true`, appear and disappear on `active_from` / `active_to`.

| slug | name_de | window |
|---|---|---|
| `valentinstag` | Valentinstag | 25 Jan – 14 Feb |
| `muttertag` | Muttertag | **movable** — see below |
| `ostern` | Ostern | **movable** — see below |
| `allerheiligen` | Allerheiligen | 20 Oct – 2 Nov |
| `weihnachten` | Weihnachten | 20 Nov – 24 Dec |
| `fruehling` | Frühling | 1 Mar – 31 May |
| `sommer` | Sommer | 1 Jun – 31 Aug |
| `herbst` | Herbst | 1 Sep – 30 Nov |

> **Do not hardcode Easter or Mother's Day.**
> Easter is a movable feast (Computus) and shifts by over a month year to year.
> Swiss Mother's Day is the second Sunday in May, so its date changes annually.
> Either compute them, or — simpler and safer — leave `active_from`/`active_to`
> editable and have her set them each January. An AI will happily write
> `active_from = '2026-03-29'` and it will be silently wrong in 2027.
>
> `allerheiligen` matters more than it looks: grave flowers around 1 November
> are a significant revenue line for a Swiss florist.

### Colours

Nine values, lifted from Fleurop's own facet list. Goes in `attribute_value`
under `attribute.key = 'colour'`. Promote this to a **top-level nav item**,
not a sidebar filter — colour is frequently the customer's first decision.

| value | name_de | hex |
|---|---|---|
| `weiss-creme` | Weiss-Crème | `#F5F0E6` |
| `rosa-pink` | Rosa-Pink | `#E8A0BF` |
| `rot` | Rot | `#C1272D` |
| `orange-lachs` | Orange-Lachs | `#E8853B` |
| `gelb` | Gelb | `#F2C744` |
| `gruen` | Grün | `#6A8F4F` |
| `violett-blau` | Violett-Blau | `#6B5B95` |
| `pastell` | Pastell | `#E4D9E8` |
| `bunt` | Bunt | multicolour — render a gradient swatch, not a hex |

---

## Part 2 — Date logic

### Gate early, not at checkout

**Ask for delivery PLZ and date at the top of the funnel, before the catalogue.**

Fleurop gates by country on the landing page and validates the town before you
shop. Same principle, different scale: someone who picks a bouquet, fills the
cart, enters an address and *only then* learns she doesn't deliver to their PLZ
is a lost sale and an annoyed customer.

Store PLZ + date in the session, then filter the catalogue by what is actually
deliverable on that date (lead times, availability). Let them change it from a
persistent header chip: `Neuenhof · Fr 12. Sep, 10–12 Uhr  [ändern]`.

### The availability rule

For each candidate `delivery_run`, offer it only if **all seven** hold:

```
1.  run.run_date NOT IN blackout_date
2.  weekly_schedule[dow(run.run_date)].delivery_enabled = true
3.  now() + (weekly_schedule[dow].min_lead_hours) <= run_start_at
4.  run.run_date >= today + MAX(lead_time_days) over all cart products
5.  run.is_closed = false
6.  booked_count(run) < run.capacity
7.  run.run_date <= today + 1 month
```

Rules 3 and 4 are different things and both are needed. **3** is her cutoff —
"3 hours' notice." **4** is per-product — some items need ordering in ahead.
Generated code routinely implements one and silently drops the other.

`run_start_at` = `run_date` + `window_start`, in **Europe/Zurich**.

### Weekly schedule seed

| dow | day | shop_open | delivery | min_lead_hours |
|---|---|---|---|---|
| 1 | Montag | true | true | 3 |
| 2 | **Dienstag** | **false** | **true** | **24** |
| 3 | Mittwoch | true | true | 3 |
| 4 | Donnerstag | true | true | 3 |
| 5 | Freitag | true | true | 3 |
| 6 | Samstag | true | true | 3 |
| 0 | Sonntag | false | true | 3 |

Tuesday: shop closed, but she still delivers — pre-ordered only, hence 24 hours.
Sunday delivery is deliberate and she specifically wants it. Sunday delivery is
unusual for a Swiss florist and worth saying loudly on the site — it is a real
differentiator against both Fleurop and the local competition.

### Runs

Two per delivering day: **10:00–12:00** and **16:00–18:00**.

Generate rows ~60 days ahead on a nightly job. Never generate on demand inside
a request — a slow or failed generation then breaks checkout.

Show them as **windows**, never exact times. Fleurop is explicit that time-of-day
wishes cannot be guaranteed, and they have a national network. She has one van.

> But note the flip side: because she *is* one van with two fixed runs, she can
> guarantee a two-hour window where Fleurop cannot. That is a genuine competitive
> advantage over the big player. Say it on the site.

### Timed deliveries

Funerals, weddings, events. The customer gives the **ceremony time**; she
delivers roughly an hour before. Bypasses runs entirely — `fulfilment = 'timed'`,
`requested_delivery_at` set.

Cap at **3 per hour** (her number), checked in-transaction under the same lock
pattern as run capacity.

Required fields, taken from Fleurop's funeral checklist — they've had decades to
work out what goes wrong:

- Time of the ceremony
- Location (church, cemetery, Abdankungshalle) — not a home address
- **Full name of the deceased**
- **Phone number of a family member**
- Free-text instructions

### Every disabled date needs a reason

A greyed-out date with no explanation is a conversion killer. Each disabled
state carries a German string:

| condition | message |
|---|---|
| blackout | `Geschlossen` |
| Tuesday inside 24h | `Dienstags bitte 24 Stunden im Voraus bestellen` |
| inside cutoff | `Zu kurzfristig – bitte einen späteren Termin wählen` |
| product lead time | `Dieses Produkt benötigt X Tage Vorlauf` |
| at capacity | `Ausgebucht` |
| beyond horizon | `Nur bis einen Monat im Voraus buchbar` |

### Timezone

Everything `timestamptz`, all cutoff arithmetic in **Europe/Zurich**.

Switzerland observes DST. On the two changeover Sundays a naive UTC calculation
shifts the cutoff by an hour, and 16:00–18:00 silently becomes 15:00–17:00. Use
a real timezone library and store the IANA name, never a fixed `+01:00` offset.

### Policies to copy verbatim

Three of Fleurop's, battle-tested and free:

**Nobody home.** Every order must choose one of three up front: hand to a third
party (neighbour, reception), leave at the door, or hold at the shop for two days.
And crucially — **if the buyer chooses "leave at the door," the buyer carries the
theft risk.** Put that clause in the AGB.

**Substitution.** State plainly that the assortment is seasonal and a product may
look somewhat different while matching the pictured form and colour as closely as
possible. Visible at checkout, not buried.

**Hospital deliveries.** Many hospitals allow bouquets only — no arrangements with
soil or floral foam, on hygiene grounds — and require ward and room number.
Intensive care is not deliverable. If she delivers to the Kantonsspital Baden,
this belongs in the delivery notes field as guidance.

### Benchmarks

| | Fleurop | Magenta Blumen |
|---|---|---|
| Same-day cutoff | 15:00 weekdays, 13:00 Sat | 3 hours before the run |
| Guaranteed time window | Express / timed / funerals only | **every delivery** |
| Minimum bouquet | CHF 35 | CHF 40 |
| Booking horizon | — | 1 month |

Her CHF 40 minimum sits just above the market floor. Sensible.
