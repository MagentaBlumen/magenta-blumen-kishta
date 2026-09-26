#!/usr/bin/env bash
# ---------------------------------------------------------------------
# Every 5 min: cancel abandoned checkouts (status='new', unpaid, older
# than settings.abandoned_order_minutes).
#
# The SQL body lives in reap-abandoned-orders.sql - identical to how
# generate-runs.sh sources its .sql. Wrapper is thin on purpose so the
# UPDATE clause is auditable in one place.
#
# Runs as `deploy` via systemd (reap-abandoned-orders.service / .timer).
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

CONTAINER="magenta-blumen-postgres"

DB_EXEC() {
  docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=1 "$@"
}

echo "[$(date -u +%FT%TZ)] reap start"

# Copy the SQL in so we don't depend on -f resolving a host path.
docker cp "$SCRIPT_DIR/reap-abandoned-orders.sql" "$CONTAINER:/tmp/reap-abandoned-orders.sql"

# BEFORE/AFTER counts of 'new' orders older than the threshold. Gives
# a clean log line even when the update touches nothing (the healthy
# case in Phase 1).
BEFORE=$(DB_EXEC -tAc "
  SELECT count(*) FROM \"order\" o
  WHERE o.status = 'new'
    AND o.placed_at < now() - (
      SELECT COALESCE(NULLIF(value, '')::int, 30)
        FROM settings WHERE key = 'abandoned_order_minutes'
    ) * interval '1 minute'
    AND NOT EXISTS (
      SELECT 1 FROM payment p
       WHERE p.order_id = o.id
         AND (p.status = 'succeeded' OR p.method IN ('cash','invoice'))
    );
")

DB_EXEC -f /tmp/reap-abandoned-orders.sql >/dev/null

docker exec "$CONTAINER" rm -f /tmp/reap-abandoned-orders.sql

echo "[$(date -u +%FT%TZ)] reap done, cancelled ${BEFORE} abandoned order(s)"
