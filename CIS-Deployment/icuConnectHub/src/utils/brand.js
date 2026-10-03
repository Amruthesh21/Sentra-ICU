/** User-facing product brand. */
export const BRAND_NAME = 'Sentra ICU';

function scrubLegacyBrand(text) {
  return String(text)
    .replace(/\bRTWO\b/gi, BRAND_NAME)
    .replace(/\bSENTRA_ICU\b/gi, BRAND_NAME)
    .replace(/\bSentra ICU(?:\s+ICU)+\b/gi, BRAND_NAME)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize any center/display string to Sentra ICU branding. */
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

  const scrubbed = scrubLegacyBrand(text);
  return scrubbed || BRAND_NAME;
}
