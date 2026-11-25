# Launch tasks — code side only

Everything in this file is work **inside this repository**. It is the subset of
`docs/production-readiness.md` that can be done in code, reviewed in a diff,
and verified by a test or a grep.

Read this file together with `CLAUDE.md`. Nothing here overrides it. Where the
two disagree, `CLAUDE.md` wins.

## Paste this into Claude Code to begin

```
Read CLAUDE.md and docs/launch-tasks.md in full before doing anything.

You are working through the launch task list. Follow this protocol exactly.

ORDER
Work in this order, skipping any task that is already done:
  1, 2, 3, 4, 13, 5, 6, 14, then the batch 16 / 17 / 18 / 11 / 7 / 12,
  then 8, 9, 10.
Task 15 is already implemented. Do not touch it.

PER TASK
1. State the task number and what you are about to change, before changing it.
2. Make the change.
3. Run: npm run lint, npm run typecheck, npm test.
   Also run npm run build at the end of every REVIEW task and at the end of
   the batch. If anything fails, fix it before going further. Never leave the
   gate red and move on.
4. Report: which files changed, what each change does, and anything you were
   unsure about or had to assume.
5. Do not run git commit or git push. Leave the work in the tree for review.

STOPPING
Tasks marked REVIEW touch authorisation, payment, VAT or German
customer-facing copy. After each one, STOP and wait for my approval before
starting the next. End with exactly: "Task N done, waiting for review."

Tasks 16, 17, 18, 11, 7 and 12 are not REVIEW. Chain those without stopping
and report once at the end of the batch.

Task 1 is report-only. Tell me what the uncommitted refactor does, which
parts are complete, and whether it is coherent. Change nothing. If git status
is already clean, skip it and say so.

RULES
- If a task is already implemented, say so and move on. Do not rebuild it, and
  do not improve working code nobody asked you to touch.
- If a task needs the server, DNS, Stripe, .env* or the production database,
  stop and say so. Those are mine to run, from docs/launch-runbook.md.
- Never tick a checkbox in any file. Never report a human step as done.
- If you need a value that is not in this repo, use an obvious placeholder and
  flag it. Never guess a plausible one.
- The stop list below applies to every task, without exception.

Begin.
```

After each REVIEW task: read the diff, then reply `approved, continue` or say
what to change. After the batch: read the diff and commit.

---

## How to work through this file

- **One numbered task per turn.** Do it, say what changed, stop. Wait for a
  review before starting the next.
- Tasks marked **REVIEW** touch payment, authorisation, VAT or German customer
  copy. Those are red zone under `CLAUDE.md`. Produce a diff and explain it;
  do not consider them done until the human says so.
- If a task needs a value that is not in this repo, use an obvious placeholder
  and say so. Never guess a plausible-looking one.
- Do not tick a checkbox in any file. The human tracks status.

## Do not do, under any circumstances

These appear in `docs/production-readiness.md` because a human has to do them.
They are listed here so that reading that file is not mistaken for permission.

- Do not read, write or create `.env`, `.env.production` or any `.env*` file.
- Do not set, print, echo or ask for any key, token, password or secret.
- Do not run anything against the production database. Local dev database only.
- Do not SSH to the server, and do not touch `ufw`, systemd units, timers,
  Caddy config, or the backup and restore scripts.
- Do not run `git commit`, `git push`, `git reset --hard`, or `git clean`.
- Do not register a domain, change DNS, or open an account anywhere.
- Do not modify `src/db/schema/*` without flagging it and waiting for a yes.
- Do not install a dependency without asking first.

---

## 1. Finish or revert the admin status refactor — REVIEW

The working tree has 14 modified files, 3 deletions and one untracked
component (`src/components/admin/status-chip.tsx`). It is a half-finished
refactor of the admin status handling and the Heute screen.

**Do:** read the full diff. Report in plain language what the refactor was
doing, which parts are complete, and which files are inconsistent with each
other. Propose either a short list of edits to finish it, or a revert.

**Do not** commit, and do not revert anything until told which way to go.

**Done when:** the human has a clear answer to "is this safe to commit as is".

## 2. Authorisation guard on every server action — REVIEW

Of the eight server-action files, six call `requireAdmin` or `requireAuth`.
Two do not.

A server action is a network endpoint with a generated ID. It can be invoked
directly, with a crafted POST, bypassing every page-level guard and every
layout check. A page guard is not an authorisation check.

**Do:**

1. List every exported server action in the project, file by file.
2. For each, state which guard it calls, or that it calls none.
3. For each unguarded one, say what an unauthenticated caller could do with
   it, then add the correct guard.
4. Where an action operates on a customer-owned row, the guard must also scope
   to the session's own customer id — not merely "is logged in".

**Done when:** every action has a guard, and the table of action → guard is in
the turn output so it can be checked by eye.

## 3. Order pages must scope to the session, not trust the URL — REVIEW

Order numbers contain four random bytes, which raises the cost of guessing.
That is obfuscation, not authorisation.

**Do:** audit every route that renders an order — the admin order page, the Bon
page, and the customer order pages under `/konto`. For each, confirm the query
filters on the authenticated identity and not only on the order number from
the URL. Fix any that do not.

A guest order has no session. State explicitly how a guest reaches their own
order, and confirm that route cannot be used to enumerate other orders.

**Why it matters:** an order row carries recipient name, address and phone.
Under revFADP, exposing those is a reportable data breach, not a bug.

**Done when:** each route is listed with the predicate it filters on.

## 4. Isolation tests

Add Vitest tests next to the existing six. They must fail if someone later
removes a guard.

- Customer A cannot read customer B's order.
- A logged-out request for a customer order gets 403 or 404, never a render.
- An admin-only query called with a customer session is refused.
- A guest order is not readable by a logged-in customer who did not place it.

**Done when:** the new tests pass, and each one fails when you temporarily
remove the guard it is testing. Show that both ways round.

## 5. Copy audit against `docs/storefront-copy-truth.md` — REVIEW

The design was ported from a mockup that contained claims belonging to a
different florist: "Ecuador-Rosen", "Bestellung bis 14:00 Uhr", "Lieferung am
nächsten Tag". Any of these surviving into production is a false-advertising
problem, not a styling detail.

**Do:** extract every German user-facing string in the project — pages,
components, email templates, metadata, error messages. Compare each against
`docs/storefront-copy-truth.md` and the real policy:

- two delivery runs, 10–12 and 16–18
- 3-hour cutoff before a run, Tuesday 24 hours
- 27 postcodes, delivery by her own van
- no claim about flower origin, freshness guarantee, or next-day delivery
  unless it is in the truth doc

Output a table: string, file, verdict, proposed replacement. Change nothing
until the replacements are approved.

Check Swiss orthography while you are in there: **ß never appears**, it is
always `ss`.

## 6. Invoice correctness on the confirmation email — REVIEW

Per `docs/vat-rates.md`, the order confirmation is the customer's MWST
invoice. It must carry: seller name and address, the MWST number, customer
details, delivery date, itemised supply, price, and **VAT split by rate**.

A bouquet plus a vase is 2.6% and 8.1%. It must render as two lines, not one
blended figure.

**Do:** read the email template and the figures it is handed. Confirm the split
is per rate and comes from stored order values, never recomputed from live
product data. Extend the `email-templates` test with a mixed-rate order and
assert both rate lines appear with the right amounts.

**Done when:** the test proves the two-line split, and the Impressum fields in
the email footer match `docs/vat-rates.md` exactly.

## 7. Legal page field check

The Impressum must carry the exact registered name — `Magenta Blumen - Kishta`,
with the hyphen, not the shop-sign name — the registered address, and the
MWST number as it appears on the Handelsregister extract.

**Do:** check what the page currently renders against those values. Report
mismatches. If a value is absent from the repo, use a placeholder of the form
`[TODO: UID from Handelsregister extract]` and flag it rather than typing a
number from anywhere else.

## 8. Datenschutzerklärung — processor list — REVIEW

Under revFADP the declaration has to name every processor and say where data
is processed. The current page is missing some of this.

**Do:** draft German text naming: Hetzner Online GmbH (server, Nuremberg,
Germany), Cloudflare R2 (images), Stripe (payments), Resend (email), Sentry
(error monitoring, Frankfurt). State plainly that data is processed in
Germany, not Switzerland.

This is a draft for human review. Say so in the output. Do not present it as
legally checked.

## 9. AGB clauses — REVIEW

Four clauses have to exist and currently may not:

- **Substitution** — seasonal availability, the delivered arrangement may
  differ from the photograph.
- **Nobody home** — the three options, and that choosing "leave at the door"
  moves the risk of theft to the buyer.
- **Cancellation and refund** — what can be cancelled and by when, given that
  flowers are perishable and cut to order.
- **Delivery areas and minimum order values.**

Draft each in German, marked as a draft for review.

## 10. Customer anonymisation path

`customer.anonymised_at` exists in the schema. There is no documented way to
use it.

**Do:** implement a server-side function that nulls the personal fields on a
customer — name, email, phone, addresses — sets `anonymised_at`, and leaves
every order row intact, because orders are kept ten years for tax. Add the
procedure to `docs/schema.md` or a short section in the datenschutz docs.

Orders are never hard-deleted (`CLAUDE.md` rule 10). Anonymisation must not
break any order's snapshot values.

**Done when:** a test shows the customer's personal fields are gone and the
order totals, line items and delivery data are unchanged.

## 11. Cookie audit

The cart and session cookies are strictly necessary, so no consent banner is
required. That holds only if nothing analytics-shaped has crept in.

**Do:** list every cookie the app sets and every third-party script the browser
loads. Confirm nothing is tracking. If something is, say so — the answer
changes the legal requirement.

## 12. Secrets must not reach the client bundle

**Do:** run a production build locally, then grep the build output for secret
prefixes and for the names of server-only environment variables. Confirm no
match. Confirm every server-only module that should carry `server-only` does.

Report the commands and their output. Do not print the value of anything you
find — say which file and which variable name, nothing more.

## 13. Webhook raw body

Stripe signature verification needs the unparsed request body.

**Do:** confirm nothing — middleware, proxy, instrumentation, a body parser —
reads or transforms the body of `/api/webhooks/stripe` before the handler.
Confirm the handler reads the raw text, not parsed JSON.

If anything sits in front of that route, say so. Signature verification
failing in production means no order is ever confirmed, and it fails silently
from the customer's point of view.

## 14. Replace `force-dynamic` on the storefront layout

The storefront layout is marked `force-dynamic`. That disables caching for
every page under it: every product page is rendered per request, the server
does far more work than it needs to, and page speed suffers, which hurts the
SEO the catalogue was made searchable for.

**Do:** remove `force-dynamic` from the layout. Use `export const revalidate =
300` on the catalogue and product pages. Keep dynamic rendering only where the
page genuinely depends on the request — cart, checkout, `/konto`, admin.

**Watch for:** availability data must not be cached. The slot calendar and the
run capacity check have to stay live, or a customer can be shown a date that
filled up five minutes ago. If any of that is rendered inside a cached page,
move it behind a dynamic boundary and say which one.

## 15. Health endpoint — ALREADY DONE, do not rebuild

`src/app/api/health/route.ts` exists and is correct: it pings the database,
returns 200 `{ ok: true, db: "ok" }` or 503, leaks nothing, and `/api/` is
already excluded in `robots.ts`.

**Do nothing here.** If asked to work on this task, say it is already
implemented and point at that file. Do not add a second health route, and do
not "improve" it by adding version or environment details to the response —
those are reconnaissance for anyone scanning the host.

## 16. Delivery horizon health check

`generate-runs` extends the bookable window nightly. If it silently stops, the
first symptom is a customer three weeks from now finding no dates — long after
the cause.

**Do:** add a check that reports the furthest bookable delivery date and
whether it is less than 30 days out. Make it callable from the admin
Einstellungen page or as an npm script. Do not wire it into systemd — that is
server-side and out of scope here.

## 17. Dev data cleanup script

`scripts/seed-dev-products.ts` exists, and the products it creates must never
appear in production.

**Do:** add a counterpart script that deletes exactly what the seed created —
`slug LIKE 'dev-%'` — and nothing else. Make it refuse to run unless an
explicit confirmation flag is passed. Print what it would delete before
deleting.

**Do not run it against anything but your local database.** Deleting the
production rows is a human step, done deliberately.

## 18. Rollback section in `docs/deploy.md`

There is a deploy procedure and no documented way back.

**Do:** write a section covering: how to identify the previously running image,
how to bring it back with Docker Compose, what to check afterwards, and what
to do about a database migration that has already applied. Describe commands;
do not run any of them.

---

## Not in this file, on purpose

These are in `docs/production-readiness.md` and belong to a human:

- Domain handover, DNS, the A record, the Stripe webhook URL
- Stripe live mode, KYC, TWINT activation, live keys
- Resend domain verification, SPF, DKIM, DMARC, the spam test
- Entering the real catalogue and its prices
- Performing and verifying one database restore
- Sentry alert rules, uptime monitor signup, disk alerts
- End-to-end dry runs with real payment methods, on real phones, on a real
  printer
- The open questions for the client and the Treuhänder

If a task in this file appears to require one of those, stop and say so
instead of working around it.
