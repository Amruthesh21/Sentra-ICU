/**
 * Core HL7 v2 parser — device-agnostic.
 * ---------------------------------------
 * Splits a raw HL7 message into segments/fields and dispatches OBX
 * observations by their value-type (NM numeric, CE coded, CD channel
 * definition, NA numeric array/waveform). This module does NOT decide what
 * a value *means* for a particular device — it hands each observation to a
 * device adapter (see adapters/) for that. Concretely, this module never:
 *   - decides a raw value is a "no data" sentinel (e.g. "-1")
 *   - decides which token in a coded field is the human-readable name
 *   - maps a vendor code to a canonical vital name
 * Those are exactly the per-device-model quirks task 2 asks to isolate —
 * see adapters/deviceAdapter.md for the contract every adapter implements.
 *
 * NA (numeric array) + CD (channel definition) are standard HL7 v2 waveform
 * datatypes, not vendor-specific — so the scale-factor decode here is a
 * reasonable default core behavior. An adapter can still override it via
 * `decodeWaveformMeta` if a device's CD layout differs.
 */

const { toIsoTimestamp } = require('./hl7Timestamp');

function splitSegments(rawMessage) {
  return String(rawMessage)
    .split(/\r\n|\r|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Default HL7-standard CD segment interpretation: OBX-5 = code^name^scale&unit^...^sampleRate */
function defaultDecodeWaveformMeta(name, obx5) {
  const parts = String(obx5 || '').split('^');
  const scaleAndUnit = (parts[2] || '').split('&');
  return {
    channel: name,
    scale: parseFloat(scaleAndUnit[0]) || 1,
    unit: scaleAndUnit[1] || '',
    sampleRate: parseInt(parts[4], 10) || null,
  };
}

/**
 * Parses one raw HL7 message into a generic, adapter-agnostic structure.
 *
 * @param {string} rawMessage
 * @param {{decodeWaveformMeta?: Function}} [adapterHooks]
 * @returns {{
 *   timestamp: string,
 *   patientId: string|null,
 *   observations: Array<{obsType: string, code: string, text: string, codingSystem: string,
 *                         rawValue: string, rawUnitField: string, obx5: string}>,
 *   alerts: Array<{code: string, text: string, codingSystem: string, valueParts: string[]}>,
 *   waveforms: Record<string, {unit: string, sampleRate: number|null, samples: number[]}>,
 * }}
 */
function parseHl7Message(rawMessage, adapterHooks = {}) {
  const decodeWaveformMeta = adapterHooks.decodeWaveformMeta || defaultDecodeWaveformMeta;
  const segments = splitSegments(rawMessage);

  const result = {
    timestamp: new Date().toISOString(),
    patientId: null,
    observations: [],
    alerts: [],
    waveforms: {},
  };

  let pendingWaveformMeta = null;

  for (const seg of segments) {
    const f = seg.split('|');
    const segId = f[0];

    if (segId === 'MSH' && f[6]) result.timestamp = toIsoTimestamp(f[6]);
    if (segId === 'PID') result.patientId = f[3] || null;

    if (segId !== 'OBX') continue;

    const obsType = f[2];
    const idParts = (f[3] || '').split('^');
    const [code = '', text = '', codingSystem = ''] = idParts;
    const obx5 = f[5];
    const rawUnitField = f[6] || '';

    if (obsType === 'NM') {
      result.observations.push({
        obsType, code, text, codingSystem,
        rawValue: obx5, rawUnitField, obx5,
      });
    } else if (obsType === 'CE' || obsType === 'CWE') {
      // CE (Coded Entry) and CWE (Coded With Exceptions) are both standard
      // HL7 v2 coded-value datatypes — CWE is CE's superset, differing only
      // in fields (original text, coding system version) this service
      // doesn't read. Treating them identically here is a core-level
      // datatype fix, not a device-specific quirk (some devices, e.g. a
      // neonatal incubator's alarm fields, use CWE where others use CE for
      // the same kind of alert observation).
      const codeParts = (obx5 || '').split('^');
      result.alerts.push({ code, text, codingSystem, valueParts: codeParts });
    } else if (obsType === 'CD') {
      pendingWaveformMeta = decodeWaveformMeta(text || code, obx5);
    } else if (obsType === 'NA') {
      const raw = (obx5 || '').split('^').filter((s) => s !== '');
      const meta = pendingWaveformMeta || { channel: text || code, scale: 1, unit: '', sampleRate: null };
      const samples = raw.map((v) => +(Number(v) * meta.scale).toFixed(5));
      result.waveforms[meta.channel] = { unit: meta.unit, sampleRate: meta.sampleRate, samples };
      pendingWaveformMeta = null;
    }
    // Other OBX value types (ST, TX, etc.) are ignored for now — not part of
    // the vitals/alerts/waveform contract this service publishes.
  }

  return result;
}

module.exports = { parseHl7Message, splitSegments, defaultDecodeWaveformMeta };
