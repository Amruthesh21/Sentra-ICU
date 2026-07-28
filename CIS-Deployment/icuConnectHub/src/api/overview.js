import { apiFetch, readJson } from './client';
import { brandCenterLabel } from '../utils/brand';

/** Operational overview for the active hospital center. */
export async function getHospitalOverview() {
  const data = await readJson(await apiFetch('/api/hub/overview'));
  if (data?.center) {
    data.center = {
      ...data.center,
      centerName: brandCenterLabel(data.center.centerName),
      displayName: brandCenterLabel(data.center.displayName || data.center.centerName),
    };
  }
  return data;
}
