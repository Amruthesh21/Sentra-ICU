/**
 * TCP HL7/MLLP listener — the device-facing entry point.
 * Wires together: bed mapping -> framing -> core parser -> device adapter
 * -> DeviceDataMessage -> RabbitMQ publish, plus quarantine and waveform
 * side-channels. This is the only place those pieces are connected; each of
 * them stays independently testable.
 */

const net = require('net');
const env = require('../env');
const { createFramer } = require('../core/mllpFraming');
const { parseHl7Message } = require('../core/hl7Parser');
const { getAdapter } = require('../adapters/registry');
const { resolveBedId, normalizeIp } = require('../bedMapping/bedMap');
const quarantine = require('../bedMapping/quarantine');
const { buildDeviceDataMessage, extractAlerts } = require('../messages/deviceDataMessage');
const publisher = require('../rabbit/publisher');
const waveformBuffer = require('../waveform/waveformBuffer');

/** @type {Map<string, {bedId: string, deviceType: string, lastMessageAt: string, messageCount: number, lastAlerts: object[]}>} */
const bedStatus = new Map();

function recordStatus(bedId, deviceType, alerts) {
  const now = new Date().toISOString();
  const existing = bedStatus.get(bedId);
  bedStatus.set(bedId, {
    bedId,
    deviceType,
    lastMessageAt: now,
    messageCount: (existing?.messageCount || 0) + 1,
    lastAlerts: alerts,
  });
}

function getBedStatus() {
  return Array.from(bedStatus.values());
}

function startTcpServer() {
  const server = net.createServer((socket) => {
    const remoteIp = socket.remoteAddress;
    const bedId = resolveBedId(remoteIp);
    const framer = createFramer();

    if (!bedId) {
      console.warn(`[hl7] connection from unmapped source ${remoteIp} — quarantining, not publishing`);
    } else {
      console.log(`[hl7] device connected: ${remoteIp} -> bed ${bedId}`);
    }

    socket.on('data', async (chunk) => {
      const messages = framer.push(chunk);
      for (const raw of messages) {
        await handleMessage(raw, bedId, remoteIp);
      }
    });

    socket.on('close', () => console.log(`[hl7] device disconnected: ${remoteIp} (bed ${bedId || 'unmapped'})`));
    socket.on('error', (err) => console.error(`[hl7] socket error (${remoteIp}):`, err.message));
  });

  server.listen(env.HL7_PORT, () => {
    console.log(`[hl7] listening on tcp://0.0.0.0:${env.HL7_PORT}`);
  });

  return server;
}

async function handleMessage(rawMessage, bedId, remoteIp) {
  if (!bedId) {
    quarantine.record(normalizeIp(remoteIp));
    return;
  }

  // deviceType is fixed to the single configured adapter for now — see
  // adapters/registry.js for how to extend this per-connection if needed.
  const adapter = getAdapter();

  let parsed;
  try {
    parsed = parseHl7Message(rawMessage, { decodeWaveformMeta: adapter.decodeWaveformMeta });
  } catch (err) {
    console.error(`[hl7] parse error for bed ${bedId}:`, err.message);
    return;
  }

  const deviceMessage = buildDeviceDataMessage(parsed, adapter, bedId);
  const alerts = extractAlerts(parsed, adapter);
  recordStatus(bedId, adapter.deviceType, alerts);

  if (deviceMessage.primaryAttributes.length || deviceMessage.secondaryAttributes.length) {
    try {
      await publisher.publishDeviceData(deviceMessage);
      console.log(
        `[hl7] bed ${bedId}: published ${deviceMessage.primaryAttributes.length} primary + ` +
        `${deviceMessage.secondaryAttributes.length} secondary vitals`
      );
    } catch (err) {
      console.error(`[hl7] publish failed for bed ${bedId} (message dropped, not retried):`, err.message);
    }
  }

  if (Object.keys(parsed.waveforms).length) {
    await waveformBuffer.record(bedId, parsed.waveforms);
  }
}

module.exports = { startTcpServer, getBedStatus };
