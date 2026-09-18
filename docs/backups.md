# Backups — how they work, how to set them up, how to restore

Two scheduled jobs run on the Hetzner box:

| When              | What                             | Systemd unit          |
|-------------------|----------------------------------|-----------------------|
| Nightly 03:30 UTC | `pg_dump` → Cloudflare R2        | `backup.service`      |
| Sunday 04:00 UTC  | Download latest, restore, verify | `restore-check.service` |

**Retention: 180 days on R2.** Older objects are pruned at the end of
each nightly run. The florist DB is tiny (a few MB per dump), so 180
days of history fits comfortably inside R2's free tier (10 GB, no egress).

Both jobs run as the `deploy` user. Credentials come from
`/opt/magenta-blumen/.env.production` — the same file the app uses. No
duplicate secrets to maintain.

Backups format: `pg_dump -Fc` (custom, compressed, restorable with
`pg_restore`). Object key: `postgres/magenta-blumen-YYYYMMDDTHHMMSSZ.dump`.

---

## First-time setup on the server

Only needed once. Assumes the deploy user + `/opt/magenta-blumen` exist
(Session 2 hardening) and `.env.production` is populated (see
`docs/deploy.md`, step 3).

### 1. Install rclone

```bash
sudo apt update
sudo apt install -y rclone
rclone version
```

The script uses rclone via environment variables — **no `rclone.conf`
setup required**. `RCLONE_CONFIG_R2_*` in the script defines the remote
inline for each invocation.

### 2. Install the systemd units

The units live in `deploy/systemd/` in the repo. Symlink them into
place so `git pull` updates them without re-copying:

```bash
sudo ln -sf /opt/magenta-blumen/deploy/systemd/backup.service        /etc/systemd/system/
sudo ln -sf /opt/magenta-blumen/deploy/systemd/backup.timer          /etc/systemd/system/
sudo ln -sf /opt/magenta-blumen/deploy/systemd/restore-check.service /etc/systemd/system/
sudo ln -sf /opt/magenta-blumen/deploy/systemd/restore-check.timer   /etc/systemd/system/

sudo systemctl daemon-reload
```

### 3. Test-run the backup manually

Before enabling the timer, prove the script works end to end:

```bash
sudo systemctl start backup.service
journalctl -u backup.service -n 50
```

Expected tail:
```
[…] backup done
```
If it fails: read the journal, fix the .env / rclone / postgres config,
try again. Nothing enables the timer until this passes.

### 4. Test-run the restore-check

Once at least one backup exists on R2:

```bash
sudo systemctl start restore-check.service
journalctl -u restore-check.service -n 50
```

Expected tail:
```
[…] restore-check PASSED (backup magenta-blumen-… is usable)
```

### 5. Enable both timers

Only after steps 3 and 4 both passed:

```bash
sudo systemctl enable --now backup.timer
sudo systemctl enable --now restore-check.timer
systemctl list-timers | grep -E 'backup|restore-check'
```

Last command should show both timers with a `NEXT` fire time in the
near future.

---

## Everyday operation

### Check the timers are healthy

```bash
systemctl list-timers | grep -E 'backup|restore-check'
```

If either `NEXT` is in the past or missing, the timer is broken —
investigate with `systemctl status <unit>.timer`.

### See the last run's output

```bash
journalctl -u backup.service -n 100 --no-pager
journalctl -u restore-check.service -n 100 --no-pager
```

### List what's on R2

Backup script exports the rclone env vars only for its own process, so
one-off queries need them too. Cheapest way from the project dir:

```bash
cd /opt/magenta-blumen
set -a; source .env.production; set +a
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
       RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
       RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
       RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT" \
       RCLONE_CONFIG_R2_REGION=auto
rclone lsl r2:magenta-blumen-backups/postgres/ | tail -20
```

Should show one file per day, sorted by upload time, ~a few MB each.

---

## Restoring for real (i.e. it's the day)

**Assumption:** the production DB is unusable and needs to be replaced
with the contents of a specific backup. This is destructive — do it
deliberately.

```bash
cd /opt/magenta-blumen
set -a; source .env.production; set +a
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
       RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
       RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
       RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT" \
       RCLONE_CONFIG_R2_REGION=auto

# 1. Pick a backup. List and choose.
rclone lsl r2:magenta-blumen-backups/postgres/
BACKUP="magenta-blumen-20261231T033000Z.dump"   # <-- edit

# 2. Stop the app so nothing is writing while we swap the DB.
DC="docker compose --env-file .env.production -f docker-compose.prod.yml"
$DC stop app

# 3. Download.
rclone copyto "r2:magenta-blumen-backups/postgres/${BACKUP}" /tmp/${BACKUP}
docker cp /tmp/${BACKUP} magenta-blumen-postgres:/tmp/restore.dump

# 4. Drop and recreate the DB. LOSES CURRENT DATA - be sure.
MB=magenta-blumen-postgres
docker exec $MB psql -U magenta -d postgres -c "DROP DATABASE magenta_blumen;"
docker exec $MB psql -U magenta -d postgres -c "CREATE DATABASE magenta_blumen;"

# 5. Restore.
docker exec $MB pg_restore -U magenta -d magenta_blumen \
  --no-owner --no-privileges /tmp/restore.dump

# 6. Verify counts look sane.
docker exec $MB psql -U magenta -d magenta_blumen \
  -c "SELECT 'settings' t, count(*) FROM settings
      UNION ALL SELECT 'category', count(*) FROM category
      UNION ALL SELECT 'delivery_zone', count(*) FROM delivery_zone;"

# 7. Bring the app back up.
$DC start app

# 8. Clean up.
docker exec $MB rm /tmp/restore.dump
rm /tmp/${BACKUP}
```

---

## Why 03:30 UTC and Sunday 04:00 UTC

- **03:30 UTC:** the earliest quiet window that is safely AFTER the
  `unattended-upgrades` auto-reboot window (03:00 UTC). If a kernel
  update lands, the box reboots at 03:00, comes back within ~90
  seconds, and the backup fires clean.
- **Sunday 04:00 UTC:** always 30 min after Sunday's fresh backup, so
  restore-check verifies a dump that is at most a few hours old rather
  than a week.

Both are also outside her business hours (shop opens 09:00 Swiss).

---

## What is NOT backed up here

- **The Hetzner disk itself.** That's covered by the weekly Hetzner
  snapshot (enabled at server creation, ~+20% cost). Snapshot handles
  "the box is gone"; pg_dump handles "the DB got corrupted / dropped
  by mistake".
- **Cloudflare R2 storage** (product photos, once they exist). Those
  live in a separate bucket with versioning enabled — separate concern,
  separate doc when we get there.
- **`.env.production`** and other secrets. Kept in your password
  manager (Bitwarden), not on R2. Losing the server means restoring
  the DB dump into a fresh box + re-populating `.env.production` from
  Bitwarden.
- **Sentry data**, log history, etc. Not our problem to back up.

---

## Known limits / TODO

- **Failure notification** is currently just journalctl. Set up Sentry
  Cron Monitors when Phase 2c wires nightly jobs — same monitor
  pattern applies here.
- **No off-region redundancy.** R2 is Cloudflare's multi-region
  network internally, but if Cloudflare loses your account we lose
  the archive. Acceptable for a florist. Revisit if the shop scales.
- **The scripts assume the postgres container is running.** If it is
  not, `docker exec` fails immediately and the backup is skipped for
  the night. That is the right behaviour (nothing to back up) but
  worth knowing.
