/** Shared ward data for Sentra ICU clinical UI (matches design screenshots) */

export const WARD_DATE = '7/14/2026';

export const BEDS = [
  {
    id: 'ICU-01',
    unit: 'CENTRAL ICU',
    patient: 'Eleanor Vance',
    age: 68,
    sex: 'F',
    diagnosis: 'Septic shock, post-op',
    status: 'critical',
    hr: 119,
    spo2: 90,
    bp: '88/52',
    rr: 28,
    free: false,
  },
  {
    id: 'ICU-02',
    unit: 'CENTRAL ICU',
    patient: 'Marcus Chen',
    age: 54,
    sex: 'M',
    diagnosis: 'ARDS, ventilated',
    status: 'warning',
    hr: 106,
    spo2: 93,
    bp: '102/64',
    rr: 24,
    free: false,
  },
  {
    id: 'ICU-03',
    unit: 'TRAUMA ICU',
    patient: 'Priya Kapoor',
    age: 41,
    sex: 'F',
    diagnosis: 'Post-CABG day 1',
    status: 'stable',
    hr: 86,
    spo2: 97,
    bp: '118/72',
    rr: 16,
    free: false,
  },
  {
    id: 'ICU-04',
    unit: 'CENTRAL ICU',
    patient: 'James Okonkwo',
    age: 72,
    sex: 'M',
    diagnosis: 'Acute kidney injury',
    status: 'warning',
    hr: 104,
    spo2: 94,
    bp: '96/58',
    rr: 22,
    free: false,
  },
  {
    id: 'ICU-05',
    unit: 'TRAUMA ICU',
    patient: 'Sofia Alvarez',
    age: 29,
    sex: 'F',
    diagnosis: 'Trauma polyinjury',
    status: 'critical',
    hr: 137,
    spo2: 88,
    bp: '82/48',
    rr: 32,
    free: false,
  },
  {
    id: 'ICU-06',
    unit: 'CENTRAL ICU',
    patient: 'David Park',
    age: 61,
    sex: 'M',
    diagnosis: 'DKA resolving',
    status: 'stable',
    hr: 64,
    spo2: 98,
    bp: '124/78',
    rr: 14,
    free: false,
  },
  {
    id: 'ICU-07',
    unit: 'NEURO ICU',
    patient: null,
    age: null,
    sex: null,
    diagnosis: null,
    status: 'available',
    hr: null,
    spo2: null,
    bp: null,
    rr: null,
    free: true,
  },
  {
    id: 'ICU-08',
    unit: 'CENTRAL ICU',
    patient: 'Hannah Brooks',
    age: 47,
    sex: 'F',
    diagnosis: 'Community pneumonia',
    status: 'warning',
    hr: 114,
    spo2: 92,
    bp: '108/66',
    rr: 26,
    free: false,
  },
  {
    id: 'ICU-09',
    unit: 'TRAUMA ICU',
    patient: null,
    age: null,
    sex: null,
    diagnosis: null,
    status: 'available',
    hr: null,
    spo2: null,
    bp: null,
    rr: null,
    free: true,
  },
  {
    id: 'ICU-10',
    unit: 'NEURO ICU',
    patient: 'Omar Hassan',
    age: 58,
    sex: 'M',
    diagnosis: 'ICH monitoring',
    status: 'stable',
    hr: 85,
    spo2: 96,
    bp: '132/80',
    rr: 15,
    free: false,
  },
  {
    id: 'ICU-11',
    unit: 'CENTRAL ICU',
    patient: null,
    age: null,
    sex: null,
    diagnosis: null,
    status: 'available',
    hr: null,
    spo2: null,
    bp: null,
    rr: null,
    free: true,
  },
  {
    id: 'ICU-12',
    unit: 'TRAUMA ICU',
    patient: null,
    age: null,
    sex: null,
    diagnosis: null,
    status: 'available',
    hr: null,
    spo2: null,
    bp: null,
    rr: null,
    free: true,
  },
];

export const ALERTS = [
  { id: 'a1', severity: 'critical', title: 'Heart rate spike detected (142 bpm)', patient: 'Marcus Chen', bed: 'ICU-02', ack: false },
  { id: 'a2', severity: 'critical', title: 'SpO2 below threshold (88%)', patient: 'Sofia Alvarez', bed: 'ICU-05', ack: false },
  { id: 'a3', severity: 'warning', title: 'Blood pressure dropping (88/52)', patient: 'Eleanor Vance', bed: 'ICU-01', ack: false },
  { id: 'a4', severity: 'warning', title: 'Elevated temperature (38.9°C)', patient: 'James Okonkwo', bed: 'ICU-04', ack: false },
  { id: 'a5', severity: 'critical', title: 'Respiratory rate rising (32 /min)', patient: 'Sofia Alvarez', bed: 'ICU-05', ack: false },
  { id: 'a6', severity: 'warning', title: 'Heart rate elevated (114 bpm)', patient: 'Hannah Brooks', bed: 'ICU-08', ack: false },
];

export const STAFF = [
  { id: 's1', role: 'INTENSIVIST', name: 'Dr. Helena Cruz', status: 'on', beds: 'ICU-05, ICU-03' },
  { id: 's2', role: 'ICU NURSE', name: 'Amelia Torres', status: 'on', beds: 'ICU-01, ICU-02' },
  { id: 's3', role: 'RESPIRATORY', name: 'Noah Patel', status: 'on', beds: 'ICU-02, ICU-05' },
  { id: 's4', role: 'ICU NURSE', name: 'Grace Okello', status: 'on', beds: 'ICU-04, ICU-08' },
  { id: 's5', role: 'INTENSIVIST', name: 'Dr. Wei Lin', status: 'off', beds: '—' },
  { id: 's6', role: 'CHARGE NURSE', name: 'Sarah Mitchell', status: 'on', beds: 'Floor' },
];

export function occupiedBeds() {
  return BEDS.filter((b) => !b.free);
}

export function wardStats() {
  const occ = occupiedBeds();
  return {
    patients: occ.length,
    critical: occ.filter((b) => b.status === 'critical').length,
    occupancy: Math.round((occ.length / BEDS.length) * 100),
    activeAlerts: ALERTS.filter((a) => !a.ack).length,
  };
}

export function statusLabel(status) {
  if (status === 'critical') return 'Critical';
  if (status === 'warning') return 'Warning';
  if (status === 'stable') return 'Stable';
  if (status === 'offline') return 'No signal';
  return 'Available';
}
