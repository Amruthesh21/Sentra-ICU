/**
 * TCP JSON listener — the device-facing entry point for JSON-speaking
 * devices, mirroring tcpServer.js's HL7 structure exactly (bed mapping ->
 * framing -> adapter parse -> DeviceDataMessage -> RabbitMQ publish, plus
 * quarantine and shared bed-status reporting). See deviceAdapter.md for why
 * this exists as a second server on its own port rather than trying to
 * detect protocol on tcpServer.js's port: JSON-speaking devices carry no
 * shared schema the way HL7's OBX segments do, so each adapter here owns
 * its whole parse via `parseObservations`, not just field-name mapping.
 */

const net = require('net');
const env = require('../env');
const { createFramer } = require('../core/jsonFraming');
const { getAdapter } = require('../adapters/registry');
const { resolveMapping, normalizeIp } = require('../bedMapping/bedMap');
const quarantine = require('../bedMapping/quarantine');
const { buildDeviceDataMessage, extractAlerts } = require('../messages/deviceDataMessage');
const publisher = require('../rabbit/publisher');
const { recordStatus } = require('./bedStatus');

function startJsonServer() {
  const server = net.createServer((socket) => {
    const remoteIp = socket.remoteAddress;
    const mapping = resolveMapping(remoteIp);
    const bedId = mapping ? mapping.bedId : null;
    const deviceType = mapping ? mapping.deviceType : null;
    const framer = createFramer();

    if (!bedId) {
      console.warn(`[json] connection from unmapped source ${remoteIp} — quarantining, not publishing`);
    } else {
      console.log(`[json] device connected: ${remoteIp} -> bed ${bedId}`);
    }

    socket.on('data', async (chunk) => {
      const messages = framer.push(chunk);
      for (const raw of messages) {
        await handleMessage(raw, bedId, deviceType, remoteIp);
      }
    });

    socket.on('close', () => console.log(`[json] device disconnected: ${remoteIp} (bed ${bedId || 'unmapped'})`));
    socket.on('error', (err) => console.error(`[json] socket error (${remoteIp}):`, err.message));
  });

  server.listen(env.JSON_PORT, () => {
    console.log(`[json] listening on tcp://0.0.0.0:${env.JSON_PORT}`);
  });

  return server;
}

async function handleMessage(rawMessage, bedId, deviceType, remoteIp) {
  if (!bedId) {
    quarantine.record(normalizeIp(remoteIp));
    return;
  }

  // deviceType comes from this connection's bed-map entry, same as
  // tcpServer.js — see bedMapping/bedMap.js's resolveMapping. Unlike
  // tcpServer.js, there's no sensible "default" JSON adapter to fall back
  // to (the HL7 default, BplVividVueM10, has no parseObservations at all) —
  // an unmapped or misconfigured deviceType here just yields zero
  // observations, not a crash.
  const adapter = getAdapter(deviceType);
  if (!adapter.parseObservations) {
    console.error(`[json] bed ${bedId}: adapter "${adapter.deviceType}" has no parseObservations — not an HL7 adapter?`);
    return;
  }

  let parsed;
  try {
    parsed = adapter.parseObservations(rawMessage);
  } catch (err) {
    console.error(`[json] parse error for bed ${bedId}:`, err.message);
    return;
  }

  const deviceMessage = buildDeviceDataMessage(parsed, adapter, bedId);
  const alerts = extractAlerts(parsed, adapter);
  recordStatus(bedId, adapter.deviceType, alerts);

  if (deviceMessage.primaryAttributes.length || deviceMessage.secondaryAttributes.length) {
    try {
      await publisher.publishDeviceData(deviceMessage);
      console.log(
        `[json] bed ${bedId}: published ${deviceMessage.primaryAttributes.length} primary + ` +
        `${deviceMessage.secondaryAttributes.length} secondary vitals`
      );
    } catch (err) {
      console.error(`[json] publish failed for bed ${bedId} (message dropped, not retried):`, err.message);
    }
  }
}

module.exports = { startJsonServer };
