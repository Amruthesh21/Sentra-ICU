export const BED_DETAIL_TABS = [
  { id: 'overview', label: 'Patient overview' },
  { id: 'waveforms', label: 'Live waveforms' },
  { id: 'trends', label: 'Trends' },
  { id: 'labs', label: 'Labs & Images' },
  { id: 'notes', label: 'Notes' },
  { id: 'orders', label: 'Orders' },
  { id: 'fluids', label: 'Fluids' },
  { id: 'alarms', label: 'Alarms' },
];

export const DEFAULT_BED_TAB = 'overview';

const TAB_IDS = new Set(BED_DETAIL_TABS.map((t) => t.id));

export function isValidBedTab(tab) {
  return TAB_IDS.has(tab);
}

export function resolveBedTab(tab) {
  return isValidBedTab(tab) ? tab : DEFAULT_BED_TAB;
}

/**
 * Route to a bed detail tab (default: live waveforms for alarm monitoring).
 * Accepts alarm bedId (ICU-1-BED 1), bed label, or alert objects with bedId/bed.
 */
export function bedDetailPath(bedRef, tab = 'waveforms') {
  let raw = bedRef;
  if (bedRef && typeof bedRef === 'object') {
    raw = bedRef.bedId || bedRef.alarmBedId || bedRef.bed || bedRef.bedLabel;
  }
  if (!raw) return '/beds';
  const id = String(raw).trim();
  const safeTab = isValidBedTab(tab) ? tab : 'waveforms';
  return `/bed/${encodeURIComponent(id)}?tab=${safeTab}`;
}
