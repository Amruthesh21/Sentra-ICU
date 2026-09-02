/**
 * Adapter: Draeger Savina 300 ventilator (JSON protocol)
 * -----------------------------------------------------------
 * Learned from a real captured export (see
 * E:\RTWO - Workspace\Deployment\Simulation\deviceData\DraegerSavina300Device.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source).
 *
 * Quirk specific to this model, and the reason its canonical map is
 * deliberately small: unlike evitaV600.js (same vendor family), this
 * device does NOT separate measured readings from configured settings
 * into different groups — everything rides on the same flat top-level
 * object, and which "kind" a given message is (a real reading vs. a
 * settings snapshot vs. a device-status/mode message) is only inferable
 * from *which keys happen to be present*, with no explicit type field.
 * Confirmed by inspecting this device's own captured output: some
 * messages carry Mean_airway_pressure/Peak_inspiratory_pressure/
 * Respiratory_rate (clearly live readings); others carry
 * Inspiratory_tidal_volume_L/IE_I_part/Apnea_alarm_time (clearly
 * configured targets, using the same field-naming style). Only field
 * names confirmed as appearing in a genuine live-reading message are
 * mapped here — anything only ever seen in a settings-flavored message is
 * deliberately left unmapped, accepting that on rare occasions a settings
 * snapshot could reuse one of these exact key names as a target value
 * rather than a reading. That's a real data-quality limitation of this
 * device's own protocol, not something this adapter can fully resolve
 * without an explicit message-type field the device doesn't send.
 */

const CANONICAL_NAME_MAP = {
  Respiratory_rate: 'Resp.Rate',
  Spontaneous_respiratory_rate: 'Ventilator Spontaneous Resp Rate',
  Mean_airway_pressure: 'Ventilator Pmean',
  Peak_inspiratory_pressure: 'Ventilator Ppeak',
  Inspiratory_peak_flow: 'Ventilator Peak Flow',
  Inspiratory_oxygen_fraction: 'FiO2',
};

const PRIMARY_VITALS = new Set(['Resp.Rate']);

function parseObservations(rawJsonMessage) {
  let msg;
  try {
    msg = JSON.parse(rawJsonMessage);
  } catch (err) {
    return { timestamp: new Date().toISOString(), patientId: null, observations: [], alerts: [], waveforms: {} };
  }

  const observations = Object.entries(msg)
    .filter(([key]) => key !== 'BedIp' && key !== 'Mode')
    .map(([key, value]) => ({ text: key, rawValue: value }));

  return {
    timestamp: new Date().toISOString(), // this device's own capture carries no timestamp field
    patientId: null,
    observations,
    alerts: [],
    waveforms: {},
  };
}

function mapObservation({ text, rawValue }) {
  const canonicalName = CANONICAL_NAME_MAP[text];
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
  deviceType: 'DraegerSavina300',
  parseObservations,
  mapObservation,
  classify,
};
