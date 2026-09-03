const { safeLookup } = require('../core/safeLookup');

/**
 * Adapter: Avi Viha DV10 ventilator
 * -------------------------------------
 * Learned from a real captured HL7 export (see
 * E:\RTWO - Workspace\Deployment\Simulation\deviceData\AviVihaDV10Device.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source).
 *
 * Same vendor dialect as aviIW6000.js (same "Avi" family) — OBX-3 is
 * "code^Category^Name", name is the third token, only "Measured" category
 * observations are readings ("Setting" = configured target, not a
 * reading), alerts use CWE. See aviIW6000.js for the fuller explanation of
 * why this differs from M10's layout.
 */

const CANONICAL_NAME_MAP = {
  RR: 'Resp.Rate',
  PIP: 'Ventilator PIP',
  PEEP: 'Ventilator PEEP',
  Pplat: 'Ventilator Pplat',
  Pmean: 'Ventilator Pmean',
  Vti: 'Ventilator Vti',
  Vte: 'Ventilator Vte',
  Tinsp: 'Ventilator Tinsp',
  Texp: 'Ventilator Texp',
  FiO2: 'FiO2',
  'Output Flow': 'Ventilator Output Flow',
  Mvi: 'Ventilator Mvi',
  Mve: 'Ventilator Mve',
  Cst: 'Ventilator Compliance',
  Cdy: 'Ventilator Dynamic Compliance',
  Rlung: 'Ventilator Lung Resistance',
  RSBI: 'Ventilator RSBI',
  Vleak: 'Ventilator Leak Volume',
  'RC insp': 'Ventilator RC Insp',
  'RC exp': 'Ventilator RC Exp',
};

const PRIMARY_VITALS = new Set(['Resp.Rate']);

function mapObservation({ text, codingSystem, rawValue, rawUnitField }) {
  if ((text || '').trim() !== 'Measured') return null;

  const vendorName = (codingSystem || '').trim();
  const canonicalName = safeLookup(CANONICAL_NAME_MAP, vendorName);
  if (!canonicalName) return null;

  const trimmedValue = (rawValue ?? '').toString().trim();
  if (trimmedValue === '') return null;

  const numeric = Number(trimmedValue);
  if (Number.isNaN(numeric)) return null;

  return { name: canonicalName, unit: rawUnitField || '', value: numeric };
}

function classify(canonicalName) {
  return PRIMARY_VITALS.has(canonicalName) ? 'primary' : 'secondary';
}

function mapAlert({ text, codingSystem, valueParts }) {
  if ((text || '').trim() !== 'Alarm') return null;
  const label = valueParts?.[0];
  if (!label || !label.trim()) return null;
  const severity = (codingSystem || '').trim();
  return { name: severity ? `Alarm (${severity})` : 'Alarm', label: label.trim() };
}

module.exports = {
  deviceType: 'AviVihaDV10',
  mapObservation,
  classify,
  mapAlert,
};
