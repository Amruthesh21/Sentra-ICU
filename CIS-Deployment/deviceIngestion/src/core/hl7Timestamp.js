/**
 * HL7 v2 timestamp (MSH-7 / OBX-14, format YYYYMMDD[HHMMSS[.ffff]][+/-ZZZZ])
 * -> ISO-8601, so it survives alarm-engine's `Instant.parse(...)` in
 * AlarmCheckService.parseTimestamp — that call is strict ISO-8601 only and
 * silently falls back to "now" on anything else, which would make every
 * message's true device timestamp disappear if left as raw HL7. This is a
 * standard HL7 datatype, not a device-specific quirk, so it belongs in core.
 *
 * No timezone offset is present in the captured device output, so this
 * assumes UTC — the only deterministic default available without one. If a
 * future device model is confirmed to send local time, handle that in its
 * adapter (pass a corrected ISO string back) rather than changing this
 * default for every device.
 */

const HL7_TS_PATTERN = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})(?:\.(\d+))?)?([+-]\d{4})?$/;

/** @param {string} hl7Timestamp @returns {string} ISO-8601, or now() if unparseable */
function toIsoTimestamp(hl7Timestamp) {
  const match = HL7_TS_PATTERN.exec(String(hl7Timestamp || '').trim());
  if (!match) return new Date().toISOString();

  const [, year, month, day, hour = '00', minute = '00', second = '00', , offset] = match;
  const isoLocal = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const isoWithZone = offset
    ? `${isoLocal}${offset.slice(0, 3)}:${offset.slice(3)}`
    : `${isoLocal}Z`; // no offset in source data -> assume UTC, see file header

  const parsed = new Date(isoWithZone);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

module.exports = { toIsoTimestamp };
