# Device Ingestion Service

SentraICU's own bedside device gateway for the vitals-ingestion path —
replaces Connect Engine for this one function. Listens for HL7 v2 from a
patient monitor over TCP, parses it, and publishes straight to the same
RabbitMQ queue `alarm-engine`'s `DeviceDataConsumer` already consumes.

See [docs/MIGRATION-NOTE.md](docs/MIGRATION-NOTE.md) for exactly what this
does and does not replace.

## Quick start

```bash
npm install
cp config/bed-map.example.json config/bed-map.json   # then edit with real device IPs
RABBITMQ_URL="amqp://ICUcharting:admin%40123@localhost:7003/ICUcharting" npm start
```

Env vars (all optional, defaults shown — see [src/env.js](src/env.js)):

| Var | Default | Purpose |
|---|---|---|
| `RABBITMQ_URL` | `amqp://ICUcharting:admin%40123@localhost:7003/ICUcharting` | Same vhost/creds as alarm-engine |
| `DEVICE_DATA_QUEUE` | `alarm-engine.device.data.queue` | Must match alarm-engine's `alarm.rabbitmq.device-data-queue` property |
| `HTTP_PORT` | `9050` | Admin/health API |
| `HL7_PORT` | `6661` | TCP port monitors connect to |
| `BED_MAP_PATH` | `config/bed-map.json` | Admin-editable IP → bed mapping |
| `WAVEFORM_PUBLISH_ENABLED` | `false` | See "Waveforms" below |

## Admin API

- `GET /health` — liveness
- `GET /api/status` — per-bed last-message time, message count, last device alerts, latest waveform samples
- `GET /api/quarantine` — sources that sent data but have no bed-map entry (never silently dropped or guessed)
- `GET /api/bed-map` — current mapping
- `POST /api/bed-map/reload` — re-reads and validates `bed-map.json` from disk

## Testing

```bash
npm test
```

Runs `test/parser.test.js` against real captured device output in
`test/fixtures/` (patient name anonymized before committing) — covers the
`-1` sentinel, a real valid vital, non-vital field dropping, and waveform
CD+NA decoding.

## Bed identity — never trust the device

Real devices (confirmed against actual output) do not self-identify their
bed anywhere in the HL7 message. Bed identity always comes from
`config/bed-map.json`, keyed by the device's source IP — never inferred from
message content. A connection from an unmapped IP is quarantined (logged and
tracked via `GET /api/quarantine`), never silently dropped and never guessed
at.

## Adding a new device model

Each device model's quirks live entirely in its own adapter under
`src/adapters/` — the core parser (`src/core/hl7Parser.js`) never gets
special-cased per device. Full contract: [src/adapters/deviceAdapter.md](src/adapters/deviceAdapter.md).

### Worked example: what onboarding the BPL VividVue M10 actually needed

(from [src/adapters/bplVividVueM10.js](src/adapters/bplVividVueM10.js), validated against two real captures)

- **Vendor-coded fields, not LOINC/MDC.** `OBX-3` looks like `201^HR^BHC` —
  the human-readable name is the *second* token (`HR`), not the numeric
  code. The unit field (`OBX-6`) has the same shape — unit is also the
  second token.
- **`-1` means "no data"**, not literally negative one — sensor-off or
  no-reading states use this sentinel. Must be filtered out, not published
  as a real value.
- **Not every `NM` field is a vital.** `Height`, `Weight`, `Blood`, `Pace`
  ride along on the same OBX type but are demographic/config fields —
  dropped explicitly rather than mis-published.
- **Vendor names don't match the Hub's canonical vital names.** `HR` →
  `HeartRate`, `RR` → `Resp.Rate`, `NIBP S`/`Sys` → `NIBP Sys`, `T01` →
  `Temp1`, etc. — the adapter owns this mapping table so alarm-engine's
  existing threshold logic (which only recognizes specific names) actually
  fires.
- **Waveforms genuinely stream over HL7 for this device** — ECG (12 leads),
  SPO2 pleth, and RESP arrive as standard HL7 `NA` (numeric array) segments,
  scaled by a factor given in the preceding `CD` (channel definition)
  segment. That's a standard HL7 v2 datatype pair, not a vendor quirk, so
  it's decoded generically in `core/hl7Parser.js` — no adapter code needed
  for it unless a future device's `CD` layout differs.

## Waveforms (Phase 2 / best-effort)

Waveform decoding always runs (it's cheap, and already solved as a generic
HL7 datatype in core) and the latest samples per bed/channel are always
visible on `GET /api/status`. They are **not** published to alarm-engine's
`DeviceDataMessage` queue — that contract has no waveform field, and this
service intentionally doesn't extend it. If `WAVEFORM_PUBLISH_ENABLED=true`,
samples are also published to a separate fanout exchange
(`device-ingestion.waveform`) for a future consumer — nothing in this repo
subscribes to it today.

## No hardware? Use the demo simulator path

This service is independent of `alarm-engine`'s existing
`ALARM_DEMO_VITALS_ENABLED` fallback (see `alarmEngine`'s
`DemoVitalsPublisher.java`) — that path is untouched and keeps working
exactly as before, with or without this service running.
