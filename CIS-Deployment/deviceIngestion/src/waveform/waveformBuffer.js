/**
 * Waveform handling — Phase 2 / best-effort, per the task's explicit
 * priority order (vitals + alerts first). The decode work itself is cheap
 * and already solved in core/hl7Parser.js (standard HL7 NA+CD datatypes), so
 * it always runs. What's genuinely Phase 2 is *distribution*: alarm-engine's
 * RabbitMQ contract (DeviceDataMessage) has no waveform field and nothing
 * downstream consumes waveform samples today, so this module does NOT push
 * onto alarm-engine's queue.
 *
 * Always available: an in-memory "latest samples per bed/channel" buffer,
 * exposed on GET /api/status for debugging/visual verification.
 * Optionally available (WAVEFORM_PUBLISH_ENABLED=true): the same samples are
 * also published to a dedicated fanout exchange, `device-ingestion.waveform`,
 * so a future consumer can pick them up without any change to alarm-engine's
 * existing queue/contract.
 */

const env = require('../env');

const MAX_SAMPLES_PER_CHANNEL = 500; // ~a few seconds of trace, plenty for a debug view

/** @type {Map<string, Record<string, {unit: string, sampleRate: number|null, samples: number[]}>>} */
const latestByBed = new Map();

let publishChannel = null;
const WAVEFORM_EXCHANGE = 'device-ingestion.waveform';

async function ensurePublishChannel() {
  if (!env.WAVEFORM_PUBLISH_ENABLED) return null;
  if (publishChannel) return publishChannel;
  const { connect } = require('../rabbit/publisher');
  const baseChannel = await connect();
  await baseChannel.assertExchange(WAVEFORM_EXCHANGE, 'fanout', { durable: false });
  publishChannel = baseChannel;
  return publishChannel;
}

/**
 * @param {string} bedId
 * @param {Record<string, {unit: string, sampleRate: number|null, samples: number[]}>} waveforms
 */
async function record(bedId, waveforms) {
  if (!waveforms || Object.keys(waveforms).length === 0) return;

  const bucket = latestByBed.get(bedId) || {};
  for (const [channel, wf] of Object.entries(waveforms)) {
    const trimmed = wf.samples.slice(-MAX_SAMPLES_PER_CHANNEL);
    bucket[channel] = { unit: wf.unit, sampleRate: wf.sampleRate, samples: trimmed };
  }
  latestByBed.set(bedId, bucket);

  if (!env.WAVEFORM_PUBLISH_ENABLED) return;
  try {
    const ch = await ensurePublishChannel();
    if (!ch) return;
    const payload = Buffer.from(JSON.stringify({ bedId, timestamp: new Date().toISOString(), waveforms }));
    ch.publish(WAVEFORM_EXCHANGE, '', payload, { contentType: 'application/json' });
  } catch (err) {
    console.error('[waveform] publish failed (non-fatal, vitals path unaffected):', err.message);
  }
}

function getLatest(bedId) {
  return latestByBed.get(bedId) || {};
}

function getAllLatest() {
  return Object.fromEntries(latestByBed.entries());
}

/**
 * Same lookup as getLatest, but tolerant of the "ICU-1-" prefix
 * inconsistency between what bed-map.json resolves a connection to and
 * what a caller (the Hub UI's route bedId) might use — tries the id as
 * given, then with the prefix stripped, then with it added, and returns
 * whichever first has any recorded channels.
 */
function getLatestForBedIdVariants(rawBedId) {
  const stripped = rawBedId.replace(/^ICU-1-/, '');
  const prefixed = rawBedId.startsWith('ICU-1-') ? rawBedId : `ICU-1-${rawBedId}`;
  for (const id of [rawBedId, stripped, prefixed]) {
    const wf = getLatest(id);
    if (Object.keys(wf).length > 0) return wf;
  }
  return {};
}

module.exports = { record, getLatest, getAllLatest, getLatestForBedIdVariants };
