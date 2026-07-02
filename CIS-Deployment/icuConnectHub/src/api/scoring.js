import { apiFetch, readJson } from './client';

export const SCORE_TYPES = [
  { id: 'NEWS2', label: 'NEWS2', desc: 'National Early Warning Score 2' },
  { id: 'SOFA', label: 'SOFA', desc: 'Sequential Organ Failure Assessment' },
  { id: 'APACHE_II', label: 'APACHE II', desc: 'Acute Physiology Score (first 24h)' },
  { id: 'RASS', label: 'RASS', desc: 'Richmond Agitation-Sedation Scale' },
  { id: 'CAM_ICU', label: 'CAM-ICU', desc: 'Confusion Assessment Method for ICU' },
];

export async function getScoringDashboard() {
  const data = await readJson(await apiFetch('/api/hub/scoring/dashboard'));
  return Array.isArray(data) ? data : [];
}

export async function autofillScore(visitId, scoreType) {
  return readJson(await apiFetch(
    `/api/hub/scoring/visits/${encodeURIComponent(visitId)}/autofill?scoreType=${encodeURIComponent(scoreType)}`
  ));
}

export async function previewScore(visitId, scoreType, inputs) {
  return readJson(await apiFetch(
    `/api/hub/scoring/visits/${encodeURIComponent(visitId)}/preview?scoreType=${encodeURIComponent(scoreType)}`,
    { method: 'POST', body: JSON.stringify({ inputs }) }
  ));
}

export async function saveScore(visitId, scoreType, payload) {
  return readJson(await apiFetch(
    `/api/hub/scoring/visits/${encodeURIComponent(visitId)}/save?scoreType=${encodeURIComponent(scoreType)}`,
    { method: 'POST', body: JSON.stringify(payload) }
  ));
}

export async function getScoreHistory(visitId, scoreType, from) {
  const q = from ? `&from=${encodeURIComponent(from)}` : '';
  const data = await readJson(await apiFetch(
    `/api/hub/scoring/visits/${encodeURIComponent(visitId)}/history?scoreType=${encodeURIComponent(scoreType)}${q}`
  ));
  return Array.isArray(data) ? data : [];
}

export function riskClass(level) {
  if (!level) return '';
  const u = level.toUpperCase();
  if (u === 'HIGH') return 'risk-high';
  if (u === 'MEDIUM' || u === 'LOW_MEDIUM') return 'risk-medium';
  return 'risk-low';
}

export function formatScoreValue(scoreType, value) {
  if (value == null) return '—';
  if (scoreType === 'CAM_ICU') return value >= 1 ? 'Positive' : 'Negative';
  return String(value);
}
