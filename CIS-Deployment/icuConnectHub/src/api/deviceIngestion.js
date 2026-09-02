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

/** `deviceType` is optional — omit it (or pass '') for the default adapter
 * (BPL VividVue M10, HL7). See adapters/deviceAdapter.md server-side for
 * the full registered list. */
export async function mapDevice(ip, bedId, deviceType) {
  return readJson(await authFetch(`${BASE}/api/bed-map`, {
    method: 'POST',
    body: JSON.stringify(deviceType ? { ip, bedId, deviceType } : { ip, bedId }),
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
