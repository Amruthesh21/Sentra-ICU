/**
 * Adapter: Philips SureSigns VM spot-check monitor
 * -------------------------------------------------------
 * Learned from a real captured HL7 export (see
 * E:\RTWO - Workspace\Deployment\Simulation\deviceData\VmDevice.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source).
 *
 * Same MDIL coding dialect as g40.js (Philips family): OBX-3 is
 * "MDIL-code^Name^MDIL", name is the second token, unit field is itself
 * vendor-coded the same way. "YSI" is this device's name for its
 * thermistor temperature probe reading. "ABPs/ABPd/ABPm" here are this
 * spot-check monitor's own labels for the same systolic/diastolic/mean
 * blood-pressure reading other devices call NIBP — mapped to the same
 * canonical NIBP names for consistency.
 */

const CANONICAL_NAME_MAP = {
  HR: 'HeartRate',
  SpO2: 'SpO2',
  SpO2_Pulse: 'Pulse',
  Resp: 'Resp.Rate',
  RESP: 'Resp.Rate',
  YSI: 'Temp1',
  Temp1: 'Temp1',
  Temp2: 'Temp2',
  'ST-II': 'ST-II',
  ABPs: 'NIBP Sys',
  ABPd: 'NIBP Dia',
  ABPm: 'NIBP Mean',
  IBP1_IPs: 'IBP1 Sys',
  IBP1_IPd: 'IBP1 Dia',
  IBP1_IPm: 'IBP1 Mean',
  IBP2_IPs: 'IBP2 Sys',
  IBP2_IPd: 'IBP2 Dia',
  IBP2_IPm: 'IBP2 Mean',
};

const PRIMARY_VITALS = new Set(['HeartRate', 'Pulse', 'SpO2', 'Resp.Rate', 'Temp1', 'NIBP Sys', 'NIBP Dia']);

function mapObservation({ text, rawValue, rawUnitField }) {
  const vendorName = (text || '').trim();
  const canonicalName = CANONICAL_NAME_MAP[vendorName];
  if (!canonicalName) return null;

  const trimmedValue = (rawValue ?? '').toString().trim();
  if (trimmedValue === '') return null;

  const numeric = Number(trimmedValue);
  if (Number.isNaN(numeric)) return null;

  const unitParts = (rawUnitField || '').split('^');
  const unit = unitParts[1] || unitParts[0] || '';

  return { name: canonicalName, unit, value: numeric };
}

function classify(canonicalName) {
  return PRIMARY_VITALS.has(canonicalName) ? 'primary' : 'secondary';
}

module.exports = {
  deviceType: 'VmDevice',
  mapObservation,
  classify,
};
