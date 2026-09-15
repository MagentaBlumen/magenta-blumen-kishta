# Swiss VAT (MWST) — classification and application

This is the reference for classifying every product Sandra enters, and for the
delivery-fee, rounding and invoice rules that follow. Confirmed by the
Treuhänder; open items are flagged inline.

Application code must never hardcode 8.1% or 2.6%. Always read from
`tax_rate.rate`. The seed sets both values at boot; changing them there is a
one-file edit that propagates on the next deploy.

---

## Rates

| Code       | Name             | Rate    | `tax_rate.rate` |
|------------|------------------|---------|-----------------|
| `reduced`  | Reduzierter Satz | **2.6%**| `0.0260`        |
| `standard` | Normalsatz       | **8.1%**| `0.0810`        |

---

## Product group → rate

| Product group                                              | Rate | Notes |
|------------------------------------------------------------|-----:|-------|
| Schnittblumen, Blumensträusse, Arrangements                | 2.6% | core product |
| Kränze und Gestecke aus Schnittblumen / Zweigen            | 2.6% | funeral floristry, incl. Trauerfloristik |
| Lebende Zimmerpflanzen                                     | 2.6% | |
| Lebende Garten- und Balkonpflanzen                         | 2.6% | |
| Sämereien, Dünger, Erde                                    | 2.6% | agricultural inputs |
| Vasen, Übertöpfe, Gefässe, Glaswaren                       | 8.1% | vessels — even when sold with flowers |
| Kerzen, Figuren, Dekorationsartikel                        | 8.1% | |
| Grusskarten                                                | 8.1% | |
| Trockenblumen, stabilisierte Blumen                        | 8.1% | **UNVERIFIED** — Treuhänder flagged this needs ESTV confirmation; she does sell them |

A single order can mix rates. Bouquet + vase is the common case.

---

## Delivery fee — ancillary supply rule

Delivery that is **ancillary to a goods supply** follows the rate of the main
supply. Only genuinely separate transport is automatically 8.1%.

| Order composition          | Delivery-fee rate | Notes |
|----------------------------|-------------------|-------|
| Bouquet only               | **2.6%**          | ancillary to a 2.6% supply |
| Vase / decoration only     | **8.1%**          | ancillary to an 8.1% supply |
| Mixed (bouquet + vase, …)  | **undecided**     | see interim rule below |

**Interim rule for mixed orders:** apply the rate of the highest-value line
group in the order.

**Implementation constraint.** This decision must live behind a single named
function — `resolveDeliveryTaxRate(orderLines)` — so it can be replaced in one
place when the Treuhänder confirms. Do not scatter the logic across the
checkout code. The result is snapshot onto `order.delivery_fee_tax_rate` at
checkout, so historical orders are never affected by later rule changes.

The column `order.delivery_fee_tax_rate` already exists. No schema change is
needed to implement this.

---

## Rounding

Prices and VAT are calculated **to the rappen (CHF 0.01)**. Do **not** round
individual lines to CHF 0.05. Never round in the middle of a calculation —
work in exact `numeric(10,2)` throughout, and let the final total carry the
sum of the line totals.

CHF 0.05 rounding applies **only** to a cash total at the physical counter —
i.e. Sandra handing back change. Card, TWINT and invoice all settle to the
rappen.

For Stripe, convert the final amount to **integer Rappen (× 100, rounded)** at
the point of payment intent creation, and nowhere else. Never store or
transmit Rappen internally — the internal money type is `numeric(10,2)` gross
CHF.

---

## Invoice requirements

The order confirmation email **is** the customer's receipt and must be a
VAT-compliant invoice under Art. 26 MWSTG. Every confirmation email must
contain:

- Seller name and address
- MWST number: **CHE-363.951.581 MWST**
- Customer name and address (buyer, not recipient — the recipient must never
  be emailed)
- Date or period of the supply (delivery date, or pickup date)
- Nature, subject and extent of the supply — line-level, not a lumped total
- Price
- VAT amount and rate, **split clearly by rate** where more than one applies

A bouquet + vase order must therefore show two subtotals at two rates, not one
blended total. Delivery fee is its own line at its own rate.

The `order_line.tax_rate` snapshot already carries the rate frozen at
purchase, so the email template can group and total by rate without touching
the live `tax_rate` table. It must actually do so.

Implementation happens in week 11 (email templates). Nothing here changes the
schema; this file is the requirement.

---

## Open questions

- **Mixed-rate delivery fee.** Interim rule: highest-value group. Awaiting
  Treuhänder confirmation.
- **Dried / stabilised flowers.** Currently classified 8.1% — the Treuhänder
  flagged this needs ESTV verification. She does sell them.
- **Accounting method: effektiv or Saldosteuersatz?** Affects whether input
  VAT is deducted line by line or paid at a flat sector rate. Answer changes
  reporting, not per-order pricing.
