/**
 * MLLP / multi-message framing.
 * -------------------------------
 * Real devices may send HL7 wrapped in MLLP framing bytes (VT 0x0B ... FS 0x1C
 * CR 0x0D), or as plain text with each message simply starting with "MSH|".
 * Devices also batch multiple messages back-to-back on one TCP stream.
 *
 * This module owns only the framing/splitting concern — it knows nothing
 * about HL7 segment or field structure (that's hl7Parser.js). Device-agnostic:
 * every adapter benefits from this without change.
 */

// This is a network-exposed TCP port (HL7_PORT is published to the host) —
// the framer runs on every byte a connection sends *before* bedMap even
// checks whether the source is mapped, so an unbounded buffer is a real,
// unauthenticated memory-exhaustion DoS: a connection that never sends a
// second "MSH|" (or just streams garbage) would otherwise grow `buffer`
// forever. Real captured messages this session are a few KB at most, even
// with waveform data — 1 MiB is generous headroom, not a tight fit.
const MAX_BUFFER_BYTES = 1024 * 1024;

/** Creates a per-connection framer that accumulates partial TCP chunks and
 * yields complete raw HL7 messages as they become available. */
function createFramer() {
  let buffer = '';

  return {
    /**
     * @param {Buffer|string} chunk raw bytes/text received on the socket
     * @returns {string[]} zero or more complete, MLLP-stripped HL7 messages
     */
    push(chunk) {
      buffer += chunk.toString('utf8').replace(/\x0b/g, '').replace(/\x1c/g, '');

      // Split on MSH boundaries so multi-message batches (as real devices
      // send) are each parsed individually. Keep the last, possibly
      // incomplete, chunk buffered until more data arrives.
      const parts = buffer.split(/(?=^MSH\|)/m);
      buffer = parts.pop() || '';

      // No "MSH|" boundary ever arrived to flush it, and it's grown past
      // the cap — drop the accumulated (and evidently malformed/malicious)
      // data rather than let it grow without limit. This sacrifices one
      // bad message, not the process's memory.
      if (buffer.length > MAX_BUFFER_BYTES) {
        console.warn(`[mllpFraming] discarding ${buffer.length} buffered bytes with no message boundary (exceeded ${MAX_BUFFER_BYTES}-byte cap)`);
        buffer = '';
      }

      return parts.map((p) => p.trim()).filter(Boolean);
    },
  };
}

module.exports = { createFramer };
