/**
 * Safe lookup for the CANONICAL_NAME_MAP pattern every adapter uses.
 * ---------------------------------------------------------------------
 * Every adapter maps a vendor-supplied field name (OBX-3 text for HL7
 * devices, a JSON key for JSON devices — either way, attacker-controlled:
 * it comes straight off the network, before bedMap or anything else
 * validates the connection) through a plain object literal, e.g.
 * `CANONICAL_NAME_MAP[vendorName]`. A plain `{}` inherits from
 * `Object.prototype`, so a vendor name like "constructor", "toString", or
 * "__proto__" doesn't miss the lookup — it returns that inherited member
 * instead of `undefined`. Every call site already guards on falsiness
 * (`if (!canonicalName) return null`), and these inherited values are all
 * truthy (functions, or the prototype object itself), so they'd pass that
 * guard and flow downstream as a bogus "canonical name" — not a
 * prototype-pollution *write* (nothing here assigns through the result),
 * but a real correctness/robustness gap: a device that happened to send a
 * field named "constructor" would silently produce a malformed vital
 * instead of being dropped like any other unrecognized field.
 *
 * `Object.hasOwn` (Node 16.9+) sidesteps the prototype chain entirely
 * rather than requiring every map literal to be rewritten with a
 * null-prototype constructor.
 */
function safeLookup(map, key) {
  if (typeof key !== 'string' || !Object.hasOwn(map, key)) return undefined;
  return map[key];
}

module.exports = { safeLookup };
