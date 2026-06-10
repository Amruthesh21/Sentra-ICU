import { apiFetch, readJson } from './client';

const DOCTOR_ID = 'doctor-001';

export function getDoctorId() {
  return localStorage.getItem('doctorId') || DOCTOR_ID;
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
