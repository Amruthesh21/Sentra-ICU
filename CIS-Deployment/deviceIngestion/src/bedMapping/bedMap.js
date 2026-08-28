/**
 * Admin-maintained IP -> bed mapping.
 * -------------------------------------
 * Real devices (confirmed against actual VividVue M10 output) do not
 * self-identify their bed anywhere in the HL7 message — MSH sending-facility
 * fields come back blank. So bed identity must come from WHICH CONNECTION
 * the data arrived on, resolved against a config an admin controls — never
 * inferred from message content. This mirrors the "device_associations"
 * safety pattern: explicit and admin-maintained, not guessed.
 *
 * The file is re-read on every resolution (not cached) so an admin edit
 * takes effect without restarting the service — the file is small and this
 * only runs once per TCP connection, not per message.
 */

const fs = require('fs');
const env = require('../env');

function loadRawMap() {
  try {
    const raw = fs.readFileSync(env.BED_MAP_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error(`[bedMap] failed to read ${env.BED_MAP_PATH}: ${err.message}`);
    return {};
  }
}

function normalizeIp(remoteAddress) {
  return String(remoteAddress || '').replace('::ffff:', '');
}

/** @returns {string|null} the mapped bedId, or null if the source IP is unmapped */
function resolveBedId(remoteAddress) {
  const ip = normalizeIp(remoteAddress);
  const map = loadRawMap();
  return map[ip] || null;
}

/** Read-only snapshot for the admin API (GET /api/bed-map). */
function getBedMap() {
  return loadRawMap();
}

function saveRawMap(map) {
  fs.writeFileSync(env.BED_MAP_PATH, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
}

/** Adds or overwrites one IP -> bedId entry. Used by the "Connect a device"
 * admin UI so this never has to be hand-edited on the server again. */
function setMapping(ip, bedId) {
  const map = loadRawMap();
  map[normalizeIp(ip)] = bedId;
  saveRawMap(map);
  return map;
}

function removeMapping(ip) {
  const map = loadRawMap();
  delete map[normalizeIp(ip)];
  saveRawMap(map);
  return map;
}

module.exports = { resolveBedId, getBedMap, normalizeIp, setMapping, removeMapping };
