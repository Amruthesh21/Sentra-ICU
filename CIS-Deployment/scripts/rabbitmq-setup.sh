#!/bin/sh
# Runs inside the CIS-rabbitmq-setup container (curlimages/curl, Alpine ash).
# Creates the alarm-engine.device.data.queue and the device.data.queue -> it
# shovel, so anything published to the legacy queue still reaches alarm-engine.
#
# Credentials come in as real env vars (set in docker-compose.yml/poc.yml from
# INFRA_RABBITMQ_USER / INFRA_RABBITMQ_PASSWORD / INFRA_RABBITMQ_PASSWORD_URLENC)
# rather than being hardcoded here, so this is a plain shell script with normal
# quoting - no multi-layer YAML/compose escaping to reason about.
set -eu

: "${RABBITMQ_SETUP_USER:?RABBITMQ_SETUP_USER not set}"
: "${RABBITMQ_SETUP_PASS:?RABBITMQ_SETUP_PASS not set}"
: "${RABBITMQ_SETUP_PASS_URLENC:?RABBITMQ_SETUP_PASS_URLENC not set}"

MGMT_URL="http://host.docker.internal:7004"
AMQP_HOST="host.docker.internal:7003"

echo "Waiting 25 seconds for RabbitMQ to be ready..."
sleep 25

echo "Creating destination queue..."
curl -s -f -u "${RABBITMQ_SETUP_USER}:${RABBITMQ_SETUP_PASS}" \
  -X PUT "${MGMT_URL}/api/queues/ICUcharting/alarm-engine.device.data.queue" \
  -H "Content-Type: application/json" \
  -d '{"durable":true,"auto_delete":false,"arguments":{}}'

echo "Creating shovel..."
SHOVEL_URI="amqp://${RABBITMQ_SETUP_USER}:${RABBITMQ_SETUP_PASS_URLENC}@${AMQP_HOST}/ICUcharting"
SHOVEL_BODY='{"value":{"src-protocol":"amqp091","src-uri":"'"${SHOVEL_URI}"'","src-queue":"device.data.queue","dest-protocol":"amqp091","dest-uri":"'"${SHOVEL_URI}"'","dest-queue":"alarm-engine.device.data.queue","ack-mode":"on-publish","src-prefetch-count":1000,"reconnect-delay":5}}'

if curl -s -f -u "${RABBITMQ_SETUP_USER}:${RABBITMQ_SETUP_PASS}" \
  -X PUT "${MGMT_URL}/api/parameters/shovel/ICUcharting/device-to-alarm-engine" \
  -H "Content-Type: application/json" \
  -d "${SHOVEL_BODY}"; then
  echo "RabbitMQ shovel setup complete."
else
  echo "Shovel plugin may not be enabled. Trying exchange binding fallback..."
  curl -s -u "${RABBITMQ_SETUP_USER}:${RABBITMQ_SETUP_PASS}" \
    -X POST "${MGMT_URL}/api/bindings/ICUcharting/e/amq.fanout/q/alarm-engine.device.data.queue" \
    -H "Content-Type: application/json" \
    -d '{"routing_key":""}'
  echo "Fallback binding done."
fi
