#!/bin/bash
# Deploy script for popelec.fr
# Run on VPS: cd /opt/popelec && ./scripts/deploy.sh
#
# What it does:
#   1. Pre-flight checks
#   2. Backup database (before any changes)
#   3. Git pull
#   4. Build new images (app + migrate)
#   5. Run migrations
#   6. Recreate app container
#   7. Health check
#   8. Rollback on failure
#   9. Restart nginx
#
# Only the app and migrate containers are rebuilt/restarted.
# postgres, seafile, nginx, certbot are never touched during normal deploys.

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DEPLOY_DIR="/opt/popelec"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.prod.yml"
COMPOSE="docker compose -f $COMPOSE_FILE"
BACKUP_DIR="${BACKUP_DIR:-/backups/popelec}"
HEALTH_URL="http://localhost:3000"
HEALTH_TIMEOUT=60          # seconds
HEALTH_INTERVAL=3          # seconds between polls
ROLLBACK_IMAGE_TAG="popelec-previous"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { echo "==> $*"; }
error() { echo "ERROR: $*" >&2; }
abort() { error "$*"; exit 1; }

cleanup() {
  # Remove dangling images left by the build
  docker image prune -f --filter "label=com.docker.compose.project=popelec" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# 1. Pre-flight checks
# ---------------------------------------------------------------------------
info "Pre-flight checks..."

[[ "$(pwd)" == "$DEPLOY_DIR" ]] || abort "Must run from $DEPLOY_DIR (currently in $(pwd))"
[[ -f "$COMPOSE_FILE" ]]       || abort "Missing $COMPOSE_FILE"
[[ -f "$DEPLOY_DIR/.env" ]]    || abort "Missing .env file"
docker info >/dev/null 2>&1    || abort "Docker is not running"

# Ensure postgres is healthy before we touch anything
$COMPOSE ps postgres --format '{{.Health}}' | grep -qi healthy \
  || abort "postgres container is not healthy — fix it before deploying"

info "Pre-flight OK"

# ---------------------------------------------------------------------------
# 2. Pre-deploy database backup
# ---------------------------------------------------------------------------
info "Backing up database before deploy..."

export BACKUP_DIR COMPOSE_DIR="$DEPLOY_DIR"
# shellcheck source=backup.sh
source "$DEPLOY_DIR/scripts/backup.sh"

DEPLOY_LABEL="predeploy_$(date +%Y%m%d_%H%M%S)"
backup_postgres "$DEPLOY_LABEL"

info "Database backed up as db_${DEPLOY_LABEL}.sql.gz"

# ---------------------------------------------------------------------------
# 3. Git pull
# ---------------------------------------------------------------------------
info "Pulling latest code..."

git -C "$DEPLOY_DIR" fetch --all --prune
LOCAL=$(git -C "$DEPLOY_DIR" rev-parse HEAD)
REMOTE=$(git -C "$DEPLOY_DIR" rev-parse '@{u}')

if [[ "$LOCAL" == "$REMOTE" ]]; then
  info "Already up to date ($LOCAL) — continuing anyway (rebuild may pick up .env changes)"
else
  git -C "$DEPLOY_DIR" pull --ff-only \
    || abort "Git pull failed (merge conflict?). Resolve manually."
fi

NEW_COMMIT=$(git -C "$DEPLOY_DIR" rev-parse --short HEAD)
info "Now at commit $NEW_COMMIT"

# ---------------------------------------------------------------------------
# 4. Build new images
# ---------------------------------------------------------------------------
info "Tagging current app image for rollback..."

# docker compose images can hang when piped if no image exists; use docker inspect instead
APP_CONTAINER=$($COMPOSE ps -q app 2>/dev/null || true)
if [[ -n "$APP_CONTAINER" ]]; then
  CURRENT_IMAGE=$(docker inspect --format '{{.Image}}' "$APP_CONTAINER" 2>/dev/null || true)
  if [[ -n "$CURRENT_IMAGE" ]]; then
    docker tag "$CURRENT_IMAGE" "$ROLLBACK_IMAGE_TAG" 2>/dev/null || true
    info "  saved rollback image"
  fi
fi

info "Building new images (app + migrate)..."
$COMPOSE build app migrate \
  || abort "Build failed — old containers are still running, nothing changed."

# ---------------------------------------------------------------------------
# 5. Run migrations
# ---------------------------------------------------------------------------
info "Running database migrations..."
$COMPOSE run --rm --no-deps migrate \
  || abort "Migration failed. Database was backed up in step 2. Investigate and fix before retrying."

# ---------------------------------------------------------------------------
# 6. Recreate app container
# ---------------------------------------------------------------------------
info "Recreating app container..."
$COMPOSE up -d --no-deps --force-recreate app

# ---------------------------------------------------------------------------
# 7. Health check
# ---------------------------------------------------------------------------
info "Waiting for app to become healthy (up to ${HEALTH_TIMEOUT}s)..."

SECONDS=0
HEALTHY=false

while (( SECONDS < HEALTH_TIMEOUT )); do
  # Probe inside the app container to avoid nginx/firewall issues
  if $COMPOSE exec -T app wget -q -O /dev/null --timeout=5 "$HEALTH_URL" 2>/dev/null; then
    HEALTHY=true
    break
  fi
  sleep "$HEALTH_INTERVAL"
done

if [[ "$HEALTHY" == "true" ]]; then
  info "App is healthy after ${SECONDS}s"
else
  # ---------------------------------------------------------------------------
  # 8. Rollback on failure
  # ---------------------------------------------------------------------------
  error "Health check failed after ${HEALTH_TIMEOUT}s!"
  info "Rolling back to previous image..."

  if docker image inspect "$ROLLBACK_IMAGE_TAG" >/dev/null 2>&1; then
    # Get the image name compose expects and re-tag the old image
    COMPOSE_IMAGE=$($COMPOSE config --images 2>/dev/null | grep app || true)
    if [[ -n "$COMPOSE_IMAGE" ]]; then
      docker tag "$ROLLBACK_IMAGE_TAG" "$COMPOSE_IMAGE" 2>/dev/null || true
    fi
    $COMPOSE up -d --no-deps --force-recreate app
    error "Rolled back to previous image. Check logs: docker compose -f $COMPOSE_FILE logs app"
  else
    error "No rollback image available. Check logs: docker compose -f $COMPOSE_FILE logs app"
  fi
  exit 1
fi

# ---------------------------------------------------------------------------
# 9. Restart nginx
# ---------------------------------------------------------------------------
info "Restarting nginx..."
$COMPOSE restart nginx

# ---------------------------------------------------------------------------
# Cleanup rollback image
# ---------------------------------------------------------------------------
docker rmi "$ROLLBACK_IMAGE_TAG" 2>/dev/null || true

# ---------------------------------------------------------------------------
# 10. Summary
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "  Deploy complete!"
echo "  Commit:  $NEW_COMMIT"
echo "  Backup:  $BACKUP_DIR/db_${DEPLOY_LABEL}.sql.gz"
echo "========================================"
