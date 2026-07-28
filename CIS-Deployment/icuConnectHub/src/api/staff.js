import { apiFetch, readJson } from './client';

export async function listStaff(role) {
  const q = role ? `?role=${encodeURIComponent(role)}` : '';
  const data = await readJson(await apiFetch(`/api/hub/staff${q}`));
  return Array.isArray(data) ? data : [];
}

export async function createStaff(payload) {
  return readJson(await apiFetch('/api/hub/staff', {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function updateStaff(id, payload) {
  return readJson(await apiFetch(`/api/hub/staff/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }));
}

export async function removeStaff(id) {
  return readJson(await apiFetch(`/api/hub/staff/${id}`, {
    method: 'DELETE',
  }));
}
