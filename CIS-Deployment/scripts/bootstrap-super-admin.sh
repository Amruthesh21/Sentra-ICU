#!/usr/bin/env bash
# Create or reset Super Admin via alarm-engine bootstrap (Java BCrypt).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SA_EMAIL="${SA_EMAIL:-monish.reddy@invensis.net}"
SA_PASSWORD="${SA_PASSWORD:-SentraDemo@2026}"

ENV_FILE=".env"
touch "$ENV_FILE"
grep -q '^SUPER_ADMIN_EMAIL=' "$ENV_FILE" && \
  sed -i "s|^SUPER_ADMIN_EMAIL=.*|SUPER_ADMIN_EMAIL=${SA_EMAIL}|" "$ENV_FILE" || \
  echo "SUPER_ADMIN_EMAIL=${SA_EMAIL}" >> "$ENV_FILE"
grep -q '^SUPER_ADMIN_PASSWORD=' "$ENV_FILE" && \
  sed -i "s|^SUPER_ADMIN_PASSWORD=.*|SUPER_ADMIN_PASSWORD=${SA_PASSWORD}|" "$ENV_FILE" || \
  echo "SUPER_ADMIN_PASSWORD=${SA_PASSWORD}" >> "$ENV_FILE"
grep -q '^HUB_AUTH_DEV_EXPOSE_OTP=' "$ENV_FILE" || \
  echo "HUB_AUTH_DEV_EXPOSE_OTP=true" >> "$ENV_FILE"

echo "Clearing existing hub users so bootstrap can seed super admin..."
docker exec CIS-postgres psql -U icu_hub -d icu_hub -c "DELETE FROM hub_users;"

echo "Restarting alarm engine to seed super admin..."
docker compose -f docker-compose.poc.yml up -d alarm-engine
sleep 25

echo ""
docker exec CIS-postgres psql -U icu_hub -d icu_hub -c \
  "SELECT email, role, user_type, active FROM hub_users;"

echo ""
echo "Login: ${SA_EMAIL} / ${SA_PASSWORD}"
echo "URL:   http://$(hostname -I | awk '{print $1}'):7040/login"
