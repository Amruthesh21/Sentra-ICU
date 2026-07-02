import { apiFetch, readJson } from './client';

export async function searchPatients(q) {
  return readJson(await apiFetch(`/api/hub/admissions/patients/search?q=${encodeURIComponent(q)}`));
}

export async function listAdmissionBeds(unitId, { allUnits = false } = {}) {
  const params = new URLSearchParams();
  if (unitId) params.set('unitId', unitId);
  if (allUnits) params.set('allUnits', 'true');
  const q = params.toString() ? `?${params}` : '';
  return readJson(await apiFetch(`/api/hub/admissions/beds${q}`));
}

export async function saveAdmissionDraft(payload) {
  return readJson(await apiFetch('/api/hub/admissions/draft', {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function admitPatientHub(payload) {
  return readJson(await apiFetch('/api/hub/admissions/admit', {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function readmitPatientHub(payload) {
  return readJson(await apiFetch('/api/hub/admissions/readmit', {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function dischargePatientHub(payload) {
  const body = typeof payload === 'string' ? { bedLabel: payload } : payload;
  return readJson(await apiFetch('/api/hub/admissions/discharge', {
    method: 'POST',
    body: JSON.stringify(body),
  }));
}

export async function getDischargePreview(bedLabel) {
  return readJson(await apiFetch(
    `/api/hub/admissions/discharge-preview?bedLabel=${encodeURIComponent(bedLabel)}`,
  ));
}

export async function getDevices() {
  const data = await readJson(await apiFetch('/api/devices'));
  return Array.isArray(data) ? data : [];
}
