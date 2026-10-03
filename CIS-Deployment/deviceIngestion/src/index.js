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
const { ensureBedMapFile } = require('./bedMapping/bedMap');

async function start() {
  console.log('Starting device-ingestion service...');
  console.log(`  RabbitMQ queue: ${env.DEVICE_DATA_QUEUE}`);
  console.log(`  Bed map: ${env.BED_MAP_PATH}`);
  console.log(`  Waveform publish: ${env.WAVEFORM_PUBLISH_ENABLED ? 'enabled' : 'disabled (decode-only)'}`);

  ensureBedMapFile();

  // HTTP/TCP come up even if cloud RabbitMQ / VPN is not ready yet — hospital
  // monitors can still connect; publishes wait for the broker. /health stays
  // 200 so Docker does not kill a gateway that is waiting on the VPN.
  startHttpServer();
  startTcpServer();
  startJsonServer();

  publisher.connect().catch((err) => {
    console.error('[rabbit] initial connect failed (will keep retrying):', err.message);
  });
}

start().catch((err) => {
  console.error('Failed to start device-ingestion service:', err);
  process.exit(1);
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  await publisher.close();
  process.exit(0);
}
