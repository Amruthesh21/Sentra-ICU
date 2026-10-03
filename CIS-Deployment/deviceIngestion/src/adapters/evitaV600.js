const { safeLookup } = require('../core/safeLookup');

/**
 * Adapter: Draeger Evita V600 ventilator (JSON protocol)
 * -----------------------------------------------------------
 * Learned from a real captured export (see
 * legacy device-simulator capture EvitaV600Device.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source).
 *
 * This device's own JSON shape: a flat top-level object with three nested
 * groups — { BedIp, parametersCP1: {...}, parametersCP2: {...},
 * deviceSettings: {...} }. parametersCP1/CP2 hold real measured readings
 * (both groups just split a long field list across two pages on the
 * device's own display, nothing more); deviceSettings holds configured
 * targets, not readings — excluded here, same principle as HL7 devices
 * that mark config fields with a "Setting" category/prefix.
 */

const CANONICAL_NAME_MAP = {
  Respiratory_rate: 'Resp.Rate',
  Spontaneous_respiratory_rate: 'Ventilator Spontaneous Resp Rate',
  Inspiratory_oxygen_fraction: 'FiO2',
  Positive_endexpiratory_pressure: 'Ventilator PEEP',
  Peak_inspiratory_pressure: 'Ventilator Ppeak',
  Plateau_pressure: 'Ventilator Pplat',
  Mean_airway_pressure: 'Ventilator Pmean',
  Minute_volume: 'Ventilator Minute Volume',
  Tidal_volume: 'Ventilator Tidal Volume',
  Dynamic_compliance: 'Ventilator Dynamic Compliance',
  Resistance: 'Ventilator Resistance',
  Expiratory_minute_volume: 'Ventilator Expiratory Minute Volume',
  Inspiratory_minute_volume: 'Ventilator Inspiratory Minute Volume',
};

const PRIMARY_VITALS = new Set(['Resp.Rate']);

function flatten(msg) {
  const observations = [];
  for (const group of [msg.parametersCP1, msg.parametersCP2]) {
    if (!group) continue;
    for (const [key, value] of Object.entries(group)) {
      observations.push({ text: key, rawValue: value });
    }
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
  if (trimmedValue === '') return null;

  const numeric = Number(trimmedValue);
  if (Number.isNaN(numeric)) return null;

  return { name: canonicalName, unit: '', value: numeric };
}

function classify(canonicalName) {
  return PRIMARY_VITALS.has(canonicalName) ? 'primary' : 'secondary';
}

module.exports = {
  deviceType: 'EvitaV600',
  parseObservations,
  mapObservation,
  classify,
};
