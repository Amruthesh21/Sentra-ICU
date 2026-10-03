import { authFetch } from './auth';

const BASE = '/device-ingestion';

async function readJson(res) {
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(body?.error || text || `HTTP ${res.status}`);
  }
  return body;
}

/** { "<ip>": "<bedId>" } for the default device model, or
 * { "<ip>": {"bedId": "...", "deviceType": "..."} } for any other one. */
export async function getBedMap() {
  return readJson(await authFetch(`${BASE}/api/bed-map`, { cache: 'no-store' }));
}

/** Normalizes one bed-map entry (either form) into {bedId, deviceType}. */
export function normalizeMapping(entry) {
  if (typeof entry === 'string') return { bedId: entry, deviceType: null };
  return { bedId: entry?.bedId || '', deviceType: entry?.deviceType || null };
}

/** Sources that have sent device data but have no bed-map entry yet —
 * never silently dropped, always surfaced here until mapped. */
export async function getQuarantine() {
  const data = await readJson(await authFetch(`${BASE}/api/quarantine`, { cache: 'no-store' }));
  return data.unmappedSources || [];
}

/** Maps an IP to a bed. `deviceType` must be a registered adapter id
 * (see GET /api/device-types). The Hub UI requires a model to be chosen
 * rather than silently assuming BPL VividVue M10. */
export async function mapDevice(ip, bedId, deviceType) {
  if (!deviceType) {
    throw new Error('Pick a device model first');
  }
  return readJson(await authFetch(`${BASE}/api/bed-map`, {
    method: 'POST',
    body: JSON.stringify({ ip, bedId, deviceType }),
  }));
}

export async function unmapDevice(ip) {
  return readJson(await authFetch(`${BASE}/api/bed-map/${encodeURIComponent(ip)}`, { method: 'DELETE' }));
}

/** Every adapter device-ingestion actually has registered, with which
 * protocol/port each needs (see adapters/registry.js server-side) — kept
 * live from the server rather than a hardcoded list here so this never
 * drifts out of sync with what's really supported. */
export async function getDeviceTypes() {
  return readJson(await authFetch(`${BASE}/api/device-types`, { cache: 'no-store' }));
}

/** Latest decoded waveform samples for one bed, keyed by device-reported
 * channel name (e.g. "ECG_II", "SPO2", "RESP") — {unit, sampleRate, samples}
 * each. Real device data, not a simulation: whatever deviceIngestion most
 * recently decoded off the wire for this bed, trimmed to the last ~500
 * samples per channel. Empty object if nothing's been recorded yet (no
 * device connected for this bed, or it's a device type with no waveform
 * output — a syringe pump, most ventilator/pump-class devices). */
export async function getWaveforms(bedId) {
  return readJson(await authFetch(`${BASE}/api/waveforms/${encodeURIComponent(bedId)}`, { cache: 'no-store' }));
}
