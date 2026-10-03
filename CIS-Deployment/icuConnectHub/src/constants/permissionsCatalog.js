/**
 * Hub permissions that map to real Sentra ICU features.
 * Keys must stay in sync with PermissionCatalog.HUB_ASSIGNABLE (backend).
 */
export const PERMISSION_GROUPS = [
  {
    id: 'dashboards',
    title: 'Dashboards & analytics',
    permissions: [
      { key: 'dashboard.universal', label: 'Universal dashboard', hint: 'Hospital-wide ICU overview' },
      { key: 'dashboard.unit', label: 'Unit dashboard', hint: 'Bed grid for one ICU unit' },
      { key: 'kpi.read', label: 'ICU analytics', hint: 'Command center metrics & trends' },
    ],
  },
  {
    id: 'patients',
    title: 'Patients & admissions',
    permissions: [
      { key: 'patient.read', label: 'View patients', hint: 'Patient list and demographics' },
      { key: 'patient.create', label: 'Admit patients', hint: 'New admissions & bed assignment' },
      { key: 'patient.update', label: 'Update patient records', hint: 'Edit demographics & visit info' },
      { key: 'patient.write', label: 'Clinical documentation', hint: 'Charts, vitals entry, care data' },
      { key: 'patient.delete', label: 'Discharge patients', hint: 'Complete discharge workflow' },
    ],
  },
  {
    id: 'monitoring',
    title: 'Bed monitor & vitals',
    permissions: [
      { key: 'bed.read', label: 'Open bed monitor', hint: 'Live patient bedside view' },
      { key: 'waveform.read', label: 'Waveforms', hint: 'Ecg, SpO₂, respiration traces' },
      { key: 'trends.read', label: 'Vitals trends', hint: 'Historical vitals charts' },
    ],
  },
  {
    id: 'alarms',
    title: 'Alarms',
    permissions: [
      { key: 'alarm.read', label: 'Alarm center', hint: 'View active physiological alarms' },
      { key: 'alarm.ack', label: 'Acknowledge alarms', hint: 'Silence hub alerts after review' },
      { key: 'alarm.config', label: 'Alarm thresholds', hint: 'Set limits per bed or role' },
    ],
  },
  {
    id: 'clinical',
    title: 'Clinical workflow',
    permissions: [
      { key: 'clinical_notes.read', label: 'View notes', hint: 'Nursing & physician notes' },
      { key: 'clinical_notes.write', label: 'Write notes', hint: 'Add and edit clinical notes' },
      { key: 'orders.read', label: 'View orders', hint: 'Medication & care orders' },
      { key: 'orders.write', label: 'Manage orders', hint: 'Create, hold, and discontinue orders' },
      { key: 'scoring.read', label: 'Clinical scoring', hint: 'NEWS2, SOFA, APACHE scores' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    permissions: [
      { key: 'reports.read', label: 'View reports', hint: 'Shift summaries and census reports' },
      { key: 'reports.write', label: 'Export reports', hint: 'PDF / print report generation' },
    ],
  },
];

export const ALL_ASSIGNABLE_KEYS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));

export const PERMISSION_LABELS = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.key, p.label])),
);

/** Nav item → required permission (any one match shows the link) */
export const NAV_PERMISSIONS = {
  '/universal': ['dashboard.universal'],
  '/overview': ['dashboard.unit'],
  '/unit': ['dashboard.unit'],
  '/patients': ['patient.read', 'patient.write', 'patient.create'],
  '/beds': ['dashboard.unit', 'patient.read'],
  '/alerts': ['alarm.read'],
  '/admissions': ['patient.read', 'patient.write', 'patient.create'],
  '/alarms': ['alarm.read'],
  '/analytics': ['kpi.read'],
  '/scoring': ['scoring.read'],
  '/reports': ['reports.read', 'reports.write'],
};
