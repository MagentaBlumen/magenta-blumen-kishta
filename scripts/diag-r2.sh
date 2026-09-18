#!/usr/bin/env bash
# Diagnostic: show what env systemd would see, then attempt an rclone
# operation in a clean environment (empty PATH except /usr/bin:/bin).
#
# Safe to paste output. Never prints raw secret values - only lengths
# and safe metadata.

set -u

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "=== .env.production R2 lines (lengths only) ==="
awk -F= '/^R2/ { key=$1; $1=""; sub(/^=/, "", $0); printf "%-25s len=%d\n", key, length($0) }' \
  .env.production

echo
echo "=== Values via clean-env source ==="
env -i bash -c '
cd /opt/magenta-blumen
set -a
source .env.production
set +a
printf "endpoint=[%s]\n" "$R2_ENDPOINT"
printf "bucket=[%s]\n"   "$R2_BUCKET"
printf "kid_len=%d\n"    "${#R2_ACCESS_KEY_ID}"
printf "sec_len=%d\n"    "${#R2_SECRET_ACCESS_KEY}"
'

echo
echo "=== Clean-env rclone READ (lsf) test ==="
env -i PATH=/usr/local/bin:/usr/bin:/bin bash -c '
cd /opt/magenta-blumen
set -a
source .env.production
set +a
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
export RCLONE_CONFIG_R2_REGION=auto
rclone lsf r2:magenta-blumen-backups/ 2>&1 | head -20
echo "--- read exit=$?"
'

echo
echo "=== Clean-env rclone WRITE (copyto) test ==="
env -i PATH=/usr/local/bin:/usr/bin:/bin bash -c '
cd /opt/magenta-blumen
set -a
source .env.production
set +a
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
export RCLONE_CONFIG_R2_REGION=auto
echo "diag-r2 write test at $(date -u +%FT%TZ)" > /tmp/diag-write-test.txt
rclone copyto /tmp/diag-write-test.txt r2:magenta-blumen-backups/diag-write-test.txt 2>&1 | head -20
echo "--- write exit=$?"
rm -f /tmp/diag-write-test.txt
rclone delete r2:magenta-blumen-backups/diag-write-test.txt 2>&1 | tail -3
'
