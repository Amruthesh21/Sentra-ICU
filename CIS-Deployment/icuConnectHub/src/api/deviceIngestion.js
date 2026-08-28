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

/** { "<ip>": "<bedId>" } */
export async function getBedMap() {
  return readJson(await fetch(`${BASE}/api/bed-map`, { cache: 'no-store' }));
}

/** Sources that have sent device data but have no bed-map entry yet —
 * never silently dropped, always surfaced here until mapped. */
export async function getQuarantine() {
  const data = await readJson(await fetch(`${BASE}/api/quarantine`, { cache: 'no-store' }));
  return data.unmappedSources || [];
}

export async function mapDevice(ip, bedId) {
  return readJson(await fetch(`${BASE}/api/bed-map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, bedId }),
  }));
}

export async function unmapDevice(ip) {
  return readJson(await fetch(`${BASE}/api/bed-map/${encodeURIComponent(ip)}`, { method: 'DELETE' }));
}
