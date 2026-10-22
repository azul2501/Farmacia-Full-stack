#!/bin/sh
# Respaldo diario de PostgreSQL. Cron sugerido (crontab -e):
#   0 3 * * * /opt/farmacia/deploy/backup-db.sh >> /var/log/farmacia-backup.log 2>&1
# Restaurar:  gunzip -c archivo.sql.gz | docker compose -f compose.prod.yml exec -T db psql -U boticas_user -d boticas
set -eu

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"
. ./.env

FILE="$BACKUP_DIR/boticas-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose -f compose.prod.yml exec -T db \
  pg_dump -U "${POSTGRES_USER:-boticas_user}" -d "${POSTGRES_DB:-boticas}" --no-owner | gzip > "$FILE"

find "$BACKUP_DIR" -name 'boticas-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) respaldo creado: $FILE"
