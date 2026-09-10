# Delivery Zones — Seed Data

Transcribed from the shop's printed price list (photo). **Handwritten corrections
override the printed values** — those are the current prices.

---

## Rules from the sheet

**Global minimum order: CHF 40.00** — and critically, the sheet says
*"ohne Karte + Transport"*: the minimum is checked against the **product subtotal**,
excluding the greeting card and the delivery fee.

```
min_order check  ->  subtotal_gross          (NOT total_gross)
```

Get this wrong and a CHF 32 bouquet with a CHF 8 delivery passes the CHF 40 check.
It shouldn't.

**Two zones override the global minimum:**

| Zone | Own minimum |
|---|---|
| Brugg Stadt | CHF 50 or 60 — **handwritten, ambiguous** |
| Untersiggenthal | CHF 50 |

So `delivery_zone.min_order_gross` is confirmed as necessary and is **not uniform**.
Everything else defaults to 40.

**Free delivery above CHF 120** (from Q49) — but see the open question below.

---

## The zones

29 entries. Fees CHF 8–20.

| Ort | Fee CHF | PLZ (verify) | Note |
|---|---:|---|---|
| Neuenhof | **8.00** | 5432 | home town |
| Stadt Baden | 10.00 | 5400 | |
| Kantonsspital Baden | 10.00 | 5404 | hospital — see below |
| Ennetbaden | 10.00 | 5408 | |
| Killwangen | 10.00 | 8956 | |
| Wettingen | 10.00 | 5430 | |
| Dättwil | 12.00 | 5405 | |
| Fislisbach | 12.00 | 5442 | |
| Nussbaumen | 12.00 | 5415 | |
| Spreitenbach | 12.00 | 8957 | |
| Rütihof | **10.00** | 5406 | printed value struck out, handwritten 10 |
| Birmenstorf | 14.00 | 5413 | |
| Kirchdorf | 14.00 | 5416 | |
| Rieden (bei Nussbaumen) | 14.00 | 5415 | |
| Würenlos | 14.00 | 8116 | |
| Ehrendingen | 15.00 | 5420 | |
| Freienwil | 15.00 | 5423 | |
| Niederrohrdorf | 15.00 | 5443 | "Nd-Rohrdorf" on the sheet |
| Oberrohrdorf | 15.00 | 5452 | "Ob-Rohrdorf" on the sheet |
| Obersiggenthal | 15.00 | 5415 | |
| Turgi | **15.00** | 5300 | printed 18.00 struck out, handwritten 15 |
| Mellingen | 16.00 | 5507 | |
| Bellikon | 18.00 | 5454 | |
| Remetschwil | 18.00 | 5453 | |
| Untersiggenthal | 18.00 | 5417 | **min. order CHF 50** |
| Brugg Stadt | 20.00 | 5200 | **min. order CHF 50 or 60 — confirm** |
| Endingen | 20.00 | 5304 | Bezirk Zurzach |
| Lengnau | 20.00 | 5426 | Bezirk Zurzach |
| Otelfingen | 20.00 | 8112 | **Kanton Zürich** |

> **The PLZ column is my mapping, not hers.** Several of these municipalities have
> more than one postal code, and some codes cover several villages (the
> Obersiggenthal / Nussbaumen / Kirchdorf / Rieden cluster especially). Check all
> 29 against the official Swiss Post directory before seeding — it is a ten-minute
> job and a wrong code silently sends orders to the wrong price or rejects them.

**Note that the list crosses cantonal borders** — Otelfingen is Zürich, and
Killwangen, Spreitenbach and Würenlos sit in the 8xxx range. Further confirmation
that a radius calculation would have been the wrong model. The allowlist is right.

---

## Seed SQL

```sql
INSERT INTO delivery_zone (name_de, method, fee_gross, min_order_gross, free_over_gross, sort_order) VALUES
  ('Neuenhof',             'own_van',  8.00, 40.00, 120.00,  1),
  ('Stadt Baden',          'own_van', 10.00, 40.00, 120.00,  2),
  ('Ennetbaden',           'own_van', 10.00, 40.00, 120.00,  3),
  ('Killwangen',           'own_van', 10.00, 40.00, 120.00,  4),
  ('Wettingen',            'own_van', 10.00, 40.00, 120.00,  5),
  ('Rütihof',              'own_van', 10.00, 40.00, 120.00,  6),
  ('Dättwil',              'own_van', 12.00, 40.00, 120.00,  7),
  ('Fislisbach',           'own_van', 12.00, 40.00, 120.00,  8),
  ('Nussbaumen',           'own_van', 12.00, 40.00, 120.00,  9),
  ('Spreitenbach',         'own_van', 12.00, 40.00, 120.00, 10),
  ('Birmenstorf',          'own_van', 14.00, 40.00, 120.00, 11),
  ('Kirchdorf',            'own_van', 14.00, 40.00, 120.00, 12),
  ('Rieden bei Nussbaumen','own_van', 14.00, 40.00, 120.00, 13),
  ('Würenlos',             'own_van', 14.00, 40.00, 120.00, 14),
  ('Ehrendingen',          'own_van', 15.00, 40.00, 120.00, 15),
  ('Freienwil',            'own_van', 15.00, 40.00, 120.00, 16),
  ('Niederrohrdorf',       'own_van', 15.00, 40.00, 120.00, 17),
  ('Oberrohrdorf',         'own_van', 15.00, 40.00, 120.00, 18),
  ('Obersiggenthal',       'own_van', 15.00, 40.00, 120.00, 19),
  ('Turgi',                'own_van', 15.00, 40.00, 120.00, 20),
  ('Mellingen',            'own_van', 16.00, 40.00, 120.00, 21),
  ('Bellikon',             'own_van', 18.00, 40.00, 120.00, 22),
  ('Remetschwil',          'own_van', 18.00, 40.00, 120.00, 23),
  ('Untersiggenthal',      'own_van', 18.00, 50.00, 120.00, 24),
  ('Brugg Stadt',          'own_van', 20.00, 50.00, 120.00, 25),  -- confirm 50 vs 60
  ('Endingen',             'own_van', 20.00, 40.00, 120.00, 26),
  ('Lengnau',              'own_van', 20.00, 40.00, 120.00, 27),
  ('Otelfingen',           'own_van', 20.00, 40.00, 120.00, 28);
-- Kantonsspital Baden: same fee as Stadt Baden, folded into that zone.
-- Postal shipping: not on this sheet. Still undefined.
```

---

## Four things this raises

**1. Free-over-120 versus a CHF 20 zone fee.**
A CHF 125 order to Otelfingen or Brugg earns her roughly CHF 80 gross, minus a
CHF 20 delivery she's now absorbing plus the drive time. Does *free over 120*
really apply to the far zones, or only to the CHF 8–12 ones? Two clean options:

- raise the free threshold in the expensive zones (e.g. free over 150 where the fee is 18–20), or
- keep 120 everywhere and accept it as a marketing cost.

Either works. It needs to be her decision, and the schema already supports
per-zone thresholds.

**2. Kantonsspital Baden is a destination, not a place.**
She lists the hospital separately, which confirms she delivers there regularly.
Same fee as Stadt Baden, so it doesn't need its own zone — but it does argue for a
**hospital delivery option** on the order: ward and room number, and a note that
many Swiss hospitals accept bouquets only, no soil or floral foam, and nothing to
intensive care.

**3. Brugg Stadt minimum: 50 or 60?**
The handwriting is ambiguous. One question to her.

**4. Postal shipping is still not defined.**
The sheet is van-only. She said orders over 30km go by post, and gave the Bern
example (CHF 40 bouquet, CHF 22 postage — doesn't work). So the postal zone needs
its own row with a much higher `min_order_gross` — 80 to 100 — and probably a flat
fee she picks.

---

## Open questions reduced

Q48 and Q135 are now **answered**. Remaining blockers on the schema: only the VAT
split (Q43, needs the Treuhänder). Everything else can proceed.
