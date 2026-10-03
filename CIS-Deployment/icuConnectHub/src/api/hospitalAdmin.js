import { apiFetch, readJson } from './client';

export async function listCenters() {
  const res = await apiFetch('/api/hospital-admin/centers');
  return readJson(res);
}

export async function listUsers() {
  const res = await apiFetch('/api/hospital-admin/users');
  return readJson(res);
}

export async function createUser(payload) {
  const res = await apiFetch('/api/hospital-admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function updateUser(userId, payload) {
  const res = await apiFetch(`/api/hospital-admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function fetchUserPhotoBlob(userId) {
  const res = await apiFetch(`/api/hospital-admin/users/${userId}/photo`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Could not load photo');
  return res.blob();
}

export async function uploadUserPhoto(userId, file) {
  const body = new FormData();
  body.append('file', file);
  const res = await apiFetch(`/api/hospital-admin/users/${userId}/photo`, {
    method: 'POST',
    body,
  });
  return readJson(res);
}

export async function deleteUserPhoto(userId) {
  const res = await apiFetch(`/api/hospital-admin/users/${userId}/photo`, {
    method: 'DELETE',
  });
  return readJson(res);
}

export async function listRoles() {
  const res = await apiFetch('/api/hospital-admin/roles');
  return readJson(res);
}

export async function createRole(payload) {
  const res = await apiFetch('/api/hospital-admin/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function updateRole(roleId, payload) {
  const res = await apiFetch(`/api/hospital-admin/roles/${roleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function listPermissions() {
  const res = await apiFetch('/api/hospital-admin/permissions');
  return readJson(res);
}

export async function listAuditLogs({ category, limit } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const res = await apiFetch(`/api/hospital-admin/audit-logs${qs ? `?${qs}` : ''}`);
  return readJson(res);
}
