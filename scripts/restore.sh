#!/usr/bin/env bash
# Replaces the whole database with a backup. Usage: scripts/restore.sh backups/<file>.sql.gz
set -euo pipefail
cd "$(dirname "$0")/.."

backup="${1:-}"
if [ -z "$backup" ] || [ ! -f "$backup" ]; then
  echo "Usage: scripts/restore.sh backups/<file>.sql.gz" >&2
  exit 1
fi
gzip -t "$backup"

read -r -p "This replaces ALL current data with $backup. Type RESTORE to continue: " answer
if [ "$answer" != "RESTORE" ]; then
  echo "Cancelled; nothing was changed."
  exit 1
fi

docker compose stop backend
# Dropping first also removes tables created after the backup was taken.
{ echo 'DROP DATABASE IF EXISTS vocabflow;'; gzip -dc "$backup"; } | docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot'
docker compose start backend
echo "Restored $backup"
