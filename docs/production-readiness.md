# Production readiness — reference

Audited 23 November 2026. Launch target 1 December 2026 (soft launch, cap 5).

> **This file is not a work order.**
>
> It is the human launch checklist, and most of it is not code: DNS, Stripe
> verification, email deliverability, entering the real catalogue, a restore
> drill, and QA on real devices with real payment methods.
>
> The code-side subset — the part that can be done in this repository,
> reviewed in a diff and verified by a test — is in `docs/launch-tasks.md`.
> Work from that file. Read this one for context only.
>
> Nothing here is permission to touch `.env*`, secrets, DNS, the server, or
> the production database. See the stop list in `docs/launch-tasks.md`.

---


Items are grouped by whether they **block launch**, **should be done before
real customers**, or are **post-launch**. Nothing here is padding — each item
either prevents a failure or is legally required.

---

## A. BLOCKERS — cannot launch without these

### A1. Domain cutover

Still running on `178-104-239-168.nip.io`. **This cannot be the production
hostname.**

- Stripe webhooks would depend on a free third-party DNS service. If nip.io
  has an outage, payments stop and orders are not confirmed.
- Resend cannot verify SPF/DKIM on a domain you don't control, so order
  confirmations either don't send or send from a Resend sandbox address.
- Customers will not trust a URL that looks like an IP address.

**Required, in order:**

1. Confirm with the client **when the previous agency's contract ends**.
2. **Find out where `info@magenta-blumen.ch` receives mail today.** If the
   mailbox is on the old provider's server, pointing the A record at Hetzner
   kills her business email the moment you do it. The MX records must be
   preserved or the mailbox migrated *before* cutover.
3. Get registrar/DNS access in her name.
4. Point A/AAAA at `178.104.239.168`, leave MX untouched unless migrating.
5. Change `DOMAIN=` and `AUTH_URL=` in `/opt/magenta-blumen/.env.production`.
6. `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate app caddy`
7. Verify Caddy issues a Let's Encrypt cert for the real hostname.
8. **Update the Stripe webhook endpoint** in the Stripe dashboard to the new
   URL. Old endpoint keeps firing at nip.io otherwise.
9. Update `NEXT_PUBLIC_SITE_URL` — `robots.ts` and the sitemap currently fall
   back to the nip.io host, which would publish nip.io URLs to Google.

**If the handover is not imminent:** buy a stopgap domain (~CHF 15/yr) and run
on that. Do not launch on nip.io.

### A2. Stripe live mode

- [ ] Stripe account fully verified (Swiss KYC — UID, IBAN, ID document).
      Verification takes days; started but not confirmed complete.
- [ ] Live keys in `.env.production`: `STRIPE_SECRET_KEY` (`sk_live_…`),
      `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`).
- [ ] **New `STRIPE_WEBHOOK_SECRET`** — live-mode webhooks have a *different*
      signing secret from test mode. Using the test secret in production means
      every webhook fails signature verification and no order is ever confirmed.
- [ ] **TWINT activated** on the live account (separate from card).
- [ ] Statement descriptor set to `MAGENTA BLUMEN`.
- [ ] One real card transaction end-to-end on the live account, then refunded.

### A3. Email sending verified

- [ ] Resend domain verified (SPF + DKIM DNS records on the real domain).
- [ ] `from` address is on her domain, not `onboarding@resend.dev`.
- [ ] Reply-to points at a mailbox she actually reads.
- [ ] Send a real order confirmation to a Gmail, an Outlook and a GMX address.
      Check it does not land in spam.
- [ ] DMARC record published (`p=none` is fine to start).

### A4. Remove development data

- [ ] Delete the seeded dev products from production:
      `DELETE FROM product WHERE slug LIKE 'dev-%';`
      (cascades handle variants, categories, colours).
- [ ] Delete any test orders placed during development.
- [ ] Orphaned R2 image objects from deleted products — tidy or ignore,
      they cost pennies.

### A5. Real catalogue entered

- [ ] The client has entered her real products with her own photos.
- [ ] **Rose per-stem price** — still an open question in CLAUDE.md.
- [ ] **Custom bouquet tier prices** — she said 40–120, exact tiers never
      confirmed.
- [ ] Every variant price sanity-checked. A plausible-but-wrong placeholder
      (e.g. a rose at CHF 4.50 because someone guessed) passes every
      constraint and will sell at that price.

### A6. Uncommitted work

14 files modified, 3 deleted, one untracked component — a half-finished admin
status/Heute refactor. Commit, stash, or revert. Do not go into a launch week
with a partial refactor in the working tree.

---

## B. SECURITY — before real customers

Much of this is already in place. Verify rather than assume.

### B1. Already done — confirm still true

- [x] CSP header in `next.config.ts`, explicit allowlist.
- [x] HSTS, X-Frame-Options, X-Content-Type-Options in the Caddyfile.
- [x] Sentry `sendDefaultPii: false` in all three configs (revFADP).
- [x] `tracesSampleRate: 0.1`.
- [x] Rate limiting on customer auth and admin signin.
- [x] Postgres not exposed publicly — Docker network only.
- [x] SSH key-only, root login disabled, `ufw` + Hetzner firewall.
- [x] `.env*` gitignored.
- [x] `/admin`, `/api`, `/kasse`, `/konto` excluded in `robots.ts`.

### B2. Verify before launch

- [ ] **Authorisation on every server action.** 8 action files, 6 contain a
      `requireAdmin`/`requireAuth` call. Check the other two — a server action
      is a network endpoint with a generated ID and can be invoked directly,
      bypassing every page guard.
- [ ] **Order lookup scoping.** Can `/admin/bestellung/[number]` or any
      customer-facing order page be reached by guessing an order number?
      Order numbers carry 4 random bytes, which helps, but the page must scope
      to the session, not trust the URL. Under revFADP, leaking recipient
      names, addresses and phone numbers is a reportable breach.
- [ ] **Customer account isolation.** Log in as customer A, note an order ID,
      try to fetch it as customer B and as a logged-out visitor. Must 403/404.
- [ ] **Admin isolation.** Hit every `/admin/*` route logged out. Must redirect
      to signin, not render.
- [ ] **No secrets in the client bundle.** `grep -r "sk_live\|sk_test" .next/`
      after a build. Should return nothing.
- [ ] **Webhook raw body.** Confirm nothing in `proxy.ts` parses
      `/api/webhooks/stripe` before the handler sees it.
- [ ] **Admin password** is strong and stored in Bitwarden. It is the only
      thing between the internet and every customer's address.
- [ ] Rotate any credential that has ever been pasted into a chat, an issue or
      a screenshot.

### B3. Data protection (revFADP)

- [ ] Datenschutzerklärung names every processor: **Hetzner (Germany)**,
      Cloudflare R2, Stripe, Resend, Sentry (Frankfurt).
- [ ] It states data is processed in Germany, not Switzerland.
- [ ] Customer deletion path exists — `customer.anonymised_at` is in the
      schema; confirm there's a documented procedure to null the personal
      fields while keeping orders for the 10-year retention requirement.
- [ ] Cookie banner: the cart and session cookies are strictly necessary, so
      no consent needed — but confirm nothing analytics-like has crept in.

---

## C. LEGAL & CONTENT

- [ ] **Impressum** — exact registered name `Magenta Blumen - Kishta`,
      Zürcherstrasse 142, 5432 Neuenhof, **CHE-363.951.581 MWST**, email and
      phone. The hyphenated legal name is required, not the shop sign name.
- [ ] **AGB** must include:
  - Substitution clause (seasonal availability, product may differ)
  - **Nobody-home policy** — three options, and that choosing "leave at the
    door" transfers theft risk to the buyer
  - Cancellation/refund policy
  - Delivery areas and minimum order values
- [ ] **Order confirmation email must be a valid MWST invoice** (per the
      Treuhänder): seller name and address, MWST number, customer details,
      delivery date, itemised supply, price, **VAT split by rate**. A
      bouquet-plus-vase order must show two lines at 2.6% and 8.1%, not a
      blended total.
- [ ] **Copy audit.** The design was ported from a Figma mockup containing
      claims that are not hers — "Ecuador-Rosen", "Bestellung bis 14:00 Uhr",
      "Lieferung am nächsten Tag". Any of these surviving into production is a
      false-advertising problem, not a styling one. Grep every German string.
- [ ] Delivery promise matches reality: two runs (10–12, 16–18), 3-hour cutoff,
      Tuesday 24h, 27 postcodes.

---

## D. OPERATIONS

### D1. Backups — the one that gets skipped

Scripts and timers exist (`backup.sh`, `restore-check.sh`, four systemd
timers). That is not the same as working.

- [ ] Confirm `backup.timer` has actually fired and objects exist in the R2
      backups bucket.
- [ ] **Perform one restore into a scratch database and look at the data.**
      An untested backup is a rumour. This is the single most important item
      in section D.
- [ ] Confirm `restore-check.timer` is enabled and its journal is clean.
- [ ] Document how long a full restore takes.

### D2. Scheduled jobs

- [ ] All four timers enabled and `systemctl list-timers` shows next run times.
- [ ] **Delivery-run generation health check** — alert if the bookable horizon
      drops below 30 days. A silently failing generator is invisible until
      dates run out three weeks later.
- [ ] Reaper running every 5 minutes.

### D3. Monitoring

- [ ] Sentry alert rules configured — not just capturing, but **notifying**.
      An error at 16:00 on 13 February that you read the next morning is worth
      little.
- [ ] Payment-route errors routed to your phone, not only email.
- [ ] **Uptime monitoring** — Sentry cannot tell you the server is down,
      because nothing is running to report it. Add a free external monitor
      (UptimeRobot / Better Stack) hitting a health endpoint every 5 minutes.
- [ ] Disk-space alert on the Hetzner box.

### D4. Deployment

- [ ] Deploy procedure documented and tested by someone following `deploy.md`
      literally.
- [ ] A rollback path: how to get back to the previous image if a deploy
      breaks production during Christmas week.

---

## E. QA — before the cap comes off

### E1. End-to-end dry runs on production

Each one placed as a real customer, on a phone, then verified in the database
and on the Heute screen.

- [ ] Card payment, delivered to a real address.
- [ ] TWINT payment.
- [ ] Cash on delivery.
- [ ] Invoice.
- [ ] Pickup instead of delivery.
- [ ] A funeral/timed order with the ceremony-time fields.
- [ ] An order with an add-on (bouquet + vase) — **check the VAT split shows
      two rates on the confirmation email**.
- [ ] PLZ 5415 — confirm the Ortschaft picker offers Nussbaumen (CHF 12) and
      Rieden (CHF 14) and the fee changes.
- [ ] An order below the minimum — must be rejected at the cart, not at
      checkout.
- [ ] Refund one of these through the Stripe dashboard and confirm the system
      reflects it.

### E2. Webhook behaviour against live Stripe

- [ ] Replay a webhook from the Stripe dashboard — exactly one order results.
- [ ] Confirm the endpoint is receiving events (Stripe dashboard shows
      delivery attempts and responses).

### E3. The client uses it

- [ ] She and Sandra run a full day of orders on the Heute screen without you
      in the room.
- [ ] Print a Bon on her actual printer. Check it fits the paper.
- [ ] She marks a cash order paid and it records `marked_paid_by`.
- [ ] She adds a product, changes a price, archives one.
- [ ] She closes a delivery run and confirms it disappears from checkout.

### E4. Load sanity

- [ ] Set a run's capacity to 2, have three people order simultaneously,
      confirm exactly two succeed. The concurrency test proves the lock in
      isolation; this proves it through the real stack.

### E5. Cross-device

- [ ] iPhone Safari, Android Chrome, desktop Chrome, desktop Firefox.
- [ ] The checkout calendar on a small screen.
- [ ] Disabled dates show a reason on tap, not just hover.

---

## F. LAUNCH DAY

- [ ] Daily cap set to **5** in Einstellungen.
- [ ] Phone ordering continues exactly as before — the site supplements, it
      does not replace.
- [ ] She knows how to close a run if overwhelmed.
- [ ] She has your number.
- [ ] Watch Sentry and the Stripe dashboard for the first few orders.
- [ ] Raise the cap gradually over the following weeks.

---

## G. POST-LAUNCH / PHASE 2

Not needed for launch. Keep visible so they stay sold rather than assumed.

- Gift cards (schema hatch already exists: `giftcard_applied_gross`,
  `amount_due_gross`)
- Business invoicing terms
- Loyalty tiers — thresholds and percentages still undecided
- Gärtnerservice booking
- Postal shipping at checkout
- Blumen-Abo (subscriptions)
- Gemini image recognition for product entry (the client's idea — good one,
  Phase 2)
- Narrowing the two R2 tokens from Admin R/W to Object R/W

---

## Open questions still unanswered

From CLAUDE.md, each needs a real answer before or shortly after launch:

| Question | Who | Blocks |
|---|---|---|
| Rose per-stem price | Client | Real catalogue |
| Custom bouquet tiers (exact) | Client | Real catalogue |
| Delivery fee rate on mixed-rate orders | Treuhänder | Invoice correctness |
| Dried/stabilised flowers — 2.6% or 8.1%? | Treuhänder/ESTV | Invoice correctness |
| Effektiv vs Saldosteuersatz | Treuhänder | Reporting only |
| Loyalty thresholds | Client | Phase 2 |

---

## Honest assessment of the date

The code is in good shape. Payments, the reaper race, accounts, the admin, the
legal pages and six test files are all done — more than was scoped.

What is **not** done is everything that isn't code: the domain, live Stripe,
verified email, the real catalogue, a tested restore, and a QA pass.

1 December is eight days away. It is achievable only if the domain handover
happens this week. If it doesn't, **mid-December is still comfortably before
Christmas** and buys a proper QA week.

A launch date exists to be useful, not to be met. Moving it two weeks costs
almost nothing. Launching into Christmas on untested ground costs a great deal.
