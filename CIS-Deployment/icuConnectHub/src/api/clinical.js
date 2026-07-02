import { apiFetch, readJson } from './client';

export async function getClinicalContext(bedId) {
  return readJson(await apiFetch(`/api/hub/clinical/context?bedId=${encodeURIComponent(bedId)}`));
}

export async function getPatientClinicalHistory(visitId) {
  return readJson(await apiFetch(`/api/hub/clinical/visits/${visitId}/history`));
}

export async function listNotes(visitId) {
  return readJson(await apiFetch(`/api/hub/clinical/visits/${visitId}/notes`));
}

export async function createNote(visitId, payload) {
  return readJson(await apiFetch(`/api/hub/clinical/visits/${visitId}/notes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function updateNote(noteId, payload) {
  return readJson(await apiFetch(`/api/hub/clinical/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }));
}

export async function listOrders(visitId) {
  return readJson(await apiFetch(`/api/hub/clinical/visits/${visitId}/orders`));
}

export async function createOrder(visitId, payload) {
  return readJson(await apiFetch(`/api/hub/clinical/visits/${visitId}/orders`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function updateOrder(orderId, payload) {
  return readJson(await apiFetch(`/api/hub/clinical/orders/${orderId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }));
}

export async function updateOrderStatus(orderId, statusOrPayload) {
  const payload = typeof statusOrPayload === 'string' ? { status: statusOrPayload } : statusOrPayload;
  return updateOrder(orderId, payload);
}

export async function listLabsImaging(visitId) {
  return readJson(await apiFetch(`/api/hub/clinical/visits/${visitId}/labs-imaging`));
}

export async function createLab(visitId, payload) {
  return readJson(await apiFetch(`/api/hub/clinical/visits/${visitId}/labs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function createImaging(visitId, payload) {
  return readJson(await apiFetch(`/api/hub/clinical/visits/${visitId}/imaging`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function parseClinicalOcr(file) {
  const form = new FormData();
  form.append('file', file);
  return readJson(await apiFetch('/api/hub/clinical/ocr/parse', {
    method: 'POST',
    body: form,
  }));
}

export async function listFluidEntries(visitId, options = {}) {
  const params = new URLSearchParams();
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  const q = params.toString() ? `?${params}` : '';
  const data = await readJson(await apiFetch(`/api/hub/clinical/visits/${visitId}/fluids${q}`));
  return Array.isArray(data) ? data : [];
}

export async function createFluidEntry(visitId, payload) {
  return readJson(await apiFetch(`/api/hub/clinical/visits/${visitId}/fluids`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function stopFluidEntry(entryId) {
  return readJson(await apiFetch(`/api/hub/clinical/fluids/${entryId}/stop`, {
    method: 'POST',
  }));
}

export async function deleteFluidEntry(entryId) {
  const res = await apiFetch(`/api/hub/clinical/fluids/${entryId}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Delete failed (${res.status})`);
  }
}
