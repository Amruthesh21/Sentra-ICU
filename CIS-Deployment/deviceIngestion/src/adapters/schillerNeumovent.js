const { safeLookup } = require('../core/safeLookup');

/**
 * Adapter: Schiller (Tecme) Neumovent ventilator
 * ---------------------------------------------------
 * Learned from a real captured HL7 export (see
 * legacy device-simulator capture SchillerNeumoventDevice.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source).
 *
 * Quirks specific to this model:
 *  - OBX-3 is "code^Name^99NVT" — name is the second token, same position
 *    as M10, just a different coding system tag.
 *  - Configured targets/thresholds ride on the same OBX stream as real
 *    readings, distinguished only by a literal "Setting: " / "Alarm
 *    Setting: " prefix baked into the name itself (not a separate
 *    category token like the Avi devices) — those are dropped here, not
 *    published as if they were live readings.
 *  - "-1" means "no data" for at least one field (O2 Percent) — same
 *    sentinel convention as M10, confirmed in this device's own captured
 *    output.
 *  - Alerts arrive as three separate CE observations describing one event
 *    (ALARM ID / ALARM STATE / ALARM PRIORITY) rather than one
 *    self-contained alert — each is surfaced individually; there's no
 *    correlation id in this device's output to merge them.
 */

const CANONICAL_NAME_MAP = {
  'Resp Rate': 'Resp.Rate',
  'O2 Percent': 'FiO2',
  'Minute Volume': 'Ventilator Minute Volume',
  'P Mean': 'Ventilator Pmean',
  PEEP: 'Ventilator PEEP',
  'Mandatory Minute Volume': 'Ventilator Mandatory Minute Volume',
  'Spontaneous Minute Volume': 'Ventilator Spontaneous Minute Volume',
  'Spontaneous Resp Rate': 'Ventilator Spontaneous Resp Rate',
  'Expiratory Time Constant': 'Ventilator Expiratory Time Constant',
  'Dynamic Compliance': 'Ventilator Dynamic Compliance',
  'P Peak': 'Ventilator Ppeak',
  'P Plateau': 'Ventilator Pplat',
  'Peak Flow': 'Ventilator Peak Flow',
  Ti: 'Ventilator Tinsp',
  Te: 'Ventilator Texp',
  'Tidal Volume': 'Ventilator Tidal Volume',
};

const PRIMARY_VITALS = new Set(['Resp.Rate']);
const NO_DATA_SENTINEL = '-1';

function mapObservation({ text, rawValue, rawUnitField }) {
  const vendorName = (text || '').trim();
  if (/^(Alarm )?Setting:/.test(vendorName)) return null; // configured target, not a reading

  const canonicalName = safeLookup(CANONICAL_NAME_MAP, vendorName);
  if (!canonicalName) return null;

  const trimmedValue = (rawValue ?? '').toString().trim();
  if (trimmedValue === '' || trimmedValue === NO_DATA_SENTINEL) return null;

  const numeric = Number(trimmedValue);
  if (Number.isNaN(numeric)) return null;

  // unit field is itself "code^description^UCUM" — the real unit text is
  // the second token (e.g. "cm[H2O]^centimeter of water^UCUM" -> "centimeter
  // of water" reads oddly on a UI; prefer the first, terser token instead).
  const unitParts = (rawUnitField || '').split('^');
  const unit = unitParts[0] || '';

  return { name: canonicalName, unit, value: numeric };
}

function classify(canonicalName) {
  return PRIMARY_VITALS.has(canonicalName) ? 'primary' : 'secondary';
}

function mapAlert({ text, valueParts }) {
  const label = valueParts?.[1] || valueParts?.[0];
  if (!label || !label.trim()) return null;
  return { name: text || 'alert', label: label.trim() };
}

module.exports = {
  deviceType: 'SchillerNeumovent',
  mapObservation,
  classify,
  mapAlert,
};
