import { apiFetch } from './apiFetch';

export async function fetchPatientByBed(bedId) {
  const res = await apiFetch(`/api/patients/bed/${encodeURIComponent(bedId)}`);
  if (!res.ok) return { bedId, source: 'none' };
  return res.json();
}

export async function fetchPatientsForDoctor(doctorId) {
  const res = await apiFetch(`/api/patients?doctorId=${encodeURIComponent(doctorId)}`);
  if (!res.ok) return [];
  return res.json();
}
