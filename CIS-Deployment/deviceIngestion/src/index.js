/**
 * SentraICU device-ingestion service.
 * Drop-in replacement for Connect Engine's device-vitals ingestion path —
 * see docs/MIGRATION-NOTE.md for exactly what this replaces and what it
 * doesn't. Listens for HL7 v2 and JSON from bedside monitors/ventilators,
 * parses via a per-device adapter, and publishes straight to alarm-engine's
 * existing RabbitMQ queue.
 */

const env = require('./env');
const publisher = require('./rabbit/publisher');
const { startTcpServer } = require('./server/tcpServer');
const { startJsonServer } = require('./server/jsonServer');
const { startHttpServer } = require('./server/httpServer');

async function start() {
  console.log('Starting device-ingestion service...');
  console.log(`  RabbitMQ queue: ${env.DEVICE_DATA_QUEUE}`);
  console.log(`  Bed map: ${env.BED_MAP_PATH}`);
  console.log(`  Waveform publish: ${env.WAVEFORM_PUBLISH_ENABLED ? 'enabled' : 'disabled (decode-only)'}`);

  // Connect eagerly so a misconfigured RabbitMQ fails fast at boot rather
  // than silently on the first device message.
  await publisher.connect();

  startHttpServer();
  startTcpServer();
  startJsonServer();
}

start().catch((err) => {
  console.error('Failed to start device-ingestion service:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await publisher.close();
  process.exit(0);
});
