/**
 * Plain assert-based smoke test — no test framework dependency, matching the
 * lightweight style of this repo's other services. Run with `npm test`.
 *
 * Validates the core parser + BPL VividVue M10 adapter against the real
 * captured fixtures (see test/fixtures/), not synthetic data.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseHl7Message } = require('../src/core/hl7Parser');
const { toIsoTimestamp } = require('../src/core/hl7Timestamp');
const adapter = require('../src/adapters/bplVividVueM10');
const waveformBuffer = require('../src/waveform/waveformBuffer');

function loadMessages(fixtureFile) {
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', fixtureFile), 'utf8');
  // Segment terminator is HL7's own \r, not necessarily \n — split on that,
  // not just newlines, then regroup into messages on MSH boundaries.
  return raw.split(/(?=MSH\|)/).map((m) => m.trim()).filter(Boolean);
}

/** Parses one fixture message with a given adapter's own waveform hook. */
function parseWith(msg, adp) {
  return parseHl7Message(msg, { decodeWaveformMeta: adp.decodeWaveformMeta });
}

function findMessageContaining(messages, needle) {
  const msg = messages.find((m) => m.includes(needle));
  assert.ok(msg, `expected a fixture message containing: ${needle}`);
  return msg;
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

console.log('sample-real-device.hl7 (real BPL VividVue M10 capture):');
const realMessages = loadMessages('sample-real-device.hl7');

test('HR sentinel "-1" is treated as no-data and dropped, not published as 0 or -1', () => {
  const msg = findMessageContaining(realMessages, '201^HR^BHC|5001|-1|51^bpm^BHC');
  const parsed = parseHl7Message(msg, { decodeWaveformMeta: adapter.decodeWaveformMeta });
  const hrObs = parsed.observations.find((o) => o.text === 'HR');
  assert.ok(hrObs, 'HR observation should be present in the generic parse');
  assert.strictEqual(adapter.mapObservation(hrObs), null, 'sentinel -1 must map to null (dropped)');
});

test('a real valid vital (T01 temperature) maps to canonical name/unit/value', () => {
  const msg = findMessageContaining(realMessages, '1051^T01^BHC|5021|27.2|21^C^BHC');
  const parsed = parseHl7Message(msg, { decodeWaveformMeta: adapter.decodeWaveformMeta });
  const tempObs = parsed.observations.find((o) => o.text === 'T01');
  const mapped = adapter.mapObservation(tempObs);
  assert.deepStrictEqual(mapped, { name: 'Temp1', unit: 'C', value: 27.2 });
  assert.strictEqual(adapter.classify(mapped.name), 'primary');
});

test('non-vital housekeeping fields (Height) are dropped, not mis-published as a vital', () => {
  const msg = findMessageContaining(realMessages, '4201^Height^BHC||175.0|31^cm^BHC');
  const parsed = parseHl7Message(msg, { decodeWaveformMeta: adapter.decodeWaveformMeta });
  const heightObs = parsed.observations.find((o) => o.text === 'Height');
  assert.strictEqual(adapter.mapObservation(heightObs), null);
});

console.log('sample-demo-mode.hl7 (device demo-mode capture, includes waveforms):');
const demoMessages = loadMessages('sample-demo-mode.hl7');

test('CD + NA segments decode a waveform channel using the CD scale factor', () => {
  const msg = findMessageContaining(demoMessages, '30001^ECG_I^BHC');
  const parsed = parseHl7Message(msg, { decodeWaveformMeta: adapter.decodeWaveformMeta });
  const ecg = parsed.waveforms.ECG_I;
  assert.ok(ecg, 'ECG_I waveform channel should be decoded');
  assert.strictEqual(ecg.unit, 'mV');
  assert.strictEqual(ecg.sampleRate, 512);
  assert.ok(ecg.samples.length > 0, 'should have decoded samples');
  // raw first sample is -20; CD scale factor is 0.001 -> -0.02
  assert.strictEqual(ecg.samples[0], -0.02);
});

console.log('sample-bpl-acura-s1.hl7 (BPL Acura S1 syringe pump):');
{
  const acuraAdapter = require('../src/adapters/bplAcuraS1');
  const [msg] = loadMessages('sample-bpl-acura-s1.hl7');

  test('a real pump rate observation maps to a secondary, non-vital attribute', () => {
    const parsed = parseWith(msg, acuraAdapter);
    const rateObs = parsed.observations.find((o) => o.text === 'Rate');
    const mapped = acuraAdapter.mapObservation(rateObs);
    assert.deepStrictEqual(mapped, { name: 'Pump Rate', unit: 'ml/h', value: 10.0 });
    assert.strictEqual(acuraAdapter.classify(mapped.name), 'secondary');
  });

  test('non-numeric operational status (DrugName) is dropped, not published as garbage', () => {
    const parsed = parseWith(msg, acuraAdapter);
    const drugObs = parsed.observations.find((o) => o.text === 'DrugName');
    assert.strictEqual(acuraAdapter.mapObservation(drugObs), null);
  });
}

console.log('sample-avi-iw6000.hl7 (Avi IW6000 neonatal incubator):');
{
  const iw6000Adapter = require('../src/adapters/aviIW6000');
  const [msg] = loadMessages('sample-avi-iw6000.hl7');

  test('a Measured-category SpO2 reading maps to the canonical primary vital', () => {
    const parsed = parseWith(msg, iw6000Adapter);
    const spo2Obs = parsed.observations.find((o) => o.codingSystem === 'SpO2' && o.text === 'Measured');
    const mapped = iw6000Adapter.mapObservation(spo2Obs);
    assert.deepStrictEqual(mapped, { name: 'SpO2', unit: '%', value: 0 });
    assert.strictEqual(iw6000Adapter.classify(mapped.name), 'primary');
  });

  test('a Setting-category observation (configured threshold, not a reading) is dropped', () => {
    const parsed = parseWith(msg, iw6000Adapter);
    const settingObs = parsed.observations.find((o) => o.codingSystem === 'SpO2High' && o.text === 'Setting');
    assert.strictEqual(iw6000Adapter.mapObservation(settingObs), null);
  });

  test('a CWE alert (this device uses CWE, not CE) is surfaced via mapAlert', () => {
    const parsed = parseWith(msg, iw6000Adapter);
    const alarm = parsed.alerts.find((a) => a.valueParts[0] === 'Overhead Heater Fail');
    assert.ok(alarm, 'CWE-type alert should be captured by the core parser');
    const mapped = iw6000Adapter.mapAlert(alarm);
    assert.strictEqual(mapped.label, 'Overhead Heater Fail');
  });
}

console.log('sample-avi-viha-dv10.hl7 (Avi Viha DV10 ventilator):');
{
  const dv10Adapter = require('../src/adapters/aviVihaDV10');
  const [msg] = loadMessages('sample-avi-viha-dv10.hl7');

  test('a Measured-category respiratory rate maps to canonical Resp.Rate', () => {
    const parsed = parseWith(msg, dv10Adapter);
    const rrObs = parsed.observations.find((o) => o.codingSystem === 'RR' && o.text === 'Measured');
    const mapped = dv10Adapter.mapObservation(rrObs);
    assert.deepStrictEqual(mapped, { name: 'Resp.Rate', unit: 'bpm', value: 40 });
    assert.strictEqual(dv10Adapter.classify(mapped.name), 'primary');
  });
}

console.log('sample-bpl-penlon-320.hl7 (BPL Penlon 320 anesthesia workstation):');
{
  const penlonAdapter = require('../src/adapters/bplPenlon320');
  const [msg] = loadMessages('sample-bpl-penlon-320.hl7');

  test('respiratory frequency ("f") maps to canonical Resp.Rate', () => {
    const parsed = parseWith(msg, penlonAdapter);
    const fObs = parsed.observations.find((o) => o.text === 'f');
    const mapped = penlonAdapter.mapObservation(fObs);
    assert.deepStrictEqual(mapped, { name: 'Resp.Rate', unit: 'bpm', value: 12 });
    assert.strictEqual(penlonAdapter.classify(mapped.name), 'primary');
  });

  test('a real Unicode subscript-2 field name (SpO₂) is matched correctly, not mangled', () => {
    const parsed = parseWith(msg, penlonAdapter);
    const spo2Obs = parsed.observations.find((o) => o.text === 'SpO₂');
    assert.ok(spo2Obs, 'the fixture must actually contain the Unicode field name');
    const mapped = penlonAdapter.mapObservation(spo2Obs);
    assert.strictEqual(mapped.name, 'SpO2');
  });
}

console.log('sample-bpl-vividvue-12.hl7 (BPL VividVue M12 patient monitor):');
{
  const m12Adapter = require('../src/adapters/bplVividVue12');
  const [msg] = loadMessages('sample-bpl-vividvue-12.hl7');

  test('a LOINC-coded heart rate observation maps to canonical HeartRate', () => {
    const parsed = parseWith(msg, m12Adapter);
    const hrObs = parsed.observations.find((o) => o.text === 'HEART_BEAT');
    const mapped = m12Adapter.mapObservation(hrObs);
    assert.deepStrictEqual(mapped, { name: 'HeartRate', unit: 'bpm', value: 75 });
    assert.strictEqual(m12Adapter.classify(mapped.name), 'primary');
  });

  test('unlike M10, this device has no "-1 means no data" sentinel — zero is a real zero', () => {
    const parsed = parseWith(msg, m12Adapter);
    const ibpObs = parsed.observations.find((o) => o.text === 'Systolic_blood_pressure_IBP1');
    const mapped = m12Adapter.mapObservation(ibpObs);
    assert.strictEqual(mapped.value, 0);
  });
}

console.log('sample-g40.hl7 (Philips Goldway G40 patient monitor):');
{
  const g40Adapter = require('../src/adapters/g40');
  const [msg] = loadMessages('sample-g40.hl7');

  test('a real heart rate observation maps to canonical HeartRate with unit unwrapped from MDIL coding', () => {
    const parsed = parseWith(msg, g40Adapter);
    const hrObs = parsed.observations.find((o) => o.text === 'HR');
    const mapped = g40Adapter.mapObservation(hrObs);
    assert.deepStrictEqual(mapped, { name: 'HeartRate', unit: 'bpm', value: 60 });
    assert.strictEqual(g40Adapter.classify(mapped.name), 'primary');
  });
}

console.log('sample-mindray-beneview-t5.hl7 (Mindray Beneview T5 patient monitor):');
{
  const mindrayAdapter = require('../src/adapters/mindrayBeneviewT5');
  const messages = loadMessages('sample-mindray-beneview-t5.hl7');

  test('this device sends one vital group per message — a full round covers HR/RR/SpO2/NIBP', () => {
    assert.strictEqual(messages.length, 4, 'fixture should carry 4 separate messages');
    const allObs = messages.flatMap((m) => parseWith(m, mindrayAdapter).observations);
    const mapped = allObs.map((o) => mindrayAdapter.mapObservation(o)).filter(Boolean);
    const names = mapped.map((m) => m.name).sort();
    assert.deepStrictEqual(names, ['HeartRate', 'NIBP Dia', 'NIBP Mean', 'NIBP Sys', 'Pulse', 'Resp.Rate', 'SpO2']);
  });
}

console.log('sample-pvm2703.hl7 (Nihon Kohden PVM-2703 patient monitor):');
{
  const pvmAdapter = require('../src/adapters/pvm2703');
  const [msg] = loadMessages('sample-pvm2703.hl7');

  test('the literal "VITAL " prefix baked into the field name is stripped before matching', () => {
    const parsed = parseWith(msg, pvmAdapter);
    const hrObs = parsed.observations.find((o) => o.text === 'VITAL HR');
    const mapped = pvmAdapter.mapObservation(hrObs);
    assert.deepStrictEqual(mapped, { name: 'HeartRate', unit: 'bpm', value: 80 });
  });

  test('the "r"-prefixed redundant channel is kept distinct from the primary reading', () => {
    const parsed = parseWith(msg, pvmAdapter);
    const rResp = parsed.observations.find((o) => o.text === 'VITAL rRESP(co2)');
    const mapped = pvmAdapter.mapObservation(rResp);
    assert.strictEqual(mapped.name, 'Resp.Rate (redundant channel)');
    assert.strictEqual(pvmAdapter.classify(mapped.name), 'secondary');
  });
}

console.log('sample-schiller-neumovent.hl7 (Schiller Neumovent ventilator):');
{
  const schillerAdapter = require('../src/adapters/schillerNeumovent');
  const [msg] = loadMessages('sample-schiller-neumovent.hl7');

  test('a real ventilator reading (Minute Volume) maps to a secondary attribute', () => {
    const parsed = parseWith(msg, schillerAdapter);
    const mvObs = parsed.observations.find((o) => o.text === 'Minute Volume');
    const mapped = schillerAdapter.mapObservation(mvObs);
    assert.deepStrictEqual(mapped, { name: 'Ventilator Minute Volume', unit: 'L/min', value: 1.61 });
    assert.strictEqual(schillerAdapter.classify(mapped.name), 'secondary');
  });
}

console.log('sample-vm-device.hl7 (Philips SureSigns VM spot-check monitor):');
{
  const vmAdapter = require('../src/adapters/vmDevice');
  const [msg] = loadMessages('sample-vm-device.hl7');

  test('this device\'s own "ABPs" label maps to the same canonical NIBP Sys as other devices', () => {
    const parsed = parseWith(msg, vmAdapter);
    const abpsObs = parsed.observations.find((o) => o.text === 'ABPs');
    const mapped = vmAdapter.mapObservation(abpsObs);
    assert.deepStrictEqual(mapped, { name: 'NIBP Sys', unit: 'mmHg', value: 120 });
    assert.strictEqual(vmAdapter.classify(mapped.name), 'primary');
  });
}

console.log('sample-intellivue.json (Philips IntelliVue, JSON protocol):');
{
  const intelliVueAdapter = require('../src/adapters/intelliVue');
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-intellivue.json'), 'utf8').trim();

  test('a real params.oxi.spo2 reading flattens and maps to canonical SpO2', () => {
    const parsed = intelliVueAdapter.parseObservations(raw);
    const spo2Obs = parsed.observations.find((o) => o.text === 'oxi.spo2');
    assert.ok(spo2Obs, 'oxi.spo2 should be present in the fixture (it has a params block)');
    const mapped = intelliVueAdapter.mapObservation(spo2Obs);
    assert.deepStrictEqual(mapped, { name: 'SpO2', unit: '', value: 95 });
    assert.strictEqual(intelliVueAdapter.classify(mapped.name), 'primary');
  });

  test('unix-epoch "ts" converts to a real ISO-8601 timestamp', () => {
    const parsed = intelliVueAdapter.parseObservations(raw);
    assert.ok(!Number.isNaN(new Date(parsed.timestamp).getTime()));
    assert.ok(parsed.timestamp.endsWith('Z'));
  });

  test('the "curves" waveform block does not leak into observations', () => {
    const parsed = intelliVueAdapter.parseObservations(raw);
    assert.ok(!parsed.observations.some((o) => o.text.startsWith('curves')));
  });
}

console.log('sample-evita-v600.json (Draeger Evita V600 ventilator, JSON protocol):');
{
  const evitaAdapter = require('../src/adapters/evitaV600');
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-evita-v600.json'), 'utf8').trim();

  test('a real parametersCP1 reading (Respiratory_rate) maps to canonical Resp.Rate', () => {
    const parsed = evitaAdapter.parseObservations(raw);
    const rrObs = parsed.observations.find((o) => o.text === 'Respiratory_rate');
    const mapped = evitaAdapter.mapObservation(rrObs);
    assert.deepStrictEqual(mapped, { name: 'Resp.Rate', unit: '', value: 12 });
    assert.strictEqual(evitaAdapter.classify(mapped.name), 'primary');
  });

  test('deviceSettings fields (configured targets, not readings) are excluded from observations', () => {
    const parsed = evitaAdapter.parseObservations(raw);
    assert.ok(!parsed.observations.some((o) => o.text === 'Respiratory_rate_setting'));
  });
}

console.log('sample-mx550.json (Philips MX550 patient monitor, JSON protocol):');
{
  const mx550Adapter = require('../src/adapters/mx550');
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-mx550.json'), 'utf8').trim();

  test('a real IEEE 11073 heart-rate field (wrapped in a single-element array) unwraps and maps', () => {
    const parsed = mx550Adapter.parseObservations(raw);
    const hrObs = parsed.observations.find((o) => o.text === 'NOM_ECG_CARD_BEAT_RATE');
    const mapped = mx550Adapter.mapObservation(hrObs);
    assert.deepStrictEqual(mapped, { name: 'HeartRate', unit: '', value: 60 });
    assert.strictEqual(mx550Adapter.classify(mapped.name), 'primary');
  });

  test('the "-" no-data sentinel (ST-segment amplitude) is dropped, not published as NaN', () => {
    const parsed = mx550Adapter.parseObservations(raw);
    const stObs = parsed.observations.find((o) => o.text === 'NOM_ECG_AMPL_ST_I');
    assert.strictEqual(mx550Adapter.mapObservation(stObs), null);
  });

  test('ECG/PLETH waveform sample arrays are excluded from observations, not mis-published as vitals', () => {
    const parsed = mx550Adapter.parseObservations(raw);
    assert.ok(!parsed.observations.some((o) => o.text === 'ECG' || o.text === 'PLETH'));
  });
}

console.log('sample-draeger-savina-300.json (Draeger Savina 300 ventilator, JSON protocol):');
{
  const savinaAdapter = require('../src/adapters/draegerSavina300');
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-draeger-savina-300.json'), 'utf8').trim();

  test('a real live-reading respiratory rate maps to canonical Resp.Rate', () => {
    const parsed = savinaAdapter.parseObservations(raw);
    const rrObs = parsed.observations.find((o) => o.text === 'Respiratory_rate');
    const mapped = savinaAdapter.mapObservation(rrObs);
    assert.deepStrictEqual(mapped, { name: 'Resp.Rate', unit: '', value: 19 });
    assert.strictEqual(savinaAdapter.classify(mapped.name), 'primary');
  });

  test('"Mode" and "BedIp" are excluded from observations (not vitals)', () => {
    const parsed = savinaAdapter.parseObservations(raw);
    assert.ok(!parsed.observations.some((o) => o.text === 'Mode' || o.text === 'BedIp'));
  });
}

console.log('core/jsonFraming.js:');
{
  const { createFramer } = require('../src/core/jsonFraming');

  test('two messages back-to-back with no delimiter at all split correctly', () => {
    const framer = createFramer();
    const msgs = framer.push('{"a":1}{"b":2}');
    assert.deepStrictEqual(msgs, ['{"a":1}', '{"b":2}']);
  });

  test('braces inside a JSON string value do not break framing', () => {
    const framer = createFramer();
    const msgs = framer.push('{"note":"contains { and } chars","n":1}');
    assert.strictEqual(msgs.length, 1);
    assert.deepStrictEqual(JSON.parse(msgs[0]), { note: 'contains { and } chars', n: 1 });
  });

  test('an escaped quote inside a string does not end the string early', () => {
    const framer = createFramer();
    const msgs = framer.push('{"note":"a \\"quoted\\" word","n":2}');
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(JSON.parse(msgs[0]).n, 2);
  });

  test('a message split across multiple TCP chunks reassembles into one', () => {
    const framer = createFramer();
    const first = framer.push('{"a":');
    const second = framer.push('42}');
    assert.strictEqual(first.length, 0);
    assert.deepStrictEqual(second, ['{"a":42}']);
  });

  test('an unbounded stream with no closing brace does not grow memory forever (DoS protection)', () => {
    const framer = createFramer();
    // Simulate a connection that never completes a message — e.g. an
    // unclosed '{' streamed indefinitely, or garbage with no matching '}'.
    // JSON_PORT is published to the host, so this is reachable by any
    // network client, mapped or not, before bedMap even runs.
    const junkChunk = `{${'"x":1,'.repeat(200000)}`; // ~1.2MB, over the cap, never closes
    const msgs = framer.push(junkChunk);
    assert.strictEqual(msgs.length, 0, 'an incomplete message should not be emitted');
    // The framer must have discarded the buffer, not kept accumulating it —
    // prove it by sending a small, complete, unrelated message next and
    // confirming it parses cleanly (would fail/merge with garbage otherwise).
    const clean = framer.push('{"ok":true}');
    assert.deepStrictEqual(clean, ['{"ok":true}']);
  });

  test('an unclosed string literal (continuously "inString") also does not grow memory forever', () => {
    // Regression test for a real bug caught during live testing against the
    // running container: the cap check originally sat after the
    // `inString`/`escapeNext` early-`continue`s, so a connection that opens
    // a string and never closes it (a single long run of non-quote,
    // non-backslash bytes) skipped the check on every character and grew
    // unbounded — confirmed live (container memory climbed from ~26MiB to
    // ~97MiB with no cap warning logged) before the check was moved above
    // those `continue`s. This proves the fixed placement is actually reached
    // from inside a string, not just between tokens.
    const framer = createFramer();
    const junkChunk = `{"a":"${'B'.repeat(1200000)}`; // opens a string and never closes it
    const msgs = framer.push(junkChunk);
    assert.strictEqual(msgs.length, 0, 'an incomplete message should not be emitted');
    const clean = framer.push('{"ok":true}');
    assert.deepStrictEqual(clean, ['{"ok":true}']);
  });

  test('a legitimate large-but-bounded message (e.g. a waveform payload) is not discarded', () => {
    const framer = createFramer();
    const bigButValid = `{"samples":[${'1,'.repeat(20000)}0]}`; // ~50KB, well under the cap, and complete
    const msgs = framer.push(bigButValid);
    assert.strictEqual(msgs.length, 1, 'a complete message under the cap must still be emitted');
    assert.deepStrictEqual(JSON.parse(msgs[0]).samples.length, 20001);
  });
}

console.log('core/mllpFraming.js — DoS protection:');
{
  const { createFramer } = require('../src/core/mllpFraming');

  test('an unbounded stream with no "MSH|" boundary does not grow memory forever', () => {
    const framer = createFramer();
    // HL7_PORT is published to the host the same way JSON_PORT is — same
    // reasoning as the jsonFraming test above.
    const junkChunk = 'X'.repeat(1_100_000); // over the 1MiB cap, no "MSH|" anywhere
    const msgs = framer.push(junkChunk);
    assert.strictEqual(msgs.length, 0);
    // Prove the buffer was actually discarded, not just left huge: send a
    // real message followed by the start of a second one (the framer only
    // emits a message once the *next* one's "MSH|" boundary arrives, same
    // as every other test in this file) and confirm the first message is
    // exactly the clean one — not "1.1M junk bytes + MSH|...".
    const clean = framer.push('MSH|^~\\&|||||20260101000000||ORU^R01|1|P|2.6\r\nMSH|');
    assert.strictEqual(clean.length, 1);
    assert.strictEqual(clean[0], 'MSH|^~\\&|||||20260101000000||ORU^R01|1|P|2.6');
  });
}

console.log('hl7Timestamp:');

test('HL7 MSH-7 timestamp normalizes to ISO-8601 (so Instant.parse in AlarmCheckService.java succeeds)', () => {
  assert.strictEqual(toIsoTimestamp('20260203192441'), '2026-02-03T19:24:41.000Z');
});

test('an unparseable timestamp falls back to now() instead of throwing', () => {
  assert.doesNotThrow(() => toIsoTimestamp('not-a-timestamp'));
});

console.log('core/safeLookup.js:');

{
  const { safeLookup } = require('../src/core/safeLookup');
  const map = { HR: 'HeartRate' };

  test('a recognized key still returns its mapped value', () => {
    assert.strictEqual(safeLookup(map, 'HR'), 'HeartRate');
  });

  test('an unrecognized key returns undefined, not an inherited Object.prototype member', () => {
    // Regression test: every adapter's CANONICAL_NAME_MAP[vendorName] lookup
    // used a plain object literal, which inherits Object.prototype — a
    // vendor-supplied (i.e. attacker-controlled, straight off the wire)
    // field named "constructor" or "toString" returned a truthy function
    // instead of undefined, passing every call site's `if (!canonicalName)
    // return null` guard and flowing downstream as a bogus canonical name.
    assert.strictEqual(safeLookup(map, 'constructor'), undefined);
    assert.strictEqual(safeLookup(map, 'toString'), undefined);
    assert.strictEqual(safeLookup(map, 'hasOwnProperty'), undefined);
    assert.strictEqual(safeLookup(map, '__proto__'), undefined);
  });

  test('a real adapter (BPL VividVue M10) drops a "constructor"-named observation instead of mismapping it', () => {
    // End-to-end version of the same regression, through the actual adapter
    // contract rather than the helper directly.
    const result = adapter.mapObservation({ text: 'constructor', rawValue: '72', rawUnitField: '' });
    assert.strictEqual(result, null);
  });
}

console.log('waveform/waveformBuffer.js:');

{
  waveformBuffer.record('BED-07', { ECG_II: { unit: 'mV', sampleRate: 512, samples: [0, 1, 2] } });

  test('an exact bedId match is found directly', () => {
    const wf = waveformBuffer.getLatestForBedIdVariants('BED-07');
    assert.deepStrictEqual(Object.keys(wf), ['ECG_II']);
  });

  test('a route bedId carrying the "ICU-1-" prefix still finds the bed-map-form id', () => {
    // Real gap this fixes: bed-map.json resolved this connection to the
    // plain "BED-07" (as tcpServer.js/jsonServer.js actually record it),
    // but the Hub UI's route param is "ICU-1-BED-07" — an exact-match
    // lookup would silently return nothing for a bed with real live data.
    const wf = waveformBuffer.getLatestForBedIdVariants('ICU-1-BED-07');
    assert.deepStrictEqual(Object.keys(wf), ['ECG_II']);
  });

  test('a bed with no recorded waveforms at all returns an empty object, not undefined', () => {
    const wf = waveformBuffer.getLatestForBedIdVariants('ICU-1-BED-99');
    assert.deepStrictEqual(wf, {});
  });

  test('a second message at the same sample rate is appended, not replaced', () => {
    // Regression test for the actual bug this was built to fix: a flat
    // per-message replace meant the visible sweep window was however many
    // samples one HL7 batch happened to contain, which varies by device
    // and even message to message — real devices stream continuously, so
    // the buffer needs to accumulate across messages like a real sliding
    // window, not restart from each new batch.
    waveformBuffer.record('BED-08', { ECG_I: { unit: 'mV', sampleRate: 100, samples: [1, 2, 3] } });
    waveformBuffer.record('BED-08', { ECG_I: { unit: 'mV', sampleRate: 100, samples: [4, 5] } });
    const wf = waveformBuffer.getLatest('BED-08');
    assert.deepStrictEqual(wf.ECG_I.samples, [1, 2, 3, 4, 5]);
  });

  test('the accumulated buffer is capped by seconds of history, not a flat sample count', () => {
    // At 100Hz, 12 seconds of history is 1200 samples — the old flat
    // 500-sample cap would have thrown away real, still-relevant recent
    // history for anything slower than ~42Hz.
    waveformBuffer.record('BED-09', { RESP: { unit: 'ohm', sampleRate: 100, samples: new Array(1300).fill(0).map((_, i) => i) } });
    const wf = waveformBuffer.getLatest('BED-09');
    assert.strictEqual(wf.RESP.samples.length, 1200);
    assert.strictEqual(wf.RESP.samples[wf.RESP.samples.length - 1], 1299); // kept the most recent samples, not the oldest
  });

  test('a genuinely faster channel (e.g. 512Hz ECG) keeps proportionally more raw samples for the same 12s window', () => {
    waveformBuffer.record('BED-10', { ECG_II: { unit: 'mV', sampleRate: 512, samples: new Array(7000).fill(0) } });
    const wf = waveformBuffer.getLatest('BED-10');
    assert.strictEqual(wf.ECG_II.samples.length, 512 * 12);
  });

  test('a sample-rate change on the same channel restarts the buffer instead of concatenating mismatched rates', () => {
    waveformBuffer.record('BED-11', { RESP: { unit: 'ohm', sampleRate: 100, samples: [1, 1, 1] } });
    waveformBuffer.record('BED-11', { RESP: { unit: 'ohm', sampleRate: 25, samples: [9, 9] } }); // device reconfigured
    const wf = waveformBuffer.getLatest('BED-11');
    assert.deepStrictEqual(wf.RESP.samples, [9, 9]);
    assert.strictEqual(wf.RESP.sampleRate, 25);
  });

  test('an unknown sample rate (null) falls back to a flat sample cap rather than skipping trimming entirely', () => {
    waveformBuffer.record('BED-12', { X: { unit: '', sampleRate: null, samples: new Array(600).fill(1) } });
    const wf = waveformBuffer.getLatest('BED-12');
    assert.strictEqual(wf.X.samples.length, 500);
  });

  test('a channel the device has stopped sending expires instead of being served forever', () => {
    // The real bug: a one-shot fixture replay (or a lead coming off) left its
    // last samples buffered indefinitely, and the Hub kept drawing them behind
    // a "LIVE" badge — a frozen trace that reads as a running flat signal.
    const t0 = 1_000_000;
    waveformBuffer.record('BED-13', { SPO2: { unit: '', sampleRate: 100, samples: [1, 2, 3] } }, t0);

    assert.deepStrictEqual(Object.keys(waveformBuffer.getLatest('BED-13', t0 + 11_000)), ['SPO2']);
    assert.deepStrictEqual(waveformBuffer.getLatest('BED-13', t0 + 13_000), {});
  });

  test('a still-streaming channel survives while a silent one beside it is dropped', () => {
    // Partial staleness is the common real case: the emulator's demo-mode
    // fixture carries ECG but no SpO2, so ECG must keep rendering while the
    // stale SpO2 lane falls back rather than the whole bed going dark.
    const t0 = 2_000_000;
    waveformBuffer.record('BED-14', {
      ECG_II: { unit: 'mV', sampleRate: 100, samples: [1, 2, 3] },
      SPO2: { unit: '', sampleRate: 100, samples: [9, 9, 9] },
    }, t0);
    // ECG keeps arriving; SpO2 does not.
    waveformBuffer.record('BED-14', { ECG_II: { unit: 'mV', sampleRate: 100, samples: [4, 5] } }, t0 + 13_000);

    const wf = waveformBuffer.getLatest('BED-14', t0 + 13_000);
    assert.deepStrictEqual(Object.keys(wf), ['ECG_II']);
    assert.deepStrictEqual(wf.ECG_II.samples, [1, 2, 3, 4, 5]); // still accumulating, not reset by the pruning
  });

  test('a bed whose every channel has gone silent disappears from getAllLatest', () => {
    const t0 = 3_000_000;
    waveformBuffer.record('BED-15', { RESP: { unit: 'ohm', sampleRate: 100, samples: [7] } }, t0);

    assert.ok(Object.prototype.hasOwnProperty.call(waveformBuffer.getAllLatest(t0 + 1_000), 'BED-15'));
    assert.ok(!Object.prototype.hasOwnProperty.call(waveformBuffer.getAllLatest(t0 + 13_000), 'BED-15'));
  });

  test('a re-connecting device repopulates a channel that had already expired', () => {
    // Expiry must not be sticky: plug the monitor back in (or re-run the
    // replay) and the channel comes back like any first message would.
    const t0 = 4_000_000;
    waveformBuffer.record('BED-16', { SPO2: { unit: '', sampleRate: 100, samples: [1] } }, t0);
    assert.deepStrictEqual(waveformBuffer.getLatest('BED-16', t0 + 13_000), {});

    waveformBuffer.record('BED-16', { SPO2: { unit: '', sampleRate: 100, samples: [2, 3] } }, t0 + 14_000);
    const wf = waveformBuffer.getLatest('BED-16', t0 + 14_000);
    assert.deepStrictEqual(wf.SPO2.samples, [2, 3]); // fresh start, not stitched onto the expired history
  });
}

console.log(`\n${passed} test(s) passed.`);
