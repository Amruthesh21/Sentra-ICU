/**
 * Adapter: BPL VividVue M10 patient monitor
 * --------------------------------------------
 * Everything below was learned by capturing and replaying REAL output from
 * this device (see the prototype README this was ported from) — not from
 * any Connect Engine / BPLCortexICU source code. Quirks specific to this
 * model, isolated here per the adapter contract (see deviceAdapter.md) so
 * onboarding a different model never touches core/hl7Parser.js:
 *
 *  - Vendor-coded fields, not LOINC/MDC: OBX-3 looks like "201^HR^BHC" —
 *    the human-readable name is the SECOND token ("HR"), not the numeric
 *    code. core/hl7Parser.js already exposes this as `text`.
 *  - Unit field follows the same shape ("51^bpm^BHC") — unit is also the
 *    second token, but core hands it over unsplit (`rawUnitField`) since
 *    that split is this device's own quirk, not a generic one.
 *  - "-1" means "no data" (sensor off / no reading), not literally -1.
 *  - Housekeeping fields (Height, Weight, Blood, Pace) are not vitals —
 *    dropped, not published.
 *  - Waveforms (ECG/SPO2/RESP) genuinely do stream over HL7 for this
 *    device, as standard HL7 NA/CD segments — no adapter override needed,
 *    core's default CD/NA decode handles it.
 */

// Vendor observation name -> canonical vital name. Canonical names must
// match what alarm-engine's threshold checking and the Hub UI already
// recognize — see AlarmCheckService.ALIAS_GROUPS and
// BedVirtualVitalsService's primary attribute names in alarmEngine.
const CANONICAL_NAME_MAP = {
  HR: 'HeartRate',
  PR: 'Pulse', // pulse rate from the SpO2 probe — alarm-engine treats Pulse as a HeartRate alias
  SPO2: 'SpO2',
  RR: 'Resp.Rate',
  'NIBP S': 'NIBP Sys',
  Sys: 'NIBP Sys', // demo-mode capture uses this shorter label for the same field
  'NIBP D': 'NIBP Dia',
  Dia: 'NIBP Dia',
  'NIBP M': 'NIBP Mean',
  Mean: 'NIBP Mean',
  'NIBP PR': 'NIBP PR',
  'NIBP SDP': 'NIBP SDP',
  PI: 'Perfusion Index',
  PVCs: 'PVCs',
  T01: 'Temp1',
  T02: 'Temp2',
  CO2Et: 'EtCO2',
  CO2Fi: 'FiCO2',
  awRR: 'awRR',
};

// Not vitals — demographic/config fields that happen to ride on OBX|NM in
// this device's stream. Explicitly dropped rather than silently mis-mapped.
const NON_VITAL_FIELDS = new Set(['Height', 'Weight', 'Blood', 'Pace']);

// Canonical vitals the alarm engine threshold-checks (see AlarmCheckService
// ALIAS_GROUPS / individual threshold checks in alarmEngine). Everything
// else recognized above is still published, just as secondary/informational.
const PRIMARY_VITALS = new Set([
  'HeartRate', 'Pulse', 'SpO2', 'Resp.Rate', 'Temp1',
  'NIBP Sys', 'NIBP Dia',
]);

const NO_DATA_SENTINEL = '-1';

function mapObservation({ text, rawValue, rawUnitField }) {
  const vendorName = (text || '').trim();
  if (NON_VITAL_FIELDS.has(vendorName)) return null;

  const canonicalName = CANONICAL_NAME_MAP[vendorName];
  if (!canonicalName) return null; // unknown field — drop rather than guess

  const trimmedValue = (rawValue ?? '').toString().trim();
  if (trimmedValue === '' || trimmedValue === NO_DATA_SENTINEL) return null;

  const numeric = Number(trimmedValue);
  if (Number.isNaN(numeric)) return null;

  // unit^unit^system — unit is the second token, same quirk as the name field.
  const unitParts = (rawUnitField || '').split('^');
  const unit = unitParts[1] || unitParts[0] || '';

  return { name: canonicalName, unit, value: numeric };
}

function classify(canonicalName) {
  return PRIMARY_VITALS.has(canonicalName) ? 'primary' : 'secondary';
}

// Alerts have no home in the current DeviceDataMessage contract (it carries
// no alerts field, and that contract is explicitly not to be changed) — the
// server surfaces these on GET /api/status for visibility instead of
// publishing them. Pass the vendor's own text through unchanged.
function mapAlert({ text, valueParts }) {
  const label = valueParts?.[1] || valueParts?.[0];
  if (!label || !label.trim()) return null;
  return { name: text || 'alert', label: label.trim() };
}

module.exports = {
  deviceType: 'BplVividVueM10',
  mapObservation,
  classify,
  mapAlert,
};
