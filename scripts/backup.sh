#!/usr/bin/env bash
# Writes a compressed database dump to backups/. Run from anywhere while the app is up.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p backups
target="backups/vocabflow-$(date +%Y%m%d-%H%M%S).sql.gz"
partial="$target.partial"
trap 'rm -f "$partial"' EXIT

docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --no-tablespaces --databases vocabflow' \
  | gzip > "$partial"

# An interrupted dump has no completion marker, so it must never pass for a backup.
gzip -dc "$partial" | tail -n 1 | grep -q 'Dump completed' || {
  echo "Backup is incomplete; nothing was saved." >&2
  exit 1
}

mv "$partial" "$target"
echo "Saved $target"
