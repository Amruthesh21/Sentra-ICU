import { apiFetch, readJson } from './client';
import { brandCenterLabel } from '../utils/brand';

/** Center analytics for the active hospital center. */
export async function getCenterAnalytics() {
  const data = await readJson(await apiFetch('/api/hub/analytics/center'));
  if (data?.center) {
    data.center = {
      ...data.center,
      centerName: brandCenterLabel(data.center.centerName),
      displayName: brandCenterLabel(data.center.displayName || data.center.centerName),
    };
  }
  return data;
}
