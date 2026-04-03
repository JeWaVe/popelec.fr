#!/bin/bash
# Backup script for popelec.fr
# Run via cron: 0 2 * * * /opt/popelec/scripts/backup.sh
# Also sourced by deploy.sh for pre-deploy backups

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups/popelec}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/popelec}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# ---------------------------------------------------------------------------
# Reusable: back up the Payload PostgreSQL database
# Usage: backup_postgres [label]
#   label defaults to $DATE; output goes to $BACKUP_DIR/db_<label>.sql.gz
# ---------------------------------------------------------------------------
backup_postgres() {
  local label="${1:-$DATE}"
  mkdir -p "$BACKUP_DIR"
  echo "Backing up PostgreSQL database (label=$label)..."
  docker compose -f "$COMPOSE_DIR/docker-compose.prod.yml" \
    exec -T postgres pg_dump -U payload popelec \
    | gzip > "$BACKUP_DIR/db_${label}.sql.gz"
  echo "  → $BACKUP_DIR/db_${label}.sql.gz"
}

# ---------------------------------------------------------------------------
# Full backup — called when the script is executed directly (not sourced)
# ---------------------------------------------------------------------------
full_backup() {
  mkdir -p "$BACKUP_DIR"

  # 1. PostgreSQL
  backup_postgres "$DATE"

  # 2. Media files
  echo "Backing up media..."
  docker compose -f "$COMPOSE_DIR/docker-compose.prod.yml" \
    cp app:/app/media - | gzip > "$BACKUP_DIR/media_${DATE}.tar.gz"
  echo "  → $BACKUP_DIR/media_${DATE}.tar.gz"

  # 3. Seafile MariaDB
  echo "Backing up Seafile database..."
  docker compose -f "$COMPOSE_DIR/docker-compose.prod.yml" \
    exec -T seafile-db mariadb-dump --all-databases -u root -p"${SEAFILE_MYSQL_ROOT_PASSWORD:?}" \
    | gzip > "$BACKUP_DIR/seafile_db_${DATE}.sql.gz"
  echo "  → $BACKUP_DIR/seafile_db_${DATE}.sql.gz"

  # 4. Seafile files (/shared volume)
  echo "Backing up Seafile files..."
  docker compose -f "$COMPOSE_DIR/docker-compose.prod.yml" \
    cp seafile:/shared - | gzip > "$BACKUP_DIR/seafile_files_${DATE}.tar.gz"
  echo "  → $BACKUP_DIR/seafile_files_${DATE}.tar.gz"

  # 5. Cleanup old backups
  echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
  find "$BACKUP_DIR" -name "*.gz" -mtime +"$RETENTION_DAYS" -delete

  echo "Backup completed: $DATE"
}

# Run full backup only when executed directly (not when sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  full_backup
fi
