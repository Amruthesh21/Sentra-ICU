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

function loadMessages(fixtureFile) {
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', fixtureFile), 'utf8');
  return raw.split(/(?=^MSH\|)/m).map((m) => m.trim()).filter(Boolean);
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

console.log('hl7Timestamp:');

test('HL7 MSH-7 timestamp normalizes to ISO-8601 (so Instant.parse in AlarmCheckService.java succeeds)', () => {
  assert.strictEqual(toIsoTimestamp('20260203192441'), '2026-02-03T19:24:41.000Z');
});

test('an unparseable timestamp falls back to now() instead of throwing', () => {
  assert.doesNotThrow(() => toIsoTimestamp('not-a-timestamp'));
});

console.log(`\n${passed} test(s) passed.`);
