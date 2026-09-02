# Device adapter contract

An adapter is a plain object with this shape. It is the *only* place a new
device model's quirks should live — never edit `core/hl7Parser.js` or
`core/mllpFraming.js` (or, for JSON devices, `core/jsonFraming.js`) to
special-case a device.

There are two device families, served by two servers on two ports —
`server/tcpServer.js` (HL7/MLLP, `HL7_PORT`) and `server/jsonServer.js`
(streamed JSON, `JSON_PORT`) — but **one shared adapter registry and one
shared `messages/deviceDataMessage.js` builder**. Which port a device
connects to is implied by its `deviceType` (an HL7 adapter is never reached
via `JSON_PORT` or vice versa); `bed-map.json`'s `deviceType` field is what
tells the registry which adapter to use either way.

```js
module.exports = {
  /** Value published as DeviceDataMessage.deviceType. */
  deviceType: 'SomeVendorMonitorModel',

  /**
   * Given one generic NM (numeric) observation from core/hl7Parser.js —
   * { code, text, codingSystem, rawValue, rawUnitField } — return the
   * canonicalized vital, or null to drop the observation entirely (e.g.
   * housekeeping fields like Height/Weight that aren't alarm-relevant vitals).
   *
   * Responsible for ALL of:
   *   - field-position quirks (which token in a coded field is the name/unit)
   *   - sentinel values ("-1" meaning "no data", not literally negative one)
   *   - vendor code/name -> canonical vital name mapping (the alarm engine
   *     and Hub UI only recognize specific names — see the worked example
   *     in bplVividVueM10.js for the current canonical set)
   *
   * @returns {{name: string, unit: string, value: number}|null}
   */
  mapObservation(genericObservation) { /* ... */ },

  /**
   * Which DeviceDataMessage bucket a canonical vital name belongs in.
   * primaryAttributes are the ones the alarm engine threshold-checks;
   * secondaryAttributes are informational only.
   * @returns {'primary'|'secondary'}
   */
  classify(canonicalName) { /* ... */ },

  /**
   * Optional. Interpret a CE-type OBX (device alert/status) into a
   * human-readable label. If omitted, the vendor's own text is passed
   * through unchanged.
   * @returns {{name: string, label: string}|null}
   */
  mapAlert(genericAlert) { /* ... */ },

  /**
   * Optional. Override HL7-standard CD (channel definition) interpretation
   * if this device's layout differs from the default
   * `code^name^scale&unit^...^sampleRate`. Most devices won't need this —
   * NA/CD are standard HL7 v2 waveform datatypes, decoded generically by
   * core/hl7Parser.js.
   * @returns {{channel: string, scale: number, unit: string, sampleRate: number|null}}
   */
  decodeWaveformMeta(name, obx5) { /* ... */ },

  /**
   * JSON-family adapters only (server/jsonServer.js calls this instead of
   * core/hl7Parser's parseHl7Message — omit entirely for an HL7 adapter).
   * Unlike HL7, there's no schema shared across JSON-speaking vendors (each
   * one nests its fields completely differently), so a JSON adapter owns
   * its *whole* parse, not just field-name mapping: given one raw JSON
   * message string (already framed by core/jsonFraming.js), flatten
   * whatever this device's own nesting looks like into the exact same
   * generic shape core/hl7Parser's parseHl7Message produces, so
   * mapObservation/classify/mapAlert and messages/deviceDataMessage.js's
   * builder all work completely unchanged either way.
   * @returns {{timestamp: string, patientId: string|null,
   *            observations: Array<{code: string, text: string, codingSystem: string,
   *                                  rawValue: string, rawUnitField: string}>,
   *            alerts: Array<object>, waveforms: object}}
   */
  parseObservations(rawJsonMessage) { /* ... */ },
};
```

## Onboarding a new device model

1. Capture a real export from the device (or its demo/self-test mode) — HL7
   or JSON, whichever it actually speaks.
2. Add `src/adapters/<yourDeviceModel>.js` implementing the contract above —
   copy `bplVividVueM10.js` (HL7) or `intelliVue.js` (JSON) as a starting
   point, whichever family it belongs to.
3. Register it in `src/adapters/registry.js`.
4. If the device connects on its own bed/IP, add it to `config/bed-map.json`
   — bed identity always comes from that mapping, never from the message
   itself (see `src/bedMapping/bedMap.js`). Give the entry a `deviceType`
   matching this adapter's `deviceType` (the plain-string bedId form still
   works and means "use the default HL7 adapter").
5. Add a fixture under `test/fixtures/` and a case in `test/parser.test.js`.

See the top of `bplVividVueM10.js` (HL7) or `intelliVue.js` (JSON) for a
worked example of everything a real device onboarding actually needed.
