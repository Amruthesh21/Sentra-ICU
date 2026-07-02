export const BED_DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'waveforms', label: 'Waveforms' },
  { id: 'trends', label: 'Trends' },
  { id: 'fluids', label: 'Fluids' },
  { id: 'labs', label: 'Labs & Images' },
  { id: 'orders', label: 'Orders' },
  { id: 'alarms', label: 'Alarms' },
  { id: 'notes', label: 'Notes' },
];

export const DEFAULT_BED_TAB = 'overview';

const TAB_IDS = new Set(BED_DETAIL_TABS.map((t) => t.id));

export function isValidBedTab(tab) {
  return TAB_IDS.has(tab);
}

export function resolveBedTab(tab) {
  return isValidBedTab(tab) ? tab : DEFAULT_BED_TAB;
}
