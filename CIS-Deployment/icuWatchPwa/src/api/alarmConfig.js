import { apiFetch, readJsonResponse } from './apiFetch';

const ALARM_CONFIG_BASE = '/api/alarm-config';

export async function getAlarmConfig(doctorId) {
  const res = await apiFetch(`${ALARM_CONFIG_BASE}/${encodeURIComponent(doctorId)}`);
  if (!res.ok) throw new Error('Failed to fetch alarm config');
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function saveAlarmConfig(config) {
  const res = await apiFetch(ALARM_CONFIG_BASE, {
    method: 'POST',
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const data = await readJsonResponse(res).catch(() => ({}));
    throw new Error(data.message || data.error || 'Failed to save alarm config');
  }
  return res.json();
}

export async function deleteAlarmConfig(doctorId, bedId) {
  const res = await apiFetch(`${ALARM_CONFIG_BASE}/${doctorId}/${bedId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete alarm config');
}

export const VITAL_PARAMS = [
  { paramName: 'SpO2', label: 'SpO2', unit: '%' },
  { paramName: 'HeartRate', label: 'Heart Rate / Pulse', unit: 'bpm', aliases: ['Pulse'] },
  { paramName: 'Temp1', label: 'Temp1', unit: '°C' },
  { paramName: 'Resp.Rate', label: 'Resp. Rate', unit: 'bpm' },
  { paramName: 'PEEP', label: 'PEEP', unit: 'cmH2O' },
  { paramName: 'MV', label: 'MV', unit: 'L/min' },
  { paramName: 'Peak', label: 'Peak', unit: 'cmH2O' },
  { paramName: 'VT', label: 'VT', unit: 'ml' },
];

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
    { paramName: 'Temp1', highThreshold: 38.5, lowThreshold: null, enabled: true },
    { paramName: 'Resp.Rate', highThreshold: 30, lowThreshold: 8, enabled: false },
    { paramName: 'PEEP', highThreshold: 20, lowThreshold: 5, enabled: false },
    { paramName: 'MV', highThreshold: 15, lowThreshold: 4, enabled: false },
    { paramName: 'Peak', highThreshold: 40, lowThreshold: 10, enabled: false },
    { paramName: 'VT', highThreshold: 800, lowThreshold: 200, enabled: false },
  ];
}
