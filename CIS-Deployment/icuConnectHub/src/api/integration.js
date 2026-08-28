const BASE = '/integration';

async function readJson(res) {
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(body?.error || body?.tip || text || `HTTP ${res.status}`);
  }
  return body;
}

export async function getEngineStatus() {
  return readJson(await fetch(`${BASE}/status`, { cache: 'no-store' }));
}

export async function listAudit() {
  return readJson(await fetch(`${BASE}/audit`, { cache: 'no-store' }));
}
