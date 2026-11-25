# Deploy — first bring-up on Hetzner

The step-by-step commands for getting a fresh Hetzner box from an empty
Ubuntu install to a running Next.js app behind TLS. Replayable — every
command is idempotent unless flagged.

**Prerequisites, all set in Session 2:**
- Ubuntu 26.04 on Hetzner (`magenta-blumen-prod`, 178.104.239.168)
- Non-root `deploy` user with SSH-key-only access
- Docker CE + compose plugin installed, `deploy` in the `docker` group
- ufw allowing 22 / 80 / 443
- Hetzner firewall in front, same rules
- Cloudflare R2 bucket + credentials (in Bitwarden)
- Sentry DSN (in Bitwarden)

If any of the above is not true, see the session-2 hardening notes first.

---

## Staging vs production hostname

Until the client hands over `magenta-blumen.ch`, we use a `nip.io` hostname
that resolves to the box IP:

```
178-104-239-168.nip.io  ->  178.104.239.168
```

Caddy issues a real Let's Encrypt cert for that hostname. When the domain
handover happens, the cutover is:
1. Point `magenta-blumen.ch` A/AAAA at 178.104.239.168 in DNS.
2. Change `DOMAIN=` in `/opt/magenta-blumen/.env.production` on the server.
3. `docker compose --env-file .env.production -f docker-compose.prod.yml up -d caddy`
   — Caddy re-issues.

**Do not cut over until the client's MX records are preserved** — see the
domain-handover memory. Flipping the A record kills `info@magenta-blumen.ch`
if the old firm's mail server still holds the MX.

---

## First bring-up

All commands run as `deploy` on the server, from `/opt/magenta-blumen`.

### 1. Clone the repo

```bash
sudo mkdir -p /opt/magenta-blumen
sudo chown deploy:deploy /opt/magenta-blumen
cd /opt/magenta-blumen
git clone https://github.com/MagentaBlumen/magenta-blumen-kishta.git .
```

### 2. Generate the secrets

```bash
# Postgres password
openssl rand -base64 32 | tr -d '=+/' | cut -c1-32
# Save the printed value to Bitwarden as: magenta-blumen prod postgres

# Auth.js session-signing secret
openssl rand -base64 48
# Save the printed value to Bitwarden as: magenta-blumen AUTH_SECRET
```

### 2b. Generate the admin password hash

Pick an admin password (something long; Sandra + owner share it).
Save the **plain password** to Bitwarden as `magenta-blumen admin
login`. Then, on your LOCAL machine (not the server), run:

```bash
npx tsx scripts/hash-password.ts 'the chosen password'
```

Copy the printed hash. It's what goes into `ADMIN_PASSWORD_HASH` on
the server. The raw password never touches git or the server.

**IMPORTANT - Docker Compose $ escape:** Before pasting the hash into
`.env.production`, replace every `$` with `$$`. Compose interpolates
`$VAR` in env_file values by default; if you paste the raw hash
`$2b$12$...` it becomes empty inside the container and login fails
with a generic "E-Mail oder Passwort ist falsch". Compose collapses
`$$` back to a single `$` at inject time, so the app sees the correct
hash at runtime. Verify with `docker exec magenta-blumen-app printenv
ADMIN_PASSWORD_HASH | wc -c` - should print `61` (60 chars + newline).

### 3. Create `.env.production`

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Fill in the empty fields from Bitwarden:
- `DOMAIN=178-104-239-168.nip.io` (or your domain when ready)
- `POSTGRES_PASSWORD=` — the one you generated above
- `AUTH_URL=https://178-104-239-168.nip.io`
- `AUTH_SECRET=` — the one you generated above
- `ADMIN_EMAIL=` — the shared admin login email (e.g. `admin@magenta-blumen.ch`)
- `ADMIN_PASSWORD_HASH=` — the bcrypt hash from step 2b (starts with `$2b$12$`)
- `SENTRY_DSN=` — from `magenta-blumen Sentry`
- `R2_ENDPOINT=`, `R2_ACCESS_KEY_ID=`, `R2_SECRET_ACCESS_KEY=` — from
  `magenta-blumen R2 backup`

**Verify no field is empty except comments:**
```bash
grep -E '^[A-Z_]+=$' .env.production
```
Should print nothing. If it lists variables, they're missing values.

### 4. Bring up the stack

Set two shell shortcuts so subsequent commands stay short (avoids
Windows PowerShell / SSH paste-wrap issues):

```bash
DC="docker compose --env-file .env.production -f docker-compose.prod.yml"
MB=magenta-blumen-postgres
```

**`--env-file .env.production` is critical.** Without it, `docker compose`
reads only `.env` for `${VAR}` interpolation, and every reference to
`${POSTGRES_USER}` etc. in the compose YAML resolves to an empty string.
Postgres then refuses to start.

Bring the stack up:

```bash
$DC up -d --build
```

First run takes 3–5 minutes: builds the app image, pulls postgres and
caddy images, starts everything.

Watch it come up:

```bash
$DC ps
$DC logs -f caddy
```

Caddy should issue a Let's Encrypt cert within ~30 seconds of the first
external hit. If not, check its logs — most common failure is DNS not
yet resolving to this box.

### 5. Apply the database migration + seeds

The empty app expects a schema. Apply it once against the running
postgres container. We `docker cp` the files into the container first,
then `psql -f` them — this avoids the long-line paste problem that
`< file` redirects hit in the SSH terminal.

```bash
DB="docker exec $MB psql -U magenta -d magenta_blumen -v ON_ERROR_STOP=1"

docker cp drizzle/0000_init.sql $MB:/tmp/init.sql
docker cp drizzle/seed/01-base.sql $MB:/tmp/01.sql
docker cp drizzle/seed/02-delivery-zones.sql $MB:/tmp/02.sql

$DB -f /tmp/init.sql
$DB -f /tmp/01.sql
$DB -f /tmp/02.sql
```

**Verify seeded counts:**

```bash
$DB -c "SELECT 'settings' t, count(*) FROM settings UNION ALL SELECT 'category', count(*) FROM category UNION ALL SELECT 'delivery_zone', count(*) FROM delivery_zone UNION ALL SELECT 'delivery_run', count(*) FROM delivery_run;"

$DB -c "SELECT code, rate FROM tax_rate;"
```

Must show: settings 9, category 30, delivery_zone 27, delivery_run 122,
tax_rate rows with 0.0260 / 0.0810.

### 6. Visit the site

```
https://178-104-239-168.nip.io
```

You should see the Next.js starter page (that's what's in `src/app/page.tsx`
today — this is the "empty app" milestone, on purpose). No 502, no cert
warning. Browser padlock should say the cert is valid, issued by Let's
Encrypt, for exactly the hostname you typed.

---

## Everyday deploys, after the first

Once the stack is up, subsequent deploys are:

```bash
cd /opt/magenta-blumen
git pull
DC="docker compose --env-file .env.production -f docker-compose.prod.yml"
$DC up -d --build
```

If the change includes a new migration:

```bash
MB=magenta-blumen-postgres
docker cp drizzle/<NNNN>_<name>.sql $MB:/tmp/mig.sql
docker exec $MB psql -U magenta -d magenta_blumen -v ON_ERROR_STOP=1 -f /tmp/mig.sql
```

Automate this once we have GitHub Actions deploying to the box — see
Phase 2d.

---

## Recovery

Assumes `DC="docker compose --env-file .env.production -f docker-compose.prod.yml"`
is set in the current shell (from Step 4).

### The app container won't start
```bash
$DC logs app | tail -100
```

### Caddy can't get a cert
Usually DNS. Confirm the hostname resolves to this box:
```bash
dig +short 178-104-239-168.nip.io
```
Should return the server's IP. If not, wait for propagation (nip.io is
usually instant) or check the domain provider.

### Postgres won't come healthy
```bash
$DC logs postgres
```
Common cause: wrong `POSTGRES_PASSWORD` in `.env.production` after a
change — the volume still has the OLD password baked in. Either revert
`.env.production` or wipe the volume (only safe if you've verified a
recent backup restore):
```bash
$DC down
docker volume rm magenta-blumen_postgres_data
$DC up -d --build
# then re-apply migration + seeds from step 5
```

### "The POSTGRES_USER variable is not set" warnings on `up`
You forgot `--env-file .env.production`. Docker Compose only reads
`.env` by default; our secrets live in `.env.production`. Rebuild the
shortcut variable and try again.

### Locked out of SSH after a config change
Hetzner Cloud → server → Rescue → Reset root password → Console tab.
See session-2 notes for the details.

---

## Rollback

Reverse of an everyday deploy. Use when a `$DC up -d --build` left the
site broken or wedged, and the fastest way out is "put yesterday back".

Rollback is an app rollback, not a data rollback. Customer orders
placed since the bad deploy stay in the database. If the bad deploy
also applied a destructive migration, read the "Migration rollback"
section below before touching anything.

Assumes the usual shell shortcuts from the first bring-up:

```bash
DC="docker compose --env-file .env.production -f docker-compose.prod.yml"
MB=magenta-blumen-postgres
```

### 1. Identify the previously running image

Each `up -d --build` creates a new image. Older tags are still on the
box until `docker image prune` runs. Find them:

```bash
docker image ls magenta-blumen-kishta-app --format \
  'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}\t{{.Size}}'
```

The current image (whatever `$DC ps` shows for `app`) is at the top.
The one directly beneath, with the previous `CreatedAt`, is the
rollback target. Note its 12-character image ID.

If no older image is listed, the rollback target is the one tagged
with `<none>`:

```bash
docker image ls --filter dangling=true \
  --format 'table {{.ID}}\t{{.CreatedAt}}\t{{.Size}}'
```

Dangling images still boot — they just lost their tag when the
newer build replaced them. Pick the most recent one from before the
bad deploy.

### 2. Confirm which git commit that image was built from

Every image has the commit SHA baked into its labels (via the
Dockerfile's `ARG GIT_COMMIT`). Read it back:

```bash
docker image inspect <image-id> \
  --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'
```

If the label is empty (older images predate the label addition), fall
back to `docker image inspect --format '{{.Created}} {{.Id}}'` and
match the timestamp against `git log --format='%h %ci'`. Write the
SHA down — you'll want it in the post-mortem and for `git checkout`
if a full redeploy becomes necessary.

### 3. Bring the previous image back

Retag the rollback image so Compose picks it up on the next `up`:

```bash
docker tag <rollback-image-id> magenta-blumen-kishta-app:latest
```

Then start the app service against the retagged image. Do **not**
pass `--build` — that would rebuild from the current working tree,
which is exactly what you're trying to avoid:

```bash
$DC up -d --no-build app
```

`postgres` and `caddy` stay where they are. The rollback is app-only;
touching Postgres risks losing in-flight orders, and Caddy's TLS
state does not need to move.

If the compose file pins an image tag (not `build: .`), skip the
`docker tag` step and set the tag directly in `.env.production` or
on the command line:

```bash
APP_IMAGE_TAG=<image-id> $DC up -d --no-build app
```

### 4. Verify the rollback took

```bash
$DC ps app
$DC logs --tail=50 app
curl -fsS https://<DOMAIN>/api/health
```

- `$DC ps app` should show `running`, `Up <N> seconds`.
- `/api/health` returns `{"ok":true,"db":"ok"}` with HTTP 200.
- Place a test cart action (add → `/warenkorb`) if the bad deploy
  touched checkout, or hit a known category page if the regression
  was in the catalogue.
- Watch Sentry for one full minute. A fresh error in the first
  seconds after the swap means rollback didn't stick — the new
  image somehow still has the broken code.

### 5. Clean up when stable

Once the box has run on the rolled-back image for 15 minutes without
alarms:

- Tag the bad image so it isn't reused by accident:
  ```bash
  docker tag <bad-image-id> magenta-blumen-kishta-app:broken-$(date +%Y%m%d)
  ```
- Revert the git commit on `main` (or roll forward with a fix) so the
  next deploy doesn't resurrect the same binary.

### Migration rollback

The database never rolls back automatically. If the bad deploy
applied `drizzle/<NNNN>_<name>.sql`, the new columns and indexes are
now in prod even after the app image reverts.

Decide which case you're in before touching the DB:

1. **The migration is forward-compatible.** Older code ignores new
   columns / tables; the rolled-back app keeps running against the
   newer schema. This is the default for additive migrations
   (`ADD COLUMN ... DEFAULT ...`, `CREATE INDEX`, `CREATE TABLE`).
   **Do nothing.** Leave the schema ahead; roll the app forward to
   use it when the fix lands.

2. **The migration dropped or renamed something the old code reads.**
   The rolled-back app will fail with "column does not exist" on
   first query. There is no clean automated undo:
   - Grab a backup from before the migration applied — most recent
     nightly dump in R2 (`docs/backups.md` has the restore recipe).
   - Replay it against a scratch database, not prod.
   - Hand-write the reverse DDL by reading the forward migration
     file (`drizzle/<NNNN>_<name>.sql`). For an `ADD COLUMN`, that's
     `ALTER TABLE x DROP COLUMN y`; for a rename, swap the sides.
     Review it against the scratch DB first.
   - Apply the reverse SQL on prod with the same `docker cp` + `psql
     -f` pattern as a forward migration. Wrap it in `BEGIN; ...
     COMMIT;` so a partial failure is atomic.
   - Verify order totals haven't moved: `SELECT sum(total_gross)
     FROM "order" WHERE status <> 'cancelled';` before and after.

3. **The migration ran but the data path never used the new column.**
   Common for schema hooks that land before the feature that uses
   them (`giftcard_applied_gross` etc., rule 11). Treat as case 1
   — leave the schema ahead, no action needed.

Never run `drizzle-kit drop` or `drizzle-kit reset` against prod.
They are reasonable in local dev; in prod they are destructive.

### If both the app AND the data went bad

That is a backup-restore scenario, not a rollback. Stop here and
follow `docs/backups.md` — restore procedure, scratch-DB verification,
then swap into prod. Keep Stripe webhooks and the current
`.env.production` out of the restore flow; those are not business
data.
