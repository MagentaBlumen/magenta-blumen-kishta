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
3. `docker compose -f docker-compose.prod.yml up -d caddy` — Caddy re-issues.

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

### 2. Generate the two long secrets

```bash
# Postgres password
openssl rand -base64 32 | tr -d '=+/' | cut -c1-32
# Save the printed value to Bitwarden as: magenta-blumen prod postgres

# NextAuth session secret
openssl rand -base64 48
# Save the printed value to Bitwarden as: magenta-blumen NEXTAUTH_SECRET
```

### 3. Create `.env.production`

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Fill in the empty fields from Bitwarden:
- `DOMAIN=178-104-239-168.nip.io` (or your domain when ready)
- `POSTGRES_PASSWORD=` — the one you generated above
- `NEXTAUTH_URL=https://178-104-239-168.nip.io`
- `NEXTAUTH_SECRET=` — the one you generated above
- `SENTRY_DSN=` — from `magenta-blumen Sentry`
- `R2_ENDPOINT=`, `R2_ACCESS_KEY_ID=`, `R2_SECRET_ACCESS_KEY=` — from
  `magenta-blumen R2 backup`

**Verify no field is empty except comments:**
```bash
grep -E '^[A-Z_]+=$' .env.production
```
Should print nothing. If it lists variables, they're missing values.

### 4. Bring up the stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First run takes 3–5 minutes: builds the app image, pulls postgres and
caddy images, starts everything.

Watch it come up:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy
```

You should see caddy issue a Let's Encrypt cert within ~30 seconds of
first hitting the hostname. If not, check the caddy logs — most
common failure is DNS not yet resolving to the box.

### 5. Apply the database migration + seeds

The empty app expects a schema. Apply it once against the running
postgres container:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U magenta -d magenta_blumen -v ON_ERROR_STOP=1 \
  < drizzle/0000_init.sql

docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U magenta -d magenta_blumen -v ON_ERROR_STOP=1 \
  < drizzle/seed/01-base.sql

docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U magenta -d magenta_blumen -v ON_ERROR_STOP=1 \
  < drizzle/seed/02-delivery-zones.sql
```

**Verify seeded counts** (same as local):
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U magenta -d magenta_blumen -c "
    SELECT 'settings' AS t, count(*) FROM settings
    UNION ALL SELECT 'category', count(*) FROM category
    UNION ALL SELECT 'delivery_zone', count(*) FROM delivery_zone
    UNION ALL SELECT 'delivery_run', count(*) FROM delivery_run;
    SELECT code, rate FROM tax_rate;
  "
```
Must show: settings 9, category 30, delivery_zone 27, delivery_run ~122,
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
docker compose -f docker-compose.prod.yml up -d --build
```

If the change includes a new migration:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U magenta -d magenta_blumen -v ON_ERROR_STOP=1 \
  < drizzle/<NNNN>_<name>.sql
```

Automate this once we have GitHub Actions deploying to the box — see
Phase 2d.

---

## Recovery

### The app container won't start
```bash
docker compose -f docker-compose.prod.yml logs app | tail -100
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
docker compose -f docker-compose.prod.yml logs postgres
```
Common cause: wrong `POSTGRES_PASSWORD` in `.env.production` after a
change — the volume still has the OLD password baked in. Either revert
`.env.production` or wipe the volume (only safe if you've verified a
recent backup restore):
```bash
docker compose -f docker-compose.prod.yml down
docker volume rm magenta-blumen_postgres_data
docker compose -f docker-compose.prod.yml up -d --build
# then re-apply migration + seeds from step 5
```

### Locked out of SSH after a config change
Hetzner Cloud → server → Rescue → Reset root password → Console tab.
See session-2 notes for the details.
