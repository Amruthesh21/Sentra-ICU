import { apiFetch } from './client';

export async function readJson(res) {
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    const msg = body?.error || body?.message || text || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body || {};
}

export async function getCenter() {
  return readJson(await apiFetch('/api/center'));
}

export async function addBed(bedLabel, ip = 'auto') {
  return readJson(await apiFetch('/api/center/beds', {
    method: 'POST',
    body: JSON.stringify({ bedLabel, ip }),
  }));
}

export async function reloadConnectEngine() {
  return readJson(await apiFetch('/api/center/reload', { method: 'POST' }));
}

export async function getDevices() {
  const data = await readJson(await apiFetch('/api/devices'));
  return Array.isArray(data) ? data : [];
}

export function historySeriesWithData(history) {
  return (history || []).filter((s) => s.points?.length > 0);
}

export function trendParamNames(history) {
  return historySeriesWithData(history).map((s) => s.paramName);
}

export function hasTrendData(history, paramName) {
  const key = normalizeParamName(paramName);
  return historySeriesWithData(history).some(
    (s) => normalizeParamName(s.paramName) === key || s.paramName === paramName
  );
}

export function normalizeParamName(name) {
  if (name === 'Heart Rate' || name === 'Pulse') return 'HeartRate';
  return name;
}

/** Clinical display formatting for vitals cards (SpO2 98.0, HR 89, Temp 36.6, Inf Vol 30.23). */
export function formatVitalValue(paramName, value) {
  if (value == null || value === '--') return '--';
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(n)) return '--';

  const key = normalizeParamName(paramName);
  const name = paramName || key;

  if (name === 'SpO2' || key === 'SpO2' || name.startsWith('Temp')) {
    return n.toFixed(1);
  }
  if (name === 'Inf Vol' || name === 'Bolus Vol') {
    return n.toFixed(2);
  }
  if (name === 'Inf Rate') {
    return n.toFixed(1);
  }
  if (name === 'Heart Rate' || name === 'HeartRate' || name === 'Pulse'
      || name === 'Resp.Rate' || name === 'Bolus Rate') {
    return String(Math.round(n));
  }
  if (Math.abs(n - Math.round(n)) < 0.05) {
    return String(Math.round(n));
  }
  return n.toFixed(1);
}

export async function getBedDevices(bedId) {
  const label = bedId.replace(/^ICU-1-/, '');
  return readJson(await apiFetch(`/api/center/beds/${encodeURIComponent(label)}/devices`));
}

export async function admitPatient(payload) {
  return readJson(await apiFetch('/api/patients/admit', {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function dischargePatient(bedLabel) {
  return readJson(await apiFetch('/api/patients/discharge', {
    method: 'POST',
    body: JSON.stringify({ bedLabel }),
  }));
}

export async function getPatient(bedId) {
  return readJson(await apiFetch(`/api/patients/bed/${encodeURIComponent(bedId)}`));
}

export async function getLatestVitals(bedId) {
  return readJson(await apiFetch(`/api/vitals/latest/${encodeURIComponent(bedId)}`));
}

export async function getVitalsHistory(bedId, minutes = 60) {
  return readJson(await apiFetch(`/api/vitals/history/${encodeURIComponent(bedId)}?minutes=${minutes}`));
}

export async function getActiveAlarms() {
  return readJson(await apiFetch('/api/alarm/active'));
}

export function vitalsToMap(data) {
  const map = {};
  [...(data.primaryAttributes || []), ...(data.secondaryAttributes || [])].forEach((a) => {
    const key = a.paramName || a.name;
    const raw = a.value;
    if (key == null || raw == null || raw === '--') return;
    const num = typeof raw === 'number' ? raw : parseFloat(raw);
    if (Number.isNaN(num)) return;
    map[key] = num;
    if (key === 'Pulse' || key === 'Heart Rate') map.HeartRate = num;
  });
  return map;
}

export function bedAlarmId(bedLabel) {
  return bedLabel.startsWith('ICU-1-') ? bedLabel : `ICU-1-${bedLabel}`;
}
