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
const path = require('path');
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

/**
 * Entries are either a plain string (bedId — defaults to the registry's
 * DEFAULT_ADAPTER, currently BplVividVueM10) or an object
 * {bedId, deviceType} for a non-default device model. Both forms coexist so
 * existing bed-map.json files keep working unchanged.
 * @returns {{bedId: string, deviceType: string|null}|null} null if unmapped
 */
function resolveMapping(remoteAddress) {
  const ip = normalizeIp(remoteAddress);
  const map = loadRawMap();
  const entry = map[ip];
  if (!entry) return null;
  if (typeof entry === 'string') return { bedId: entry, deviceType: null };
  if (entry && typeof entry === 'object' && entry.bedId) {
    return { bedId: entry.bedId, deviceType: entry.deviceType || null };
  }
  return null;
}

/** @returns {string|null} the mapped bedId, or null if the source IP is unmapped */
function resolveBedId(remoteAddress) {
  const mapping = resolveMapping(remoteAddress);
  return mapping ? mapping.bedId : null;
}

/** Read-only snapshot for the admin API (GET /api/bed-map). */
function getBedMap() {
  return loadRawMap();
}

function saveRawMap(map) {
  fs.mkdirSync(path.dirname(env.BED_MAP_PATH), { recursive: true });
  fs.writeFileSync(env.BED_MAP_PATH, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
}

/** Creates an empty bed-map.json if the hospital volume is new. */
function ensureBedMapFile() {
  try {
    if (!fs.existsSync(env.BED_MAP_PATH)) {
      saveRawMap({});
      console.log(`[bedMap] created empty ${env.BED_MAP_PATH}`);
    }
  } catch (err) {
    console.error(`[bedMap] could not create ${env.BED_MAP_PATH}: ${err.message}`);
  }
}

/** Adds or overwrites one IP -> bedId entry. Used by the "Connect a device"
 * admin UI so this never has to be hand-edited on the server again.
 * `deviceType` is optional — omit it (or pass the default adapter's own
 * type) to write the plain-string form, keeping existing entries and tools
 * that expect a bedId string working unchanged. */
function setMapping(ip, bedId, deviceType) {
  const map = loadRawMap();
  map[normalizeIp(ip)] = deviceType ? { bedId, deviceType } : bedId;
  saveRawMap(map);
  return map;
}

function removeMapping(ip) {
  const map = loadRawMap();
  delete map[normalizeIp(ip)];
  saveRawMap(map);
  return map;
}

module.exports = { resolveBedId, resolveMapping, getBedMap, normalizeIp, setMapping, removeMapping, ensureBedMapFile };
