import { apiFetch } from './apiFetch';

export async function getActiveAlarms() {
  const res = await apiFetch('/api/alarm/active');
  if (!res.ok) return [];
  return res.json();
}

export async function acknowledgeAlarm({ bedId, paramName, threshold, currentValue }) {
  const res = await apiFetch('/api/alarm/acknowledge', {
    method: 'POST',
    body: JSON.stringify({ bedId, paramName, threshold, currentValue }),
  });
  if (!res.ok) throw new Error('Failed to acknowledge alarm');
  return res.json();
}

export function alarmConditionKey(alarm) {
  return `${alarm.bedId}|${alarm.paramName}|${alarm.threshold}`;
}

export async function sendWatchPushForAlarm(doctorId, alarm) {
  const res = await apiFetch('/api/notification/push-alarm', {
    method: 'POST',
    body: JSON.stringify({ doctorId, alarm, async: true }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to send watch alert');
  }
  return res.json();
}
