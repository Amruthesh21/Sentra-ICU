const { safeLookup } = require('../core/safeLookup');

/**
 * Adapter: Philips MX550 patient monitor (JSON protocol)
 * -----------------------------------------------------------
 * Learned from a real captured export (see
 * E:\RTWO - Workspace\Deployment\Simulation\deviceData\MX550Device.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source).
 *
 * This device's own JSON shape: a flat top-level object using real IEEE
 * 11073 medical-device nomenclature as keys (e.g. "NOM_ECG_CARD_BEAT_RATE",
 * a real standard, not a vendor-invented code) — but every value, including
 * scalars, is wrapped in a single-element array ("NOM_TEMP":["37"]), plus
 * two raw waveform sample arrays ("ECG", "PLETH", not surfaced here —
 * Phase 2/best-effort, same as HL7 waveform handling). "-" (not a number)
 * means "no data" for at least the ST-segment amplitude fields — same
 * "-1 means no data" spirit as M10's sentinel, just a different literal.
 */

const CANONICAL_NAME_MAP = {
  NOM_ECG_CARD_BEAT_RATE: 'HeartRate',
  NOM_PULS_OXIM_SAT_O2: 'SpO2',
  NOM_PRESS_BLD_NONINV_PULS_RATE: 'Pulse',
  NOM_PRESS_BLD_NONINV_SYS: 'NIBP Sys',
  NOM_PRESS_BLD_NONINV_DIA: 'NIBP Dia',
  NOM_PRESS_BLD_NONINV_MEAN: 'NIBP Mean',
  NOM_TEMP: 'Temp1',
  NOM_ECG_AMPL_ST_I: 'ST-I',
  NOM_ECG_AMPL_ST_II: 'ST-II',
  NOM_ECG_AMPL_ST_III: 'ST-III',
  NOM_ECG_AMPL_ST_AVR: 'ST-aVR',
  NOM_ECG_AMPL_ST_AVL: 'ST-aVL',
  NOM_ECG_AMPL_ST_AVF: 'ST-aVF',
  NOM_ECG_AMPL_ST_V2: 'ST-V2',
  NOM_ECG_AMPL_ST_V5: 'ST-V5',
};

const PRIMARY_VITALS = new Set(['HeartRate', 'Pulse', 'SpO2', 'NIBP Sys', 'NIBP Dia', 'Temp1']);
const NO_DATA_SENTINEL = '-';

// Fields carrying raw waveform sample arrays, not scalar vitals — never
// treated as observations regardless of the canonical map above.
const WAVEFORM_FIELDS = new Set(['ECG', 'PLETH']);

function flatten(msg) {
  const observations = [];
  for (const [key, value] of Object.entries(msg)) {
    if (WAVEFORM_FIELDS.has(key) || key === 'BedIp') continue;
    const scalar = Array.isArray(value) ? value[0] : value;
    observations.push({ text: key, rawValue: scalar });
  }
  return observations;
}

function parseObservations(rawJsonMessage) {
  let msg;
  try {
    msg = JSON.parse(rawJsonMessage);
  } catch (err) {
    return { timestamp: new Date().toISOString(), patientId: null, observations: [], alerts: [], waveforms: {} };
  }

  return {
    timestamp: new Date().toISOString(), // this device's own capture carries no timestamp field
    patientId: null,
    observations: flatten(msg),
    alerts: [],
    waveforms: {},
  };
}

function mapObservation({ text, rawValue }) {
  const canonicalName = safeLookup(CANONICAL_NAME_MAP, text);
  if (!canonicalName) return null;

  const trimmedValue = (rawValue ?? '').toString().trim();
  if (trimmedValue === '' || trimmedValue === NO_DATA_SENTINEL) return null;

  const numeric = Number(trimmedValue);
  if (Number.isNaN(numeric)) return null;

  return { name: canonicalName, unit: '', value: numeric };
}

function classify(canonicalName) {
  return PRIMARY_VITALS.has(canonicalName) ? 'primary' : 'secondary';
}

module.exports = {
  deviceType: 'MX550',
  parseObservations,
  mapObservation,
  classify,
};
