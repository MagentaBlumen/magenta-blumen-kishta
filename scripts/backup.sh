#!/usr/bin/env bash
# ---------------------------------------------------------------------
# Nightly Postgres backup -> Cloudflare R2.
#
# Runs as the `deploy` user via systemd (backup.service / backup.timer).
# Reads secrets from /opt/magenta-blumen/.env.production.
#
# Format: pg_dump -Fc (custom, compressed, restorable with pg_restore).
# Streams straight from pg_dump into rclone rcat - no on-disk temp file,
# so a compromised host has nothing to steal at rest.
#
# Retention: 180 days. Older objects deleted at the end of each run.
# See docs/backups.md for the setup story.
# ---------------------------------------------------------------------

set -euo pipefail

# Resolve project root so we can source .env.production regardless of cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ ! -f "$PROJECT_DIR/.env.production" ]]; then
  echo "FATAL: $PROJECT_DIR/.env.production not found" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source "$PROJECT_DIR/.env.production"
set +a

# ---- rclone via env vars (no rclone.conf required) ------------------
# The remote is called "r2" in every rclone invocation below.
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
export RCLONE_CONFIG_R2_REGION=auto

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OBJECT="postgres/magenta-blumen-${TIMESTAMP}.dump"
CONTAINER="magenta-blumen-postgres"
RETENTION_DAYS=180

echo "[$(date -u +%FT%TZ)] backup start -> r2:${R2_BUCKET}/${OBJECT}"

# Dump straight from postgres inside the running container, pipe through
# rclone to R2. If either side fails, `set -o pipefail` propagates it.
docker exec -i "$CONTAINER" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-privileges \
  | rclone rcat "r2:${R2_BUCKET}/${OBJECT}"

# Sanity check: object exists and is > 1 KiB (an empty dump would be tiny).
SIZE=$(rclone size --json "r2:${R2_BUCKET}/${OBJECT}" | grep -oP '"bytes":\s*\K[0-9]+')
if [[ -z "$SIZE" || "$SIZE" -lt 1024 ]]; then
  echo "FATAL: uploaded object is $SIZE bytes - suspiciously small" >&2
  rclone delete "r2:${R2_BUCKET}/${OBJECT}"
  exit 2
fi

echo "[$(date -u +%FT%TZ)] uploaded ${SIZE} bytes"

# ---- Retention: delete backups older than RETENTION_DAYS ------------
# rclone --min-age operates on file mtime, which for R2 objects is
# their upload time.
echo "[$(date -u +%FT%TZ)] pruning objects older than ${RETENTION_DAYS}d"
rclone delete --min-age "${RETENTION_DAYS}d" "r2:${R2_BUCKET}/postgres/"

echo "[$(date -u +%FT%TZ)] backup done"
