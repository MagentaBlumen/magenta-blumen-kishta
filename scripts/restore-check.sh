#!/usr/bin/env bash
# ---------------------------------------------------------------------
# Weekly verified restore. Proves the last backup is actually usable.
#
# 1. Fetch most recent dump from R2.
# 2. Create scratch database inside the running postgres container.
# 3. pg_restore into it.
# 4. Run count queries. Compare against known baseline.
# 5. Drop scratch database. Delete downloaded file.
#
# Fails loudly on any step. `journalctl -u restore-check.service`
# on the box shows the outcome; check weekly.
#
# The scratch DB is throwaway - no impact on the live one.
# ---------------------------------------------------------------------

set -euo pipefail

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

export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
export RCLONE_CONFIG_R2_REGION=auto

CONTAINER="magenta-blumen-postgres"
SCRATCH_DB="magenta_blumen_restore_check"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "[$(date -u +%FT%TZ)] restore-check start"

# ---- Find and download the latest backup ----------------------------
# rclone lsf sorted lexicographically; our timestamp filenames sort
# chronologically, so `tail -n 1` = newest.
LATEST=$(rclone lsf "r2:${R2_BUCKET}/postgres/" | sort | tail -n 1)
if [[ -z "$LATEST" ]]; then
  echo "FATAL: no backups found in r2:${R2_BUCKET}/postgres/" >&2
  exit 2
fi
echo "[$(date -u +%FT%TZ)] latest = $LATEST"

rclone copyto "r2:${R2_BUCKET}/postgres/${LATEST}" "$WORK_DIR/latest.dump"

# ---- Load into scratch DB inside the postgres container -------------
# Drop any leftover from a previous failed run, then recreate cleanly.
docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};" >/dev/null
docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d postgres \
  -c "CREATE DATABASE ${SCRATCH_DB};" >/dev/null

docker cp "$WORK_DIR/latest.dump" "${CONTAINER}:/tmp/restore-check.dump"

# --clean + --if-exists would rebuild the schema even inside a fresh DB,
# but the DB IS fresh here, so a plain restore is enough.
docker exec "$CONTAINER" \
  pg_restore -U "$POSTGRES_USER" -d "$SCRATCH_DB" --no-owner --no-privileges \
  /tmp/restore-check.dump >/dev/null

# ---- Verify baseline counts -----------------------------------------
# Any real change (owner adds products, orders come in) inflates the
# order/product counts, so we only assert the SEED tables that we
# control.
check_count () {
  local table="$1" expected="$2"
  local actual
  actual=$(docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d "$SCRATCH_DB" \
    -tAc "SELECT count(*) FROM ${table};")
  if [[ "$actual" != "$expected" ]]; then
    echo "FATAL: ${table} count = ${actual}, expected ${expected}" >&2
    return 1
  fi
  echo "  OK  ${table} = ${actual}"
}

echo "[$(date -u +%FT%TZ)] verifying seed table counts"
check_count settings          9
check_count weekly_schedule   7
check_count category         30
check_count attribute_value   9
check_count delivery_zone    27
check_count delivery_zone_plz 27

# Tax rates must be present (0.0260 / 0.0810), not NULL.
NULL_RATES=$(docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d "$SCRATCH_DB" \
  -tAc "SELECT count(*) FROM tax_rate WHERE rate IS NULL;")
if [[ "$NULL_RATES" != "0" ]]; then
  echo "FATAL: tax_rate has ${NULL_RATES} NULL rows - VAT seed did not run" >&2
  exit 3
fi
echo "  OK  tax_rate has no NULL rates"

# ---- Cleanup --------------------------------------------------------
docker exec "$CONTAINER" rm -f /tmp/restore-check.dump
docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d postgres \
  -c "DROP DATABASE ${SCRATCH_DB};" >/dev/null

echo "[$(date -u +%FT%TZ)] restore-check PASSED (backup ${LATEST} is usable)"
