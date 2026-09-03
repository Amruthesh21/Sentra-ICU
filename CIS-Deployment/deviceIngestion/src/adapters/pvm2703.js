const { safeLookup } = require('../core/safeLookup');

/**
 * Adapter: Nihon Kohden PVM-2703 patient monitor
 * ---------------------------------------------------
 * Learned from a real captured HL7 export (see
 * E:\RTWO - Workspace\Deployment\Simulation\deviceData\PVM2703Device.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source).
 *
 * Quirks specific to this model:
 *  - OBX-3's second token carries a literal "VITAL " prefix baked into the
 *    field name itself ("001000^VITAL HR", not "001000^HR") — stripped
 *    here before matching.
 *  - Several fields are duplicated under an "r"-prefixed variant
 *    ("rRESP(co2)", "rPR(spo2)") alongside the primary reading — mapped to
 *    distinct secondary names rather than overwriting the primary reading,
 *    so both are visible without claiming there are two independent
 *    respiration/pulse rates.
 */

const CANONICAL_NAME_MAP = {
  HR: 'HeartRate',
  'SpO2': 'SpO2',
  'PR(spo2)': 'Pulse',
  'RESP(co2)': 'Resp.Rate',
  TEMP: 'Temp1',
  VPC: 'Ventricular Premature Complexes',
  ST2: 'ST-II',
  STecg1: 'ST ECG1',
  'EtCO2': 'EtCO2',
  'FiCO2': 'FiCO2',
  'APSEC(CO2)': 'Apnea Time (CO2)',
  'APSEC(RESP)': 'Apnea Time (Resp)',
  'rRESP(co2)': 'Resp.Rate (redundant channel)',
  'rPR(spo2)': 'Pulse (redundant channel)',
};

const PRIMARY_VITALS = new Set(['HeartRate', 'Pulse', 'SpO2', 'Resp.Rate', 'Temp1']);

function mapObservation({ text, rawValue, rawUnitField }) {
  const vendorName = (text || '').trim().replace(/^VITAL\s+/, '');
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

module.exports = {
  deviceType: 'PVM2703',
  mapObservation,
  classify,
};
