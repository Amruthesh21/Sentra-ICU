const { safeLookup } = require('../core/safeLookup');

/**
 * Adapter: BPL VividVue M12 patient monitor
 * ----------------------------------------------
 * Learned from a real captured HL7 export (see
 * E:\RTWO - Workspace\Deployment\Simulation\deviceData\BplVividVue12Device.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source).
 *
 * A sibling model to the BPL VividVue M10 this project's first adapter was
 * built for, but a genuinely different dialect — not just a different code
 * table: OBX-3 uses real LOINC codes ("8867-4^HEART_BEAT^LN"), not M10's
 * vendor "BHC" coding, and there's no "-1 means no data" sentinel observed
 * in this device's captured output (zero really means zero here). Field
 * position is otherwise identical to M10's (name = second token, value at
 * OBX-5, unit at OBX-6, unit itself a plain string not further coded) —
 * core's generic extraction and default CD/NA waveform decode both apply
 * unchanged; this device also streams an ECG waveform channel the same
 * standard way M10 does.
 */

const CANONICAL_NAME_MAP = {
  HEART_BEAT: 'HeartRate',
  OXYGEN_SATURATION: 'SpO2',
  Pulse_rate: 'Pulse',
  Respiration_rate: 'Resp.Rate',
  Airway_Respiration_rate: 'Airway Resp Rate',
  Systolic_blood_pressure: 'NIBP Sys',
  Diastolic_blood_pressure: 'NIBP Dia',
  Mean_blood_pressure: 'NIBP Mean',
  Body_temperature_T1: 'Temp1',
  Body_temperature_T2: 'Temp2',
  Systolic_blood_pressure_IBP1: 'IBP1 Sys',
  Diastolic_blood_pressure_IBP1: 'IBP1 Dia',
  Mean_blood_pressure_IBP1: 'IBP1 Mean',
  Systolic_blood_pressure_IBP2: 'IBP2 Sys',
  Diastolic_blood_pressure_IBP2: 'IBP2 Dia',
  Mean_blood_pressure_IBP2: 'IBP2 Mean',
  Carbon_dioxide_at_end_expiration: 'EtCO2',
  Carbon_dioxide_during_inspiration: 'FiCO2',
};

const PRIMARY_VITALS = new Set([
  'HeartRate', 'Pulse', 'SpO2', 'Resp.Rate', 'Temp1', 'NIBP Sys', 'NIBP Dia',
]);

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

module.exports = {
  deviceType: 'BplVividVue12',
  mapObservation,
  classify,
};
