#!/bin/bash
# Backup script for popelec.fr
# Run via cron: 0 2 * * * /path/to/backup.sh

set -euo pipefail

BACKUP_DIR="/backups/popelec"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# Database backup
echo "Backing up database..."
docker compose exec -T postgres pg_dump -U payload popelec | gzip > "$BACKUP_DIR/db_${DATE}.sql.gz"

# Media backup
echo "Backing up media..."
docker compose cp app:/app/media - | gzip > "$BACKUP_DIR/media_${DATE}.tar.gz"

# Cleanup old backups
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
