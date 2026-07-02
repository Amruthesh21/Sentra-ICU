import { apiFetch, readJson } from './client';

const DOCTOR_ID = 'doctor-001';

export function getDoctorId() {
  return localStorage.getItem('doctorId') || DOCTOR_ID;
}

export function canonicalAlarmBedId(bedId) {
  if (!bedId) return bedId;
  let decoded = bedId;
  try {
    decoded = decodeURIComponent(bedId);
  } catch {
    decoded = bedId;
  }
  decoded = decoded.trim();
  if (decoded.startsWith('ICU-1-')) return decoded;
  if (/^BED-\d+$/i.test(decoded)) return `ICU-1-${decoded.toUpperCase()}`;
  return `ICU-1-${decoded}`;
}

function bedIdVariants(bedId) {
  const raw = canonicalAlarmBedId(bedId);
  const set = new Set();
  const add = (v) => {
    if (!v || typeof v !== 'string') return;
    const t = v.trim();
    if (!t) return;
    set.add(t);
  };

  add(raw);
  const label = raw?.startsWith('ICU-1-') ? raw.slice('ICU-1-'.length) : raw;
  add(label);

  const collapsed = String(label || '').replace(/\s+/g, ' ');
  const hyphen = collapsed.replace(/ /g, '-');
  const spaced = collapsed.replace(/-/g, ' ');
  add(collapsed);
  add(hyphen);
  add(spaced);
  add(`ICU-1-${collapsed}`);
  add(`ICU-1-${hyphen}`);
  add(`ICU-1-${spaced}`);

  const m = collapsed.match(/^BED[\s_-]*0*(\d+)$/i);
  if (m) {
    const n = String(Number(m[1]));
    add(`BED ${n}`);
    add(`BED-${n}`);
    add(`ICU-1-BED ${n}`);
    add(`ICU-1-BED-${n}`);
  }
  return [...set];
}

function normalizeBedKey(bedId) {
  const canonical = canonicalAlarmBedId(bedId) || '';
  return canonical
    .toUpperCase()
    .replace(/^ICU-1-/, '')
    .replace(/[^A-Z0-9]/g, '');
}

export function findBedAlarmConfig(configs, bedId) {
  const keys = new Set(bedIdVariants(bedId).map(normalizeBedKey));
  return (configs || [])
    .filter((c) => keys.has(normalizeBedKey(c?.bedId)))
    .sort((a, b) => {
      const at = Date.parse(a?.updatedAt || a?.createdAt || 0) || 0;
      const bt = Date.parse(b?.updatedAt || b?.createdAt || 0) || 0;
      return bt - at;
    })[0];
}

export function validateThresholds(alarms) {
  for (const alarm of alarms || []) {
    if (!alarm.enabled) continue;
    const high = alarm.highThreshold === '' || alarm.highThreshold == null
      ? null
      : Number(alarm.highThreshold);
    const low = alarm.lowThreshold === '' || alarm.lowThreshold == null
      ? null
      : Number(alarm.lowThreshold);
    const label = VITAL_PARAMS.find((p) => p.paramName === alarm.paramName)?.label || alarm.paramName;
    if (high != null && Number.isNaN(high)) return `${label}: high threshold must be a number`;
    if (low != null && Number.isNaN(low)) return `${label}: low threshold must be a number`;
    if (high == null && low == null) {
      return `${label}: set at least one limit when alarm is enabled`;
    }
    if (high != null && low != null && high <= low) {
      return `${label}: high limit must be greater than low limit`;
    }
  }
  return null;
}

export const VITAL_PARAMS = [
  { paramName: 'SpO2', label: 'SpO2', unit: '%' },
  { paramName: 'HeartRate', label: 'Heart Rate', unit: 'bpm', aliases: ['Pulse', 'Heart Rate'] },
  { paramName: 'Temp1', label: 'Temp', unit: '°C' },
  { paramName: 'Resp.Rate', label: 'Resp. Rate', unit: 'bpm' },
];

export async function getAlarmConfig(doctorId = getDoctorId()) {
  const data = await readJson(await apiFetch(`/api/alarm-config/${encodeURIComponent(doctorId)}`));
  return Array.isArray(data) ? data : [];
}

export async function saveAlarmConfig(payload) {
  return readJson(await apiFetch('/api/alarm-config', {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export function defaultThresholds() {
  return VITAL_PARAMS.map((p) => ({
    paramName: p.paramName,
    highThreshold: null,
    lowThreshold: null,
    enabled: false,
  }));
}

export function demoThresholds() {
  return [
    { paramName: 'SpO2', highThreshold: null, lowThreshold: 90, enabled: true },
    { paramName: 'HeartRate', highThreshold: 120, lowThreshold: 50, enabled: true },
    { paramName: 'Temp1', highThreshold: 38.5, lowThreshold: 30, enabled: true },
    { paramName: 'Resp.Rate', highThreshold: 30, lowThreshold: 8, enabled: false },
  ];
}

export function mergeThresholds(saved) {
  return VITAL_PARAMS.map((param) => {
    const existing = saved?.find((a) => a.paramName === param.paramName);
    return existing || {
      paramName: param.paramName,
      highThreshold: null,
      lowThreshold: null,
      enabled: false,
    };
  });
}

export function getVitalStatus(value, paramName, thresholds) {
  if (value == null || !thresholds?.length) return 'normal';
  const config = thresholds.find((t) => t.paramName === paramName && t.enabled);
  if (!config) return 'normal';
  if (config.lowThreshold != null && value < config.lowThreshold) return 'critical';
  if (config.highThreshold != null && value > config.highThreshold) {
    return paramName === 'Temp1' ? 'warning' : 'critical';
  }
  return 'normal';
}
