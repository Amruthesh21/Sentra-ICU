/**
 * deviceType -> adapter lookup.
 *
 * deviceType comes from bed-map.json's per-IP entry (see
 * bedMapping/bedMap.js's resolveMapping) — never from the HL7/JSON message
 * itself, same "never trust the device to say what it is" principle as bed
 * identity. Omitting deviceType on a bed-map entry (or using the plain
 * bedId-string form) falls back to DEFAULT_ADAPTER, so every mapping
 * written before multi-device support existed keeps working unchanged.
 *
 * HL7-family and JSON-family adapters share this one registry — tcpServer.js
 * and jsonServer.js each only ever look up adapters of their own kind in
 * practice (a bed-map entry's deviceType implies which TCP port the device
 * actually connects to), but keeping one lookup keyed by deviceType avoids
 * two parallel registries drifting apart.
 */

const bplVividVueM10 = require('./bplVividVueM10');
const bplAcuraS1 = require('./bplAcuraS1');
const aviIW6000 = require('./aviIW6000');
const aviVihaDV10 = require('./aviVihaDV10');
const bplPenlon320 = require('./bplPenlon320');
const bplVividVue12 = require('./bplVividVue12');
const g40 = require('./g40');
const mindrayBeneviewT5 = require('./mindrayBeneviewT5');
const pvm2703 = require('./pvm2703');
const schillerNeumovent = require('./schillerNeumovent');
const vmDevice = require('./vmDevice');
const intelliVue = require('./intelliVue');
const evitaV600 = require('./evitaV600');
const mx550 = require('./mx550');
const draegerSavina300 = require('./draegerSavina300');

const ALL_ADAPTERS = [
  bplVividVueM10, bplAcuraS1, aviIW6000, aviVihaDV10, bplPenlon320,
  bplVividVue12, g40, mindrayBeneviewT5, pvm2703, schillerNeumovent, vmDevice,
  intelliVue, evitaV600, mx550, draegerSavina300,
];

const ADAPTERS = Object.fromEntries(ALL_ADAPTERS.map((a) => [a.deviceType, a]));

const DEFAULT_ADAPTER = bplVividVueM10;

function getAdapter(deviceType) {
  if (deviceType && ADAPTERS[deviceType]) return ADAPTERS[deviceType];
  return DEFAULT_ADAPTER;
}

module.exports = { getAdapter, ADAPTERS, DEFAULT_ADAPTER };
