/** Minimal HL7 v2 pipe parser for ADT / ORU demos */

function segments(raw) {
  return String(raw)
    .replace(/\r\n/g, '\r')
    .replace(/\n/g, '\r')
    .split('\r')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.split('|'));
}

function field(seg, i) {
  return seg?.[i] || '';
}

function component(val, i = 0) {
  return String(val || '').split('^')[i] || '';
}

export function parseHl7(raw) {
  const segs = segments(raw);
  const msh = segs.find((s) => s[0] === 'MSH');
  const pid = segs.find((s) => s[0] === 'PID');
  const pv1 = segs.find((s) => s[0] === 'PV1');
  const obxs = segs.filter((s) => s[0] === 'OBX');

  const messageType = component(field(msh, 8), 0) || 'UNKNOWN';
  const trigger = component(field(msh, 8), 1) || '';
  const controlId = field(msh, 9) || `MSG-${Date.now()}`;

  const mrn = component(field(pid, 3), 0) || field(pid, 3);
  const nameRaw = field(pid, 5);
  const family = component(nameRaw, 0);
  const given = component(nameRaw, 1);
  const fullName = [given, family].filter(Boolean).join(' ') || 'Unknown';

  const bed = component(field(pv1, 3), 2) || component(field(pv1, 3), 1) || '';
  const unit = component(field(pv1, 3), 0) || '';

  const vitals = {};
  for (const obx of obxs) {
    const code = component(field(obx, 3), 0) || component(field(obx, 3), 1);
    const value = field(obx, 5);
    const unitCode = field(obx, 6);
    if (!code) continue;
    const key = String(code).toUpperCase();
    if (key.includes('SPO2') || key === '2708-6') vitals.spo2 = Number(value);
    else if (key.includes('HR') || key.includes('8867') || key === '8867-4') vitals.hr = Number(value);
    else if (key.includes('RR') || key === '9279-1') vitals.rr = Number(value);
    else if (key.includes('TEMP') || key === '8310-5') vitals.temp = Number(value);
    else if (key.includes('DIA') || key.includes('DBP') || key === '8462-4') vitals.dbp = Number(value);
    else if (key.includes('NBP') || key.includes('SYS') || key.includes('SBP') || key === '8480-6') vitals.sbp = Number(value);
    else vitals[key] = value;
    if (unitCode) vitals[`${key}_unit`] = unitCode;
  }

  return {
    messageType: trigger ? `${messageType}^${trigger}` : messageType,
    controlId,
    mrn,
    fullName,
    unit,
    bed,
    vitals,
    raw,
  };
}

export function buildAck(controlId, code = 'AA') {
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return [
    `MSH|^~\\&|PULSE|HUB|HIS|HOSP|${ts}||ACK^A01|ACK-${controlId}|P|2.5`,
    `MSA|${code}|${controlId}`,
  ].join('\r');
}
