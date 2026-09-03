const { safeLookup } = require('../core/safeLookup');

/**
 * Adapter: Avi IW6000 neonatal incubator
 * ------------------------------------------
 * Learned from a real captured HL7 export (see
 * E:\RTWO - Workspace\Deployment\Simulation\deviceData\AviIW6000Device.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source, not referenced for anything beyond this file's
 * raw protocol bytes).
 *
 * Quirks specific to this model — genuinely different from BPL VividVue
 * M10's OBX-3 layout, not just a different code table:
 *  - OBX-3 is "code^Category^Name" — THREE tokens, but the human-readable
 *    field name is the THIRD token (core's `codingSystem`), not the second
 *    (`text`) the way M10's is. `text` here is a grouping label instead:
 *    "Measured" (a live reading) or "Setting" (a configured threshold/
 *    target, not a reading) — only "Measured" observations are published.
 *  - Alerts use CWE, not CE (see core/hl7Parser.js — both are handled
 *    identically there now; this was a real core-level gap this device
 *    exposed, not something worked around here).
 */

const CANONICAL_NAME_MAP = {
  PulseRate: 'Pulse',
  SpO2: 'SpO2',
  BabyTemp: 'Temp1',
  AirTemp: 'Incubator Air Temp',
  HeaterPower: 'Incubator Heater Power',
  PressureValue: 'Incubator Pressure',
  SuctionPressure: 'Incubator Suction Pressure',
  BabyWeight: 'Baby Weight',
};

const PRIMARY_VITALS = new Set(['Pulse', 'SpO2', 'Temp1']);

function mapObservation({ text, codingSystem, rawValue, rawUnitField }) {
  if ((text || '').trim() !== 'Measured') return null; // Setting = config, not a reading

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

// CWE alert: OBX-3 "code^Alarm^<severity>", value is the alert text itself
// (not further ^-coded on this device).
function mapAlert({ text, codingSystem, valueParts }) {
  if ((text || '').trim() !== 'Alarm') return null;
  const label = valueParts?.[0];
  if (!label || !label.trim()) return null;
  const severity = (codingSystem || '').trim();
  return { name: severity ? `Alarm (${severity})` : 'Alarm', label: label.trim() };
}

module.exports = {
  deviceType: 'AviIW6000',
  mapObservation,
  classify,
  mapAlert,
};
