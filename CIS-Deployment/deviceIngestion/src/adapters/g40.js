/**
 * Adapter: Philips Goldway G40 patient monitor
 * ---------------------------------------------------
 * Learned from a real captured HL7 export (see
 * E:\RTWO - Workspace\Deployment\Simulation\deviceData\G40Device.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source).
 *
 * Dialect: OBX-3 is "MDIL-code^Name^MDIL" (name = second token, same
 * position as M10's BHC coding — just a different coding system). The unit
 * field is itself vendor-coded the same way ("0004-0aa0^bpm^MDIL") — unit
 * is the second token there too, same quirk as M10's unit field.
 */

const CANONICAL_NAME_MAP = {
  HR: 'HeartRate',
  RESP: 'Resp.Rate',
  SpO2: 'SpO2',
  SpO2_Pulse: 'Pulse',
  Temp1: 'Temp1',
  Temp2: 'Temp2',
  'ST-II': 'ST-II',
  IBP1_IPs: 'IBP1 Sys',
  IBP1_IPd: 'IBP1 Dia',
  IBP1_IPm: 'IBP1 Mean',
  IBP2_IPs: 'IBP2 Sys',
  IBP2_IPd: 'IBP2 Dia',
  IBP2_IPm: 'IBP2 Mean',
};

const PRIMARY_VITALS = new Set(['HeartRate', 'Pulse', 'SpO2', 'Resp.Rate', 'Temp1']);

function mapObservation({ text, rawValue, rawUnitField }) {
  const vendorName = (text || '').trim();
  const canonicalName = CANONICAL_NAME_MAP[vendorName];
  if (!canonicalName) return null;

  const trimmedValue = (rawValue ?? '').toString().trim();
  if (trimmedValue === '') return null;

  const numeric = Number(trimmedValue);
  if (Number.isNaN(numeric)) return null;

  // unit^unit^MDIL — unit is the second token, same quirk as M10.
  const unitParts = (rawUnitField || '').split('^');
  const unit = unitParts[1] || unitParts[0] || '';

  return { name: canonicalName, unit, value: numeric };
}

function classify(canonicalName) {
  return PRIMARY_VITALS.has(canonicalName) ? 'primary' : 'secondary';
}

module.exports = {
  deviceType: 'G40',
  mapObservation,
  classify,
};
