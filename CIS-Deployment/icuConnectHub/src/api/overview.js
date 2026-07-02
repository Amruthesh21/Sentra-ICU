import { apiFetch, readJson } from './client';

/** Operational overview always uses the Connect Engine center (RTWO) on the server. */
export async function getHospitalOverview() {
  return readJson(await apiFetch('/api/hub/overview'));
}
