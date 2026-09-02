/**
 * Adapter: Mindray Beneview T5 patient monitor
 * ---------------------------------------------------
 * Learned from a real captured HL7 export (see
 * E:\RTWO - Workspace\Deployment\Simulation\deviceData\MindrayBeneviewt5Device.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source).
 *
 * Dialect: OBX-3 is a plain "code^Name" pair (name = second token, same
 * position as M10). No unit field at all in this device's captured
 * output — always blank, passed through as-is.
 */

const CANONICAL_NAME_MAP = {
  HR: 'HeartRate',
  RR: 'Resp.Rate',
  SpO2: 'SpO2',
  PR: 'Pulse',
  Sys: 'NIBP Sys',
  Dia: 'NIBP Dia',
  Mean: 'NIBP Mean',
};

const PRIMARY_VITALS = new Set(['HeartRate', 'Pulse', 'SpO2', 'Resp.Rate', 'NIBP Sys', 'NIBP Dia']);

function mapObservation({ text, rawValue, rawUnitField }) {
  const vendorName = (text || '').trim();
  const canonicalName = CANONICAL_NAME_MAP[vendorName];
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
  deviceType: 'MindrayBeneviewT5',
  mapObservation,
  classify,
};
