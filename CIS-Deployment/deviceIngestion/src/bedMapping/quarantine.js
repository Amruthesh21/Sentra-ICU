/**
 * Ingestion quarantine.
 * -----------------------
 * Data arriving from a source IP with no bed-map entry is NEVER silently
 * dropped and NEVER guessed at — it's tracked here and surfaced on
 * GET /api/quarantine so an admin notices and fixes bed-map.json. This is
 * the "never silently discard, never silently guess" pattern from the task.
 *
 * In-memory only (this is a POC-scale concern list, not clinical data) and
 * capped so a misconfigured/noisy source can't grow this unbounded.
 */

const MAX_ENTRIES = 200;

/** @type {Map<string, {ip: string, firstSeenAt: string, lastSeenAt: string, messageCount: number}>} */
const entries = new Map();

function record(ip) {
  const now = new Date().toISOString();
  const existing = entries.get(ip);
  if (existing) {
    existing.lastSeenAt = now;
    existing.messageCount += 1;
    return existing;
  }

  if (entries.size >= MAX_ENTRIES) {
    const oldestKey = entries.keys().next().value;
    entries.delete(oldestKey);
  }

  const entry = { ip, firstSeenAt: now, lastSeenAt: now, messageCount: 1 };
  entries.set(ip, entry);
  console.warn(`[quarantine] data from unmapped source ${ip} — add it to bed-map.json`);
  return entry;
}

function list() {
  return Array.from(entries.values()).sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : -1));
}

/** Drops an IP from the quarantine list — called right after it's mapped to
 * a bed, so it stops showing as "unmapped" without waiting for TTL/restart. */
function clear(ip) {
  entries.delete(ip);
}

module.exports = { record, list, clear };
