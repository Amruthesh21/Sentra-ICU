/**
 * Adapter: Philips IntelliVue patient monitor (JSON protocol)
 * -------------------------------------------------------------
 * Learned from a real captured export (see
 * E:\RTWO - Workspace\Deployment\Simulation\deviceData\IntelliVueDevice.data —
 * device simulator folder, rights confirmed separately from Connect
 * Engine's server source, not referenced for anything beyond this file's
 * raw protocol bytes).
 *
 * This device's own JSON shape (not shared with any other JSON-speaking
 * device — see deviceAdapter.md on why JSON adapters own their whole
 * parse, not just name-mapping):
 *   { ts (unix epoch seconds), bedIp, message, device, config, alarms,
 *     curves: { ecg: { ecg2: { res, values } } },
 *     params?: { resp: {resp, disconnected}, ecg: {heartRate, st1..stV5, disconnected},
 *                oxi: {spo2, heartRate, disconnected}, bp: {systolic, diastolic, mean, disconnected},
 *                temp: {temp1, disconnected1, disconnected2}, ibp: {disconnected1},
 *                cap: {disconnected}, others: {pressBldNoninvPulsRate, pulsOximPerfRel} } }
 * `params` (the real scalar vitals) is only present on some messages — many
 * carry only a waveform frame (`curves`) with no `params` at all, confirmed
 * across this device's own captured output. Each vitals category has its
 * own explicit `disconnected`/`disconnectedN` flag — this device tells you
 * directly when a channel has no real reading, rather than a sentinel
 * value like M10's "-1"; skip publishing for any disconnected category.
 * `curves` (the ECG waveform) is not surfaced here — Phase 2/best-effort,
 * same as HL7 waveform handling, not part of this contract.
 */

function flatten(params) {
  const observations = [];
  const push = (fieldPath, rawValue) => observations.push({ text: fieldPath, rawValue });

  if (!params) return observations;

  if (params.resp && !params.resp.disconnected) {
    push('resp.resp', params.resp.resp);
  }
  if (params.ecg && !params.ecg.disconnected) {
    push('ecg.heartRate', params.ecg.heartRate);
    for (const lead of ['st1', 'st2', 'st3', 'stAvr', 'stAvl', 'stAvf', 'stV2', 'stV5']) {
      if (params.ecg[lead] !== undefined) push(`ecg.${lead}`, params.ecg[lead]);
    }
  }
  if (params.oxi && !params.oxi.disconnected) {
    push('oxi.spo2', params.oxi.spo2);
    push('oxi.heartRate', params.oxi.heartRate); // SpO2-probe-derived pulse, distinct from ECG heartRate
  }
  if (params.bp && !params.bp.disconnected) {
    push('bp.systolic', params.bp.systolic);
    push('bp.diastolic', params.bp.diastolic);
    push('bp.mean', params.bp.mean);
  }
  if (params.temp && !params.temp.disconnected1) {
    push('temp.temp1', params.temp.temp1);
  }
  if (params.others) {
    if (params.others.pressBldNoninvPulsRate !== undefined) {
      push('others.pressBldNoninvPulsRate', params.others.pressBldNoninvPulsRate);
    }
    if (params.others.pulsOximPerfRel !== undefined) {
      push('others.pulsOximPerfRel', params.others.pulsOximPerfRel);
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

  const timestamp = Number.isFinite(msg.ts) ? new Date(msg.ts * 1000).toISOString() : new Date().toISOString();

  return {
    timestamp,
    patientId: null, // this device's own capture never carries one
    observations: flatten(msg.params),
    alerts: [], // this device's captured "alarms" array was always empty; no real sample to build from
    waveforms: {},
  };
}

const CANONICAL_NAME_MAP = {
  'resp.resp': 'Resp.Rate',
  'ecg.heartRate': 'HeartRate',
  'oxi.spo2': 'SpO2',
  'oxi.heartRate': 'Pulse',
  'bp.systolic': 'NIBP Sys',
  'bp.diastolic': 'NIBP Dia',
  'bp.mean': 'NIBP Mean',
  'temp.temp1': 'Temp1',
  'ecg.st1': 'ST-I',
  'ecg.st2': 'ST-II',
  'ecg.st3': 'ST-III',
  'ecg.stAvr': 'ST-aVR',
  'ecg.stAvl': 'ST-aVL',
  'ecg.stAvf': 'ST-aVF',
  'ecg.stV2': 'ST-V2',
  'ecg.stV5': 'ST-V5',
  'others.pressBldNoninvPulsRate': 'NIBP Pulse Rate',
  'others.pulsOximPerfRel': 'Perfusion Index',
};

const PRIMARY_VITALS = new Set(['HeartRate', 'Pulse', 'SpO2', 'Resp.Rate', 'Temp1', 'NIBP Sys', 'NIBP Dia']);

function mapObservation({ text, rawValue }) {
  const canonicalName = CANONICAL_NAME_MAP[text];
  if (!canonicalName) return null;
  if (rawValue === undefined || rawValue === null) return null;

  const numeric = Number(rawValue);
  if (Number.isNaN(numeric)) return null;

  return { name: canonicalName, unit: '', value: numeric };
}

function classify(canonicalName) {
  return PRIMARY_VITALS.has(canonicalName) ? 'primary' : 'secondary';
}

module.exports = {
  deviceType: 'IntelliVue',
  parseObservations,
  mapObservation,
  classify,
};
