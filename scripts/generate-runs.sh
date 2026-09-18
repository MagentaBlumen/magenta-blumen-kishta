#!/usr/bin/env bash
# ---------------------------------------------------------------------
# Nightly: extend the delivery-run horizon and health-check it.
#
# Two responsibilities:
#   1. Insert missing delivery_run rows out to run_generation_days.
#   2. Fail loudly if the bookable horizon has fallen below 30 days.
#
# The health check is the point of running this nightly rather than
# assuming the seed did it. A silently failing generator is invisible
# until the storefront starts returning empty slot pickers three weeks
# later.
#
# Runs as `deploy` via systemd (generate-runs.service / .timer).
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
MIN_HORIZON_DAYS=30

DB_EXEC() {
  docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=1 "$@"
}

echo "[$(date -u +%FT%TZ)] generate-runs start"

# Copy the SQL in so we don't depend on -f resolving a host path.
docker cp "$SCRIPT_DIR/generate-runs.sql" "$CONTAINER:/tmp/generate-runs.sql"

BEFORE=$(DB_EXEC -tAc "SELECT count(*) FROM delivery_run WHERE run_date >= CURRENT_DATE;")
DB_EXEC -f /tmp/generate-runs.sql >/dev/null
AFTER=$(DB_EXEC -tAc "SELECT count(*) FROM delivery_run WHERE run_date >= CURRENT_DATE;")
INSERTED=$(( AFTER - BEFORE ))

# Horizon = days from today to the furthest scheduled run.
HORIZON=$(DB_EXEC -tAc "
  SELECT COALESCE(MAX(run_date) - CURRENT_DATE, 0)
  FROM delivery_run
  WHERE run_date >= CURRENT_DATE;
")

echo "[$(date -u +%FT%TZ)] inserted ${INSERTED} new runs, horizon = ${HORIZON} days"

docker exec "$CONTAINER" rm -f /tmp/generate-runs.sql

if (( HORIZON < MIN_HORIZON_DAYS )); then
  echo "FATAL: bookable horizon is ${HORIZON} days, below ${MIN_HORIZON_DAYS} threshold" >&2
  echo "  Check settings.run_generation_days, weekly_schedule, and blackout_date" >&2
  exit 3
fi

echo "[$(date -u +%FT%TZ)] generate-runs done"
