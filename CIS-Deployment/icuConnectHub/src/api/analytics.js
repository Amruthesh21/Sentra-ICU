import { apiFetch, readJson } from './client';

/** Center analytics always uses the Connect Engine center (RTWO) on the server. */
export async function getCenterAnalytics() {
  return readJson(await apiFetch('/api/hub/analytics/center'));
}
