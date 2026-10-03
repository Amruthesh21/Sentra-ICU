const { safeLookup } = require('../core/safeLookup');

/**
 * Adapter: BPL Acura S1 syringe pump
 * -------------------------------------
 * Learned from a real captured HL7 export (see
 * legacy device-simulator capture BPLAcuraS1Device.data,
 * a device simulator folder the user separately confirmed rights to — not
 * Connect Engine's server source, and not referenced for anything beyond
 * this one capture file's raw protocol bytes).
 *
 * Quirks specific to this model:
 *  - OBX-3 is a plain "code^Name" pair (no third "coding system" token) —
 *    core's generic split already handles this fine (`codingSystem` just
 *    comes back empty).
 *  - This is an infusion pump, not a patient monitor — none of its fields
 *    are vitals alarm-engine threshold-checks (HeartRate, SpO2, etc.).
 *    Everything published here is secondary/informational only.
 *  - Several fields are non-numeric operational status (DrugName,
 *    PumpStatus, Occlusion, SyringeBrand, PumpMode) — dropped, same as the
 *    M10 adapter drops any observation whose value doesn't parse as a
 *    number (this DeviceDataMessage contract's value field is numeric).
 */

const CANONICAL_NAME_MAP = {
  Rate: 'Pump Rate',
  InfuseTime: 'Infuse Time',
  InfuseTimeLeft: 'Infuse Time Left',
  TotalVolume: 'Pump Total Volume',
  SyringeSize: 'Syringe Size',
  VTBI: 'Pump VTBI',
  BolusRate: 'Bolus Rate',
  BolusVTBI: 'Bolus VTBI',
  BolusVOL: 'Bolus Volume',
  PurgeRate: 'Purge Rate',
  Dose: 'Pump Dose',
  Weight: 'Pump Weight Setting',
};

function mapObservation({ text, rawValue, rawUnitField }) {
  const vendorName = (text || '').trim();
  const canonicalName = safeLookup(CANONICAL_NAME_MAP, vendorName);
  if (!canonicalName) return null; // unknown or non-numeric status field — drop rather than guess

  const trimmedValue = (rawValue ?? '').toString().trim();
  if (trimmedValue === '') return null;

  const numeric = Number(trimmedValue);
  if (Number.isNaN(numeric)) return null;

  return { name: canonicalName, unit: rawUnitField || '', value: numeric };
}

// No field here is one of alarm-engine's threshold-checked vitals — this
// device has nothing "primary" to report.
function classify() {
  return 'secondary';
}

module.exports = {
  deviceType: 'BplAcuraS1',
  mapObservation,
  classify,
};
