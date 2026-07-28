#!/usr/bin/env bash
# Full server startup: Hub POC + CIS Connect Engine (same as local start-all-poc.ps1).
#
# Usage:
#   export CIS_ROOT=~/CIS-Deployment   # path to CIS stack with connectengine
#   sudo CIS-Deployment/scripts/start-full-server.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CIS_ROOT="${CIS_ROOT:-$HOME/CIS-Deployment}"
NETWORK="alarampoc_docker_compose_network"
SUBNET="${DOCKER_COMPOSE_SUBNET:-172.31.0.0/16}"
HOST_IP="$(hostname -I | awk '{print $1}')"

echo "========================================"
echo " RTWO Full Stack (Hub + Connect Engine)"
echo "========================================"

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "[1/5] Creating network $NETWORK ($SUBNET)..."
  docker network create --subnet="$SUBNET" "$NETWORK"
else
  echo "[1/5] Network $NETWORK exists"
fi

cd "$ROOT"
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — set SUPER_ADMIN_PASSWORD if needed."
fi

echo "[2/5] Starting infra (MongoDB, RabbitMQ, Postgres)..."
docker compose -f docker-compose.infra.yml up -d
sleep 20

if [[ -d "$CIS_ROOT" && -f "$CIS_ROOT/docker-compose.yml" ]]; then
  echo "[3/5] Starting CIS Connect Engine from $CIS_ROOT ..."
  (
    cd "$CIS_ROOT"
    docker compose -p alarampoc -f docker-compose.yml up -d \
      critixperticubackendengine connectengine visualizationengine \
      icuconnectdevicesimulatorbed1 nginx 2>/dev/null \
      || docker compose -f docker-compose.yml up -d connectengine nginx
  )
  sleep 25
else
  echo "[3/5] SKIP — CIS_ROOT not found ($CIS_ROOT)"
  echo "      Vitals will NOT flow without Connect Engine on $NETWORK"
  echo "      Set CIS_ROOT and re-run, or start connectengine manually."
fi

echo "[4/5] Starting Hub (alarm-engine, icu-connect-hub)..."
docker compose -f docker-compose.poc.yml up -d --build alarm-engine notification-service icu-watch-pwa icu-connect-hub
sleep 30

echo "[5/5] Health checks..."
check() {
  local name="$1" port="$2"
  if curl -sf -o /dev/null "http://127.0.0.1:$port/" 2>/dev/null \
     || curl -sf -o /dev/null "http://127.0.0.1:$port/api/center" 2>/dev/null; then
    echo "  OK  $name (port $port)"
  else
    echo "  --  $name (port $port) not responding"
  fi
}
check "MongoDB" 7000
check "Alarm API" 7020
check "Hub UI" 7040
check "Connect Engine" 7012

echo ""
echo "Sync center name from Connect Engine:"
curl -sf -X POST "http://127.0.0.1:7020/api/center/sync-metadata" 2>/dev/null | head -c 200 || echo "(alarm-engine not ready yet)"
echo ""
echo ""
echo "========================================"
echo " URLs"
echo "========================================"
echo "  Hub login:        http://${HOST_IP}:7040/login"
echo "  Connect Engine:   http://${HOST_IP}:7012"
echo "  Visualization:    http://${HOST_IP}:7013"
echo ""
echo "========================================"
echo " Setup (match local)"
echo "========================================"
echo "  1. Admin → confirm green 'Connect Engine center' banner (RTWO · JPN)"
echo "  2. Create units INSIDE that center (not new centers):"
echo "       ICU 1 + Block A, ICU 2 + Block B, ICU 3 + Block C"
echo "  3. Add beds per unit — use device IPs from Connect Engine (7012)"
echo "  4. Patient Management → admit patients"
echo "  5. Unit Dashboard → pick unit → vitals refresh every 3s"
echo ""
