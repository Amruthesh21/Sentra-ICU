#!/usr/bin/env bash
# Run ON THE SERVER (already SSH'd in as monish). Makes Hub live with Connect Engine.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/rtwohealthcare/Connectengine-DEMO.git}"
DEPLOY_DIR="${DEPLOY_DIR:-$HOME/RTWO-version-2}"
CIS_ROOT="${CIS_ROOT:-$HOME/CIS-Deployment}"
NETWORK="alarampoc_docker_compose_network"
SUBNET="172.31.0.0/16"
ENV_BACKUP="$HOME/.rtwo-env-backup"

echo "========== RTWO server deploy =========="

# --- backup .env from current folder ---
if [[ -f "$DEPLOY_DIR/.env" ]]; then
  cp "$DEPLOY_DIR/.env" "$ENV_BACKUP"
  echo "Saved .env -> $ENV_BACKUP"
fi

# --- get latest code via git (folder was zip, not git) ---
if [[ -d "$DEPLOY_DIR/.git" ]]; then
  echo "Git pull in $DEPLOY_DIR"
  cd "$DEPLOY_DIR"
  git pull origin main
else
  echo "Cloning fresh repo to $DEPLOY_DIR"
  if [[ -d "$DEPLOY_DIR" ]]; then
    mv "$DEPLOY_DIR" "${DEPLOY_DIR}-old-$(date +%Y%m%d%H%M)"
  fi
  git clone "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

# --- restore .env or create default ---
if [[ -f "$ENV_BACKUP" ]]; then
  cp "$ENV_BACKUP" .env
else
  cat > .env <<'EOF'
SUPER_ADMIN_EMAIL=monish.reddy@invensis.net
SUPER_ADMIN_PASSWORD=Rtwo@2026
HUB_AUTH_DEV_EXPOSE_OTP=true
HUB_AUTH_ENFORCED=false
CONNECT_ENGINE_URL=http://CIS-Deployment-connect-engine:9010
DOCKER_COMPOSE_SUBNET=172.31.0.0/16
EOF
fi

# --- docker network ---
sudo docker network inspect "$NETWORK" >/dev/null 2>&1 || \
  sudo docker network create --subnet="$SUBNET" "$NETWORK"

# --- infra ---
echo "Starting infra..."
sudo docker compose -f docker-compose.infra.yml up -d
sleep 25

# --- Connect Engine (required for vitals + center name) ---
if [[ -d "$CIS_ROOT" && -f "$CIS_ROOT/docker-compose.yml" ]]; then
  echo "Starting Connect Engine from $CIS_ROOT ..."
  cd "$CIS_ROOT"
  sudo docker compose -p alarampoc -f docker-compose.yml up -d \
    connectengine visualizationengine icuconnectdevicesimulatorbed1 nginx critixperticubackendengine || \
  sudo docker compose -f docker-compose.yml up -d connectengine nginx
  sleep 25
else
  echo "WARNING: $CIS_ROOT not found — vitals will not work until Connect Engine is started."
fi

# --- hub apps (rebuild with new code) ---
cd "$DEPLOY_DIR"
echo "Building Hub + Alarm Engine..."
sudo docker compose -f docker-compose.poc.yml up -d --build alarm-engine icu-connect-hub notification-service icu-watch-pwa
sleep 45

# --- ensure super admin ---
if ! sudo docker exec CIS-postgres psql -U icu_hub -d icu_hub -tAc \
  "SELECT 1 FROM hub_users WHERE role='SUPER_ADMIN' LIMIT 1" | grep -q 1; then
  echo "Seeding super admin..."
  sudo docker exec CIS-postgres psql -U icu_hub -d icu_hub -c "DELETE FROM hub_users;"
  sudo docker compose -f docker-compose.poc.yml up -d --force-recreate alarm-engine
  sleep 40
fi

# --- sync center from Connect Engine ---
echo ""
echo "=== VERIFY ==="
sudo docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E 'CIS-|connect' || true
echo ""
curl -s -o /dev/null -w "Hub: %{http_code}\n" http://127.0.0.1:7040/ || true
curl -s -o /dev/null -w "API: %{http_code}\n" http://127.0.0.1:7020/api/center || true
curl -s http://127.0.0.1:7012/retrieve 2>/dev/null | head -c 120 || echo "Connect Engine: NOT RUNNING on 7012"
echo ""
curl -s -X POST http://127.0.0.1:7020/api/center/sync-metadata || true
echo ""
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "========== DONE =========="
echo "Login: http://${IP}:7040/login"
echo "  monish.reddy@invensis.net / Rtwo@2026  MFA: 123456"
echo ""
echo "Then: Administration -> create ICU units + beds -> admit patients"
