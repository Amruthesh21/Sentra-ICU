/**
 * deviceType -> adapter lookup.
 *
 * `deviceType` is chosen per TCP connection (currently: every connection
 * uses the single configured adapter below, since bed identity — and with
 * it, device model — comes from bed-map.json, not the HL7 message itself).
 * If a future device model needs the map to vary by source IP, extend
 * bedMap.js entries with a `deviceType` field and look it up here per
 * connection instead of using DEFAULT_ADAPTER.
 */

const bplVividVueM10 = require('./bplVividVueM10');

const ADAPTERS = {
  [bplVividVueM10.deviceType]: bplVividVueM10,
};

const DEFAULT_ADAPTER = bplVividVueM10;

function getAdapter(deviceType) {
  if (deviceType && ADAPTERS[deviceType]) return ADAPTERS[deviceType];
  return DEFAULT_ADAPTER;
}

module.exports = { getAdapter, ADAPTERS, DEFAULT_ADAPTER };
