# Launch runbook — every command, in order

From 25 November to launch. Work down this file. Nothing here is optional
except where it says so.

## Three places commands run

| Prefix | Where | Shell |
|---|---|---|
| `PS>` | your laptop, in the repo | PowerShell |
| `srv$` | the Hetzner box, as `deploy` | bash |
| `CC>` | paste into Claude Code | — |

Dashboard work (Stripe, Resend, DNS, Sentry) has no commands. It is marked
**[browser]** and it blocks the steps after it.

---

## 0. Clear the working tree — do this first

Fourteen modified files and a half-finished refactor are sitting in the tree.
Everything below is harder until this is resolved.

```
PS> cd C:\Users\flutu\magenta-blumen-kishta
PS> git status
PS> git stash list
```

Have Claude Code tell you what the refactor was doing:

```
CC> Read docs/launch-tasks.md. Do task 1 only, then stop.
```

Then, once you know which way to go — finish it:

```
PS> npm run lint
PS> npm run typecheck
PS> npm test
PS> git add -A
PS> git commit -m "Admin: finish status chip + Heute refactor"
```

or bin it:

```
PS> git stash push -u -m "half-done admin status refactor"
```

`git stash push -u` keeps the untracked `status-chip.tsx` too. Plain
`git stash` would leave it behind and you would be debugging a file that
belongs to work you thought you had put away.

Do **not** use `git reset --hard` or `git clean -fd`. There is no undo.

---

## 1. The gate — run these four after every task

This block is the whole quality system. Run it before every commit. If any of
it fails, fix it before starting the next task, not later.

```
PS> npm run lint
PS> npm run typecheck
PS> npm test
PS> npm run build
```

`npm run build` is in there because `typecheck` does not catch everything the
production build does — bad imports in server components, `server-only`
violations, and anything that only breaks when Next actually compiles routes.

Then:

```
PS> git add -A
PS> git commit -m "<what changed>"
```

One commit per task. A commit covering four tasks is a commit you cannot
revert when one of them turns out to be wrong.

---

## 2. Code tasks, in order

One task per turn. Gate and commit between each. The order is deliberate —
security first, because it is the part that cannot be fixed after a customer's
address leaks.

```
CC> Read docs/launch-tasks.md. Do task 2 only, then stop.
CC> Read docs/launch-tasks.md. Do task 3 only, then stop.
CC> Read docs/launch-tasks.md. Do task 4 only, then stop.
CC> Read docs/launch-tasks.md. Do task 5 only, then stop.
CC> Read docs/launch-tasks.md. Do task 6 only, then stop.
CC> Read docs/launch-tasks.md. Do task 14 only, then stop.
CC> Read docs/launch-tasks.md. Do task 13 only, then stop.
CC> Read docs/launch-tasks.md. Do tasks 7 and 11 only, then stop.
CC> Read docs/launch-tasks.md. Do task 16 only, then stop.
CC> Read docs/launch-tasks.md. Do task 17 only, then stop.
CC> Read docs/launch-tasks.md. Do task 18 only, then stop.
```

**Skip task 15** — `src/app/api/health/route.ts` already exists and already
does the right thing. Verify it instead:

```
PS> npm run dev
```
then in a browser: `http://localhost:3000/api/health` → `{"ok":true,"db":"ok"}`

Tasks 8, 9 and 10 (Datenschutz processors, AGB clauses, anonymisation) can
wait until after the deploy if the week gets tight. Tasks 2–6 cannot.

After task 4, prove the new tests actually test something:

```
CC> Temporarily remove the guard that test X covers, show me the test failing, then put the guard back and show it passing.
```

A test that passes because it never reached the guard is worse than no test,
because it buys confidence you have not earned.

---

## 3. Secret scan — before the first push

Task 12 in the tasks file, but run it yourself; it takes one command.

```
PS> npm run build
PS> Get-ChildItem -Recurse .next\static -Include *.js | Select-String -Pattern 'sk_live|sk_test|rk_live|whsec_|AUTH_SECRET|POSTGRES_PASSWORD|R2_SECRET'
```

`.next\static` is what the browser downloads. **Zero matches expected.** A hit
there means a secret is in the client bundle and must be rotated, not just
moved.

---

## 4. Push

```
PS> git log --oneline -10
PS> git push origin main
```

Read the log first. You are pushing to a repo that deploys to production.

---

## 5. Migration 0001 — check this before you deploy

There are two migrations in `drizzle/`:

```
0000_init.sql
0001_premium_doctor_octopus.sql    <- adds three columns to "order"
```

`docs/deploy.md` only documents applying `0000`. If `0001` was never applied
on the server, the new code will query columns that do not exist and every
affected page will 500 — after the deploy, not during it.

On the server, check:

```
srv$ ssh deploy@178.104.239.168
srv$ cd /opt/magenta-blumen
srv$ MB=magenta-blumen-postgres
srv$ docker exec $MB psql -U magenta -d magenta_blumen -c "\d \"order\"" | grep buyer_notified
```

- **Three rows printed** → already applied, skip to step 6.
- **Nothing printed** → apply it:

```
srv$ git pull
srv$ docker cp drizzle/0001_premium_doctor_octopus.sql $MB:/tmp/mig.sql
srv$ docker exec $MB psql -U magenta -d magenta_blumen -v ON_ERROR_STOP=1 -f /tmp/mig.sql
srv$ docker exec $MB psql -U magenta -d magenta_blumen -c "\d \"order\"" | grep buyer_notified
```

Apply the migration **before** bringing up the new app image. Schema first,
then code. The other order gives you a window where the app is live and
broken.

---

## 6. Deploy

```
srv$ cd /opt/magenta-blumen
srv$ git pull
srv$ DC="docker compose --env-file .env.production -f docker-compose.prod.yml"
srv$ $DC up -d --build
srv$ $DC ps
srv$ $DC logs -f app
```

`--env-file .env.production` is not optional. Without it Compose reads only
`.env`, every `${VAR}` resolves empty, and Postgres refuses to start.

Confirm it is actually up:

```
srv$ curl -s localhost:3000/api/health
```

Expect `{"ok":true,"db":"ok"}`.

---

## 7. Verify the server

```
srv$ systemctl list-timers --all | grep -E 'reap|generate-runs|backup|restore-check'
```

All four present, each with a `NEXT` time. A timer with no next run is not
scheduled.

```
srv$ journalctl -u reap-abandoned-orders.service -n 30 --no-pager
srv$ journalctl -u generate-runs.service -n 30 --no-pager
srv$ journalctl -u backup.service -n 50 --no-pager
```

Bookable horizon — this is the one that fails silently:

```
srv$ docker exec $MB psql -U magenta -d magenta_blumen -c "SELECT max(run_date) AS furthest, max(run_date) - CURRENT_DATE AS days_out FROM delivery_run;"
```

`days_out` under 30 means the generator has stopped and nobody has noticed.

Dev data still in the database:

```
srv$ docker exec $MB psql -U magenta -d magenta_blumen -c "SELECT count(*) FROM product WHERE slug LIKE 'dev-%';"
```

If greater than zero, remove it — **only once the real catalogue is in**, so
you are not left with an empty shop:

```
srv$ docker exec $MB psql -U magenta -d magenta_blumen -v ON_ERROR_STOP=1 -c "DELETE FROM product WHERE slug LIKE 'dev-%';"
```

Disk, before Christmas week rather than during it:

```
srv$ df -h /
srv$ docker system df
```

---

## 8. Backup and the restore drill

An untested backup is a rumour. `restore-check.sh` already restores into a
scratch database and verifies seed counts, so the drill is one command:

```
srv$ sudo systemctl start restore-check.service
srv$ journalctl -u restore-check.service -n 60 --no-pager
```

Read the output properly. It must say the restore succeeded and the counts
matched. The script drops the scratch database when it finishes.

To look at real restored data with your own eyes — do this once:

```
srv$ set -a; source /opt/magenta-blumen/.env.production; set +a
srv$ rclone ls "r2:${R2_BUCKET}/postgres/" | tail -5
srv$ rclone copy "r2:${R2_BUCKET}/postgres/<newest-file>.dump" /tmp/
srv$ docker cp /tmp/<newest-file>.dump $MB:/tmp/check.dump
srv$ docker exec $MB psql -U magenta -d postgres -c "CREATE DATABASE restore_eyeball;"
srv$ docker exec $MB pg_restore -U magenta -d restore_eyeball --no-owner --no-privileges /tmp/check.dump
srv$ docker exec $MB psql -U magenta -d restore_eyeball -c "SELECT order_number, delivery_date, total_gross FROM \"order\" ORDER BY id DESC LIMIT 5;"
srv$ docker exec $MB psql -U magenta -d postgres -c "DROP DATABASE restore_eyeball;"
srv$ rm /tmp/<newest-file>.dump
```

`set -a; source` puts the R2 credentials into the shell so `rclone` works.
They are already on that box in that file — this is not a new exposure — but
close the terminal when you are done rather than leaving a shell with
credentials loaded.

How long the restore took is worth writing into `docs/backups.md`. On the day
you need it, you will want to know whether you are waiting two minutes or
forty.

---

## 9. Domain cutover — **[browser] first**

**Do not run any of this until you have the answer about MX records.**
Pointing the A record at Hetzner while the old firm still holds the mail
server kills `info@magenta-blumen.ch` the moment DNS propagates.

Before touching anything, save your rollback:

**[browser]** screenshot the complete DNS zone at the registrar. Every record.
That screenshot is how you put it back.

Then, in order:

1. **[browser]** A and AAAA for `magenta-blumen.ch` → `178.104.239.168`. Leave
   MX untouched.
2. On the server:

```
srv$ nano /opt/magenta-blumen/.env.production
```
Change `DOMAIN=` and `AUTH_URL=` and `NEXT_PUBLIC_SITE_URL=` to the real
hostname. `NEXT_PUBLIC_SITE_URL` matters: `robots.ts` and the sitemap fall
back to the nip.io host, and Google will index whatever it is given.

```
srv$ grep -E '^[A-Z_]+=$' .env.production
```
Prints nothing = no field left empty.

```
srv$ $DC up -d --force-recreate app caddy
srv$ $DC logs -f caddy
```

Caddy issues a Let's Encrypt cert within about 30 seconds of the first
external hit.

3. Check it from outside:

```
PS> nslookup magenta-blumen.ch
PS> curl -I https://magenta-blumen.ch
PS> curl -s https://magenta-blumen.ch/api/health
```

4. **Mail still works** — send a test message to `info@magenta-blumen.ch` from
   a different address and confirm it arrives. Do this immediately, not
   tomorrow.

```
PS> nslookup -type=mx magenta-blumen.ch
```

5. **[browser]** Stripe dashboard → update the webhook endpoint URL. The old
   endpoint keeps firing at nip.io until you change it, and the new hostname
   receives nothing.

---

## 10. Stripe live mode — **[browser]**

No commands. In order, because each depends on the last:

1. KYC complete — UID, IBAN, ID document. Takes days; check it now.
2. TWINT activated on the live account. Separate from cards.
3. Statement descriptor `MAGENTA BLUMEN`.
4. Copy live keys and the **live webhook signing secret** into
   `.env.production`. The live `whsec_` is different from the test one. Using
   the test secret means every webhook fails signature verification, no order
   is ever confirmed, and nothing in the UI tells you.

```
srv$ nano /opt/magenta-blumen/.env.production
srv$ $DC up -d --force-recreate app
srv$ $DC logs app | tail -50
```

Then one real card payment, start to finish, and refund it:

```
srv$ docker exec $MB psql -U magenta -d magenta_blumen -c "SELECT order_number, status, total_gross FROM \"order\" ORDER BY id DESC LIMIT 3;"
srv$ docker exec $MB psql -U magenta -d magenta_blumen -c "SELECT stripe_event_id, type, processed_at FROM stripe_event ORDER BY id DESC LIMIT 5;"
```

A row in `stripe_event` with a `processed_at` is the proof the webhook arrived
and verified. Without that, the payment succeeded and your system does not
know.

---

## 11. Email — **[browser]**

1. Resend: verify the domain. Add the SPF and DKIM records at the registrar.
2. Publish a DMARC record. `p=none` is fine to start.
3. `from` on her domain, not `onboarding@resend.dev`.
4. Reply-to a mailbox she reads.

```
PS> nslookup -type=txt magenta-blumen.ch
PS> nslookup -type=txt resend._domainkey.magenta-blumen.ch
```

Then send a real order confirmation to a Gmail, an Outlook and a GMX address
and check the spam folder in each. Three providers, because they disagree.

---

## 12. Launch day

```
srv$ $DC ps
srv$ curl -s https://magenta-blumen.ch/api/health
srv$ systemctl list-timers --all | grep -E 'reap|generate-runs|backup'
srv$ docker exec $MB psql -U magenta -d magenta_blumen -c "SELECT key, value FROM settings WHERE key LIKE '%cap%';"
```

Daily cap at **5**. Phone ordering continues exactly as before — the site
supplements it, it does not replace it.

Watch for the first few orders:

```
srv$ $DC logs -f app
```

**[browser]** Sentry open, Stripe dashboard open.

---

## 13. When something breaks

```
srv$ $DC logs app | tail -100
srv$ $DC logs caddy | tail -50
srv$ $DC logs postgres | tail -50
srv$ $DC ps
srv$ docker exec $MB psql -U magenta -d magenta_blumen -c "SELECT 1;"
```

Roll back to the previous image:

```
srv$ cd /opt/magenta-blumen
srv$ git log --oneline -5
srv$ git checkout <previous-good-sha>
srv$ $DC up -d --build
```

A migration that has already applied does **not** roll back with the code. If
the bad deploy included one, you are restoring from backup, not checking out
a commit. That is the reason step 8 exists.

---

## Housekeeping

`.claude/scheduled_tasks.lock` shows as untracked. `.gitignore` already covers
`.claude/*.local.json`, so your settings are safe, but the lock file is not.
Add one line to `.gitignore`:

```
.claude/scheduled_tasks.lock
```

Worth doing so `git status` is quiet. A noisy `git status` is how a real change
gets missed during a launch week.
