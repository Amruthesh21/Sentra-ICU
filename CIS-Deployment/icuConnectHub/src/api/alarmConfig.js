import { apiFetch, readJson } from './client';

const DOCTOR_ID = 'doctor-001';

export function getDoctorId() {
  return localStorage.getItem('doctorId') || DOCTOR_ID;
}

/** Canonical alarm bed id: ICU-1-BED {n} (space, no leading zeros). */
export function canonicalAlarmBedId(bedId) {
  if (!bedId) return bedId;
  let decoded = bedId;
  try {
    decoded = decodeURIComponent(bedId);
  } catch {
    decoded = bedId;
  }
  decoded = decoded.trim();
  if (/^ICU-1-/i.test(decoded)) {
    decoded = decoded.slice('ICU-1-'.length).trim();
  }
  const bedNum = decoded.match(/^BED[\s_-]*0*(\d+)$/i);
  if (bedNum) {
    return `ICU-1-BED ${Number(bedNum[1])}`;
  }
  return `ICU-1-${decoded}`;
}

export function findBedAlarmConfig(configs, bedId) {
  const canonical = canonicalAlarmBedId(bedId);
  const matches = (configs || []).filter(
    (c) => canonicalAlarmBedId(c?.bedId) === canonical,
  );
  return matches.sort((a, b) => {
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
    body: JSON.stringify({
      ...payload,
      bedId: canonicalAlarmBedId(payload.bedId),
      doctorId: payload.doctorId || getDoctorId(),
    }),
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

/** Empty template for a bed that has never been configured (do not invent demo limits). */
export function emptyThresholds() {
  return defaultThresholds();
}

export function mergeThresholds(saved) {
  return VITAL_PARAMS.map((param) => {
    const existing = (saved || []).find(
      (a) => a.paramName === param.paramName
        || (param.aliases || []).includes(a.paramName)
        || (param.paramName === 'Temp1' && (a.paramName === 'Temp' || a.paramName === 'Temp2')),
    );
    if (!existing) {
      return {
        paramName: param.paramName,
        highThreshold: null,
        lowThreshold: null,
        enabled: false,
      };
    }
    return {
      paramName: param.paramName,
      highThreshold: existing.highThreshold ?? null,
      lowThreshold: existing.lowThreshold ?? null,
      enabled: existing.enabled === true || existing.enabled === 'true',
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
