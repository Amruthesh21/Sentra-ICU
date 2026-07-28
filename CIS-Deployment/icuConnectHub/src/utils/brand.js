/** User-facing product brand. Technical center id may still be RTWO for Connect Engine sync. */
export const BRAND_NAME = 'Sentra ICU';

function scrubRtwo(text) {
  return String(text)
    .replace(/\bRTWO\b/gi, BRAND_NAME)
    .replace(/\bSentra ICU(?:\s+ICU)+\b/gi, BRAND_NAME)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Scrub legacy RTWO labels from any center/display string for the UI.
 * "RTWO JPN" → "Sentra ICU JPN", "RTWO" → "Sentra ICU"
 */
export function brandCenterLabel(...parts) {
  const cleaned = parts
    .flat()
    .filter((p) => p != null && String(p).trim() !== '')
    .map((p) => String(p).trim());

  if (!cleaned.length) return BRAND_NAME;

  let text = cleaned[0];
  for (let i = 1; i < cleaned.length; i += 1) {
    const part = cleaned[i];
    if (!text.toUpperCase().includes(part.toUpperCase())) {
      text = `${text} ${part}`;
    }
  }

  const scrubbed = scrubRtwo(text);
  return scrubbed || BRAND_NAME;
}
