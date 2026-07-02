import { apiFetch, readJson } from './client';

export async function listUnits() {
  return readJson(await apiFetch('/api/hub/units'));
}

export async function getUnit(unitId) {
  return readJson(await apiFetch(`/api/hub/units/${unitId}`));
}

export async function createUnit(payload) {
  return readJson(await apiFetch('/api/hub/units', {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function addBedToUnit(unitId, payload) {
  return readJson(await apiFetch(`/api/hub/units/${unitId}/beds`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function listUnitBeds(unitId) {
  return readJson(await apiFetch(`/api/hub/units/${unitId}/beds`));
}
