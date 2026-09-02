/**
 * JSON message framing.
 * ------------------------
 * A second protocol family alongside HL7/MLLP (see core/mllpFraming.js) —
 * some real devices (patient monitors/ventilators, not just HL7 ones) speak
 * newline-agnostic streamed JSON instead: one complete JSON object per
 * logical message, back to back on the same TCP connection, with no
 * guaranteed delimiter between them (some emit a newline, some don't —
 * confirmed by inspecting real captured output from several device
 * models). Rather than assume one specific delimiter, this framer detects
 * complete top-level JSON objects directly via brace-depth counting, which
 * works regardless of whether messages happen to be newline-separated.
 *
 * Like mllpFraming.js, this module owns only the framing/splitting concern —
 * it knows nothing about what's inside a message (that's each JSON
 * adapter's own parseObservations, since — unlike HL7's shared OBX
 * structure — there's no schema shared across JSON-speaking device
 * vendors).
 */

/** Creates a per-connection framer that accumulates partial TCP chunks and
 * yields complete raw JSON message strings as they become available. */
function createFramer() {
  let buffer = '';
  let depth = 0;
  let msgStart = -1;
  let inString = false;
  let escapeNext = false;

  return {
    /**
     * @param {Buffer|string} chunk raw bytes/text received on the socket
     * @returns {string[]} zero or more complete raw JSON message strings
     */
    push(chunk) {
      const text = chunk.toString('utf8');
      const messages = [];

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        buffer += ch;

        if (escapeNext) { escapeNext = false; continue; }
        if (inString) {
          if (ch === '\\') escapeNext = true;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') { inString = true; continue; }

        if (ch === '{') {
          if (depth === 0) msgStart = buffer.length - 1;
          depth++;
        } else if (ch === '}') {
          if (depth > 0) depth--; // ignore a stray '}' with no matching '{' rather than go negative
          if (depth === 0 && msgStart >= 0) {
            messages.push(buffer.slice(msgStart, buffer.length));
            buffer = ''; // full message consumed; drop any stray bytes before the next '{'
            msgStart = -1;
          }
        }
      }

      return messages;
    },
  };
}

module.exports = { createFramer };
