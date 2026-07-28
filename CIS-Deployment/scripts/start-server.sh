#!/usr/bin/env bash
# Start full RTWO stack on Linux server (infra + apps). Safe to re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

NETWORK="alarampoc_docker_compose_network"
SUBNET="${DOCKER_COMPOSE_SUBNET:-172.31.0.0/16}"

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "Creating docker network $NETWORK ($SUBNET)..."
  docker network create --subnet="$SUBNET" "$NETWORK"
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example — set SUPER_ADMIN_PASSWORD before first boot."
fi

echo "Starting infra (MongoDB, RabbitMQ, Postgres)..."
docker compose -f docker-compose.infra.yml up -d

echo "Waiting for Postgres..."
for i in $(seq 1 30); do
  if docker exec CIS-postgres pg_isready -U icu_hub -d icu_hub >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Starting apps (Hub, Alarm Engine, ...)..."
# Do NOT use --remove-orphans here — it stops Mongo/Rabbit from infra compose.
docker compose -f docker-compose.poc.yml up -d --build

echo ""
echo "Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E '^(NAMES|CIS-)'

echo ""
echo "Hub:  http://$(hostname -I | awk '{print $1}'):7040/login"
echo "API:  http://$(hostname -I | awk '{print $1}'):7020/api/center"
