# Migration note: Connect Engine → `device-ingestion`

## Why

Connect Engine's source code belongs to other parties whose license this
project no longer holds. It had to be replaced for the one function this
project actually owns and needs to keep working: turning bedside monitor
output into vitals data the alarm engine can threshold-check.

## What Connect Engine used to do (for this path)

Bedside HL7 device gateway → published to RabbitMQ `device.data.queue` →
copied by a RabbitMQ shovel → `alarm-engine.device.data.queue` →
`alarm-engine`'s `DeviceDataConsumer`.

**Scope note:** `device-ingestion` replaces only the raw device-vitals
ingestion path — it was never a full Connect Engine replacement.
`alarm-engine` used to also call out to a live Connect Engine host for
center/bed metadata sync (`ConnectEngineClient`/`ConnectEngineSyncService`/
`ConnectEngineBedSyncScheduler`/`ConnectEngineReloader`, all in
`alarm-engine/src/main/java/.../service/`) — every one of those calls always
failed in this deployment (no such host exists in any compose profile) and
had no effect beyond a caught exception and a log line, so that whole
integration surface was removed as dead code rather than kept as a
non-functional stub; see git history for
`com.sentraicu.alarmengine.service.ConnectEngineClient` etc. if you need the
old REST contract. Visualization Engine, an entirely separate deployment,
still reads Connect Engine's MongoDB documents directly and is unaffected —
`ConnectEngineSyncBridge.java`/`CenterAdminService.java` (below) keep writing
those documents.

## What `device-ingestion` does instead

Two direct TCP listeners — HL7/MLLP and JSON, since real devices use both —
each parsing via a per-device-model adapter, both converging on the same
publish step straight to `alarm-engine.device.data.queue`, in the exact same
`DeviceDataMessage` JSON shape `DeviceDataConsumer` already expects. 15
device models are supported today; see `src/adapters/registry.js` or
`GET /api/device-types`.

This **bypasses** `device.data.queue` and the RabbitMQ shovel entirely —
that path belonged to Connect Engine / the device simulator and is left
completely alone. Nothing in `alarm-engine`, the shovel config, MongoDB
schema, or the Hub frontend needed to change.

## Confirmation

No code, configuration, class names, or package structure from Connect
Engine's **server** — the thing this project no longer has rights to and
that `device-ingestion` exists specifically to replace — was ever
referenced, copied, or used as a source for this service. The original BPL
VividVue M10 adapter was built and validated entirely against two real HL7
exports captured directly from that device (its live output and its own
built-in demo-mode output), treated as raw protocol data. Connect Engine's
own internal Mongo `_class` discriminator strings (historically
`com.rtwo.med.device.connect.mongo.dal.entities.*`, now rewritten in
`alarm-engine`'s `ConnectEngineSyncBridge.java` / `CenterAdminService.java`
to Sentra ICU package names) were
left as document metadata and were never referenced.

**The other 14 adapters are a different, later situation, recorded here for
an honest provenance trail:** the user separately pointed at, and
explicitly confirmed rights to, Connect Engine's own device *simulator*
(legacy device-simulator workspace — the compiled jar plus
per-device `deviceData/*.data` captures and `xml/drivers.xml`'s port map) —
a distinct asset from the server source above, not covered by the same
restriction. That confirmation is what this note is recording, not
something this service inferred on its own. With that in hand:
- Each of the 14 additional adapters' canonical-name mappings and
  field-position logic were derived from that simulator's own captured
  `.data` files (real device output, not reverse-engineered server code).
- `xml/drivers.xml` (a per-device port list, not application logic) was
  read to discover which TCP port each device model's simulator connects
  to, purely to drive live verification.
- The simulator jar itself was run live, via a throwaway container, as an
  integration test against this service's real HL7/JSON listeners — its
  own internal server-side logic (Connect Engine's implementation, as
  opposed to the device-side simulator sending data) was never read,
  decompiled, or used as a reference for anything built here.
