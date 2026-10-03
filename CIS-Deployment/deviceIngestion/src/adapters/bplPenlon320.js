const { safeLookup } = require('../core/safeLookup');

/**
 * Adapter: BPL Penlon 320 anesthesia workstation
 * ---------------------------------------------------
 * Learned from a real captured HL7 export (see
 * legacy device-simulator capture BplPenlon320Device.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source).
 *
 * Quirks specific to this model:
 *  - Its very first few captured messages are a connection handshake with
 *    a different, sparser layout (no real OBX-5 value) — the real vitals
 *    stream that follows uses a plain "code^Name" OBX-3 (name is the
 *    second token, same as M10), with value/unit in the standard
 *    positions core already extracts.
 *  - Unlike M10, the unit field (OBX-6) is a plain string ("cmH2O", "mL",
 *    "bpm") — not itself vendor-coded with ^ — so it's used as-is, no
 *    second-token split needed.
 *  - Declares UTF-8 in MSH-18 and genuinely uses it: several vendor field
 *    names contain a real Unicode subscript two (U+2082, "₂") — e.g.
 *    "SpO₂", "FiO₂", "EtCO₂" — not the ASCII digit "2". The canonical map
 *    below matches the exact characters the device sends.
 *  - "f" is this device's (anesthesia-ventilator convention) name for
 *    respiratory rate/frequency — maps to the same canonical Resp.Rate
 *    every other device uses.
 */

const CANONICAL_NAME_MAP = {
  'SpO₂': 'SpO2',
  Pulse: 'Pulse',
  f: 'Resp.Rate',
  PEEP: 'Ventilator PEEP',
  Ppeak: 'Ventilator Ppeak',
  Pplat: 'Ventilator Pplat',
  Pmean: 'Ventilator Pmean',
  VTe: 'Ventilator VTe',
  VTi: 'Ventilator VTi',
  MV: 'Ventilator MV',
  MVspn: 'Ventilator Spontaneous MV',
  fspn: 'Ventilator Spontaneous Resp Rate',
  Cdyn: 'Ventilator Compliance',
  'EtCO₂': 'EtCO2',
  'FiCO₂': 'FiCO2',
  'FiO₂': 'FiO2',
  PI: 'Perfusion Index',
};

const PRIMARY_VITALS = new Set(['SpO2', 'Pulse', 'Resp.Rate']);

function mapObservation({ text, rawValue, rawUnitField }) {
  const vendorName = (text || '').trim();
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

// This device's alert is a single CE observation ("NO ABSORBER?!!") with no
// OBX-3 name at all in the handshake-adjacent messages that carry it —
// pass the raw label through unchanged.
function mapAlert({ valueParts }) {
  const label = valueParts?.[1] || valueParts?.[0];
  if (!label || !label.trim()) return null;
  return { name: 'alert', label: label.trim() };
}

module.exports = {
  deviceType: 'BplPenlon320',
  mapObservation,
  classify,
  mapAlert,
};
