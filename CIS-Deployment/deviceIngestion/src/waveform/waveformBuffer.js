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

// A real sliding window in TIME, not a flat sample count — a flat count
// (the original design) meant a 512Hz ECG channel held under a second of
// history while a 100Hz pleth/resp channel held ~5s from the exact same
// cap, and the Hub's waveform panel derived its visual sweep width from
// however much happened to be buffered — so ECG swept its whole trace in
// under a second (looked frantic) while pleth/resp didn't, and neither
// synced with the other. Capping by seconds-per-channel, computed from
// each channel's own reported sample rate, fixes the buffer side of that;
// see WaveformCanvas.jsx for the matching frontend fix (a fixed sweep
// duration per trace kind, not derived from the buffer size either).
// Matches the longest fixed sweep window on the frontend (RESP, at 12s —
// see WaveformCanvas.jsx) so even the slowest trace can be fully populated
// by real data once enough has accumulated, rather than permanently
// showing a flat clamped stretch for the difference.
const MAX_SECONDS_PER_CHANNEL = 12;
const FALLBACK_MAX_SAMPLES = 500; // only used when sampleRate is unknown (null/0) and time-based trimming isn't possible

// A channel is dropped once nothing new has arrived for it in longer than the
// window this buffer keeps — past that point every sample still held is older
// than the history it claims to have, so there is nothing current left to
// serve. Without expiry, a device that stops sending one channel (a monitor
// whose SpO2 lead comes off, or a one-shot fixture replay that disconnects)
// leaves its last samples here indefinitely and the Hub keeps drawing them
// behind a "LIVE" badge — a trace that looks like a running signal but is
// frozen minutes in the past, which is worse than showing nothing. Evaluated
// on read rather than on a timer, so beds nobody is looking at cost nothing.
const CHANNEL_STALE_AFTER_MS = MAX_SECONDS_PER_CHANNEL * 1000;

/** @type {Map<string, Record<string, {unit: string, sampleRate: number|null, samples: number[], updatedAt: number}>>} */
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
 * @param {number} [nowMs] injectable clock, so expiry is testable without waiting it out
 */
async function record(bedId, waveforms, nowMs = Date.now()) {
  if (!waveforms || Object.keys(waveforms).length === 0) return;

  const bucket = latestByBed.get(bedId) || {};
  for (const [channel, wf] of Object.entries(waveforms)) {
    const existing = bucket[channel];
    const cap = wf.sampleRate
      ? Math.ceil(wf.sampleRate * MAX_SECONDS_PER_CHANNEL)
      : FALLBACK_MAX_SAMPLES;

    // Same channel, same reported rate -> genuinely append (a real device
    // streaming continuously sends one batch of new samples per message,
    // not a replacement for everything before it). Different rate (a
    // device reconfigured mid-stream) or no prior entry -> start fresh;
    // concatenating samples recorded at two different rates would corrupt
    // the time math everything else here depends on.
    //
    // Trim `existing` down to however much of it could possibly survive
    // the cap BEFORE concatenating, rather than concat-the-full-thing-then-
    // slice-back-down — at steady state (existing already at cap) the old
    // approach allocated and copied a full cap-plus-one-batch-sized array
    // just to immediately discard the oldest batch's worth of it; this
    // only ever allocates arrays at or under `cap`.
    let samples;
    if (existing && existing.sampleRate === wf.sampleRate) {
      const keepFromExisting = Math.max(0, cap - wf.samples.length);
      const trimmedExisting = existing.samples.length > keepFromExisting
        ? existing.samples.slice(-keepFromExisting)
        : existing.samples;
      samples = trimmedExisting.concat(wf.samples);
      if (samples.length > cap) samples = samples.slice(-cap); // a single batch alone longer than cap (rare)
    } else {
      samples = wf.samples.length > cap ? wf.samples.slice(-cap) : wf.samples.slice();
    }

    bucket[channel] = { unit: wf.unit, sampleRate: wf.sampleRate, samples, updatedAt: nowMs };
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

/**
 * Drops every channel that has gone stale, and the bed itself once its last
 * channel goes. Mutates the stored bucket rather than filtering a copy, so a
 * channel the device has stopped sending is genuinely released instead of being
 * re-filtered out on every poll for the lifetime of the process.
 */
function pruneStale(bedId, nowMs) {
  const bucket = latestByBed.get(bedId);
  if (!bucket) return null;

  for (const [channel, wf] of Object.entries(bucket)) {
    if (nowMs - wf.updatedAt > CHANNEL_STALE_AFTER_MS) delete bucket[channel];
  }

  if (Object.keys(bucket).length === 0) {
    latestByBed.delete(bedId);
    return null;
  }
  return bucket;
}

function getLatest(bedId, nowMs = Date.now()) {
  return pruneStale(bedId, nowMs) || {};
}

function getAllLatest(nowMs = Date.now()) {
  const out = {};
  // Snapshot the keys first: pruneStale can delete the bed it is called for.
  for (const bedId of [...latestByBed.keys()]) {
    const bucket = pruneStale(bedId, nowMs);
    if (bucket) out[bedId] = bucket;
  }
  return out;
}

/**
 * Same lookup as getLatest, but tolerant of the "ICU-1-" prefix
 * inconsistency between what bed-map.json resolves a connection to and
 * what a caller (the Hub UI's route bedId) might use — tries the id as
 * given, then with the prefix stripped, then with it added, and returns
 * whichever first has any recorded channels.
 */
function getLatestForBedIdVariants(rawBedId, nowMs = Date.now()) {
  const stripped = rawBedId.replace(/^ICU-1-/, '');
  const prefixed = rawBedId.startsWith('ICU-1-') ? rawBedId : `ICU-1-${rawBedId}`;
  for (const id of [rawBedId, stripped, prefixed]) {
    const wf = getLatest(id, nowMs);
    if (Object.keys(wf).length > 0) return wf;
  }
  return {};
}

module.exports = { record, getLatest, getAllLatest, getLatestForBedIdVariants };
