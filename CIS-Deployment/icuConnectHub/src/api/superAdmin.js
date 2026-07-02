import { apiFetch, readJson } from './client';

export async function getPlatformOverview() {
  const res = await apiFetch('/api/super-admin/platform/overview');
  return readJson(res);
}

export async function getPlatformAnalytics() {
  const res = await apiFetch('/api/super-admin/platform/analytics');
  return readJson(res);
}

export async function listAuditLogs({ hospitalId, category, limit } = {}) {
  const params = new URLSearchParams();
  if (hospitalId) params.set('hospitalId', hospitalId);
  if (category) params.set('category', category);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const res = await apiFetch(`/api/super-admin/audit-logs${qs ? `?${qs}` : ''}`);
  return readJson(res);
}

export async function listHospitals() {
  const res = await apiFetch('/api/super-admin/hospitals');
  return readJson(res);
}

export async function getHospital(hospitalId) {
  const res = await apiFetch(`/api/super-admin/hospitals/${hospitalId}`);
  return readJson(res);
}

export async function createHospital(payload) {
  const res = await apiFetch('/api/super-admin/hospitals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function updateHospital(hospitalId, payload) {
  const res = await apiFetch(`/api/super-admin/hospitals/${hospitalId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function deleteHospital(hospitalId) {
  const res = await apiFetch(`/api/super-admin/hospitals/${hospitalId}`, { method: 'DELETE' });
  return readJson(res);
}

export async function linkCenter(hospitalId, payload) {
  const res = await apiFetch(`/api/super-admin/hospitals/${hospitalId}/centers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function updateCenter(hospitalId, centerId, payload) {
  const res = await apiFetch(`/api/super-admin/hospitals/${hospitalId}/centers/${encodeURIComponent(centerId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function deleteCenter(hospitalId, centerId) {
  const res = await apiFetch(`/api/super-admin/hospitals/${hospitalId}/centers/${encodeURIComponent(centerId)}`, {
    method: 'DELETE',
  });
  return readJson(res);
}

export async function createHospitalAdmin(hospitalId, payload) {
  const res = await apiFetch(`/api/super-admin/hospitals/${hospitalId}/admins`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function updateHospitalAdmin(hospitalId, userId, payload) {
  const res = await apiFetch(`/api/super-admin/hospitals/${hospitalId}/admins/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function resetHospitalAdminTempPassword(hospitalId, userId, payload = {}) {
  const res = await apiFetch(`/api/super-admin/hospitals/${hospitalId}/admins/${userId}/reset-temp-password`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function deleteHospitalAdmin(hospitalId, userId) {
  const res = await apiFetch(`/api/super-admin/hospitals/${hospitalId}/admins/${userId}`, {
    method: 'DELETE',
  });
  return readJson(res);
}

export async function listCentersAndAdmins() {
  const res = await apiFetch('/api/super-admin/centers-admins');
  return readJson(res);
}
