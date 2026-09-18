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
