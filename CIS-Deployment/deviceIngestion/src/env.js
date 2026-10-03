/**
 * Environment configuration for the device-ingestion service.
 *
 * Mirrors the pattern already used by notificationService (env vars supplied
 * by docker-compose, no .env parsing needed inside the container).
 */

const env = {
  // RabbitMQ — same vhost/credentials as alarm-engine and notification-service.
  // Must resolve to the exact queue alarm-engine's
  // `alarm.rabbitmq.device-data-queue` property resolves to
  // (alarmEngine/src/main/resources/application.properties), currently
  // "alarm-engine.device.data.queue". Publishing here bypasses
  // device.data.queue / the RabbitMQ shovel entirely — that path belongs to
  // Connect Engine / the device simulator, not this service.
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://ICUcharting:admin%40123@localhost:7003/ICUcharting',
  DEVICE_DATA_QUEUE: process.env.DEVICE_DATA_QUEUE || 'alarm-engine.device.data.queue',

  // HTTP admin/health API.
  HTTP_PORT: Number(process.env.HTTP_PORT || 9050),

  // TCP HL7/MLLP listener that patient monitors (or the replay/simulator
  // scripts) connect to.
  HL7_PORT: Number(process.env.HL7_PORT || 6661),

  // TCP listener for JSON-speaking devices (server/jsonServer.js) — a
  // second, independent port/protocol alongside HL7_PORT, not a
  // replacement for it. See adapters/deviceAdapter.md for why JSON devices
  // get their own server rather than protocol-sniffing on HL7_PORT.
  JSON_PORT: Number(process.env.JSON_PORT || 6662),

  // Admin-maintained IP -> bedId mapping. Never trust bed identity from the
  // HL7 message itself — see src/bedMapping/bedMap.js.
  BED_MAP_PATH: process.env.BED_MAP_PATH || require('path').join(__dirname, '..', 'config', 'bed-map.json'),

  // Shared with alarm-engine's hub.auth.jwt.secret (HUB_AUTH_JWT_SECRET) —
  // the admin API verifies the same Hub login tokens rather than trusting
  // anyone who can reach this service on the docker network. Must be set
  // to the real value in any environment where auth actually matters;
  // falling back to alarm-engine's own documented placeholder here (rather
  // than inventing a different one) so the two stay in sync by default.
  HUB_AUTH_JWT_SECRET: process.env.HUB_AUTH_JWT_SECRET
    || 'icu-connect-v2-change-this-secret-in-production-sentra-2026',

  // Phase 2 / best-effort: waveform samples are always parsed (the CD+NA
  // decoding logic is cheap and already solved), but are only published
  // anywhere downstream if explicitly enabled — there is no existing
  // RabbitMQ contract for waveform data today, so publishing one by default
  // would be inventing scope. When disabled, decoded waveforms are still
  // visible on GET /api/status for debugging.
  WAVEFORM_PUBLISH_ENABLED: /^true$/i.test(process.env.WAVEFORM_PUBLISH_ENABLED || 'false'),

  // Hospital gateways sit across a VPN from cloud RabbitMQ. Retry rather
  // than exit(1) on the first failed handshake (VPN not up yet, broker restart).
  RABBITMQ_RECONNECT_MS: Number(process.env.RABBITMQ_RECONNECT_MS || 2000),
};

module.exports = env;
