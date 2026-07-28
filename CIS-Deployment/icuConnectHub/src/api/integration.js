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

export async function listConnections() {
  return readJson(await fetch(`${BASE}/connections`, { cache: 'no-store' }));
}

export async function connectFhir({ name, baseUrl, apiKey }) {
  return readJson(await fetch(`${BASE}/connections/fhir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, baseUrl, apiKey }),
  }));
}

export async function syncConnection(id) {
  return readJson(await fetch(`${BASE}/connections/${id}/sync`, { method: 'POST' }));
}

export async function deleteConnection(id) {
  return readJson(await fetch(`${BASE}/connections/${id}`, { method: 'DELETE' }));
}

export async function listPatients() {
  return readJson(await fetch(`${BASE}/patients`, { cache: 'no-store' }));
}

export async function listAudit() {
  return readJson(await fetch(`${BASE}/audit`, { cache: 'no-store' }));
}

export async function listBuffer() {
  return readJson(await fetch(`${BASE}/buffer`, { cache: 'no-store' }));
}

export async function replayBuffer() {
  return readJson(await fetch(`${BASE}/buffer/replay`, { method: 'POST' }));
}

export async function testHl7Ingest(message) {
  return readJson(await fetch(`${BASE}/ingest/hl7/json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer pulse-hospital-demo-token',
    },
    body: JSON.stringify({ message }),
  }));
}

export async function hospitalPushHl7(kind = 'ORU') {
  return readJson(await fetch('http://127.0.0.1:9080/simulate/push-hl7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
  }));
}

export async function hospitalPushDevice() {
  return readJson(await fetch('http://127.0.0.1:9080/simulate/push-device', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }));
}
