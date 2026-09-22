# Storefront copy — what's actually true about this shop

Authoritative reference for every customer-facing string. If a piece of
copy in the Figma design contradicts this file, this file wins. Every
Figma phrase gets checked against this before it ships. Legal / trading
standards exposure otherwise — false advertising isn't a styling choice.

## The shop

- **Magenta Blumen**, single florist in **Neuenhof AG, Switzerland**
- Owner + Sandra (assistant) run it
- **MWST-Nummer:** CHE-363.951.581 MWST
- Small shop with a van, not a distribution network

## Sourcing

- **Not** "Ecuador-Rosen", "Kolumbianische Rosen", "Vom Feld zur Vase",
  "direkte Beschaffung von den besten Gärtnereien der Welt". None of
  that. It's a local florist buying from Swiss wholesalers.
- Correct framing: **fresh flowers, Swiss quality, arranged by hand
  in Neuenhof.** Nothing about international sourcing.

## Delivery

- **Own van**, **owner drives** — not a courier company
- **27 postcode zones in the Aargau area** — not "schweizweit" / not
  "Schweiz-weit am nächsten Tag"
- **Two runs per day: 10:00–12:00 and 16:00–18:00**, **including
  Sunday** (deliberate; a Swiss florist that delivers Sunday is
  unusual — worth calling out)
- **Cutoff: 3 hours before the run starts** (per-weekday, Tuesday is
  24h because the shop is closed but delivery still runs on
  pre-orders)
- **In-store pickup (Abholung)** also available
- **NOT** "Bestellung bis 14:00 Uhr". NOT "Lieferung am nächsten Tag".
  NOT "Express-Lieferung". Correct is same-day within the cutoff
  window, into one of the two run windows.

## Fees + minimums

- Minimum order **CHF 40** (against subtotal, not including delivery
  or card message). Brugg is CHF 50.
- **Free delivery over CHF 120**
- 27 zones with per-zone fees CHF 8–20
- MWST **inklusive** (Swiss shops always show gross prices)

## Payments

- **Card** (Stripe) and **TWINT** on delivery / online
- Cash on delivery (for now, tolerated risk)
- Invoice deferred to Phase 2

## Products

- **Bouquets, cut flowers, arrangements, plants (indoor + outdoor),
  orchids, decoration, dried, stabilised, candles + figurines,
  add-ons** — see the seeded category list
- Colour is a **facet** (not a category), always **owner's choice**
  ("she picks the colours herself")
- Custom bouquets: **CHF 40–120 tier** (exact tiers TBD)
- Roses **per stem** (per_unit pricing) — price TBD

## Enquiry-only services

- **Hochzeit / Wedding** — not orderable online, enquiry only
- **Trauerfloristik** (funeral ceremony arrangements) — enquiry
  ONLY for ceremony work. Funeral BOUQUETS stay orderable as timed
  deliveries.
- **Gärtnerservice** — on-site planting service, no shopping cart

## Auth / accounts

- **Guest checkout is default.** No account required to order.
- **Accounts are optional**, offered after payment
- **Phone required but not verified** (used to recover failed
  deliveries)
- Password reset by email
- **No SMS, no phone verification, no Twilio.** Removed from scope
  earlier in the project.

## OUT OF SCOPE — do NOT build a UI for these

Design mockups have them; the signed agreement / CLAUDE.md defers them.

- **Wishlist / Merkzettel** — not in Phase 1
- **Subscriptions / Blumen-Abo** — deferred (explicit in signed
  agreement)
- **Gift cards** (`giftcard_applied_gross` exists as a schema hook
  only) — Phase 3
- **Loyalty tier UI** — Phase 3 (tier snapshot columns exist for
  when it lands)
- **User account page beyond simple "your past orders"** — Phase 2
- **Reviews / ratings**
- **Search overlay** — not on the critical path; browse via
  categories is enough for launch

If a mockup shows one of these, the button / link stays out. Adding
scope late is how launches slip.

## Legal (referenced from footer, real content lands in Session 8)

- **Impressum** — legally required
- **AGB** (Allgemeine Geschäftsbedingungen)
- **Datenschutzerklärung** (revFADP-compliant privacy notice)

## Language / tone

- All customer copy in **Swiss German orthography**: no ß (use
  ss). Grösse, Sträusse, Schliesstage.
- Swiss quotation marks: **«...»** (not "..." or „...")
- Neutral, warm, competent tone. Not "premium/aspirational". Not
  chatty. This is a real shop that has been running; the site
  represents it, doesn't invent it.
- Prices always as **CHF 45.00** (or **CHF 45.–** for even amounts
  in printed contexts). Web uses `.00` uniformly for consistency.
