import { apiFetch, readJson } from './client';

export async function listReportPatients(unitId, { discharged = false } = {}) {
  const params = new URLSearchParams();
  if (unitId) params.set('unitId', unitId);
  if (discharged) params.set('discharged', 'true');
  const q = params.toString() ? `?${params}` : '';
  const data = await readJson(await apiFetch(`/api/hub/reports/patients${q}`));
  return Array.isArray(data) ? data : [];
}

export async function generateReport(payload) {
  return readJson(await apiFetch('/api/hub/reports/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}
