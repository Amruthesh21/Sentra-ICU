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

**Scope note:** Connect Engine also serves REST APIs consumed elsewhere in
`alarm-engine` — see
[`ConnectEngineClient.java`](../../alarmEngine/src/main/java/com/sentraicu/alarmengine/service/ConnectEngineClient.java)
and
[`ConnectEngineSyncService.java`](../../alarmEngine/src/main/java/com/sentraicu/alarmengine/service/ConnectEngineSyncService.java)
for center/bed metadata sync, and Visualization Engine reads Connect
Engine's MongoDB documents directly. **`device-ingestion` replaces only the
raw device-vitals ingestion path** — it is not a full Connect Engine
replacement, and none of those other integrations were touched.

## What `device-ingestion` does instead

A direct TCP/MLLP HL7 listener → parses via a per-device-model adapter →
publishes straight to `alarm-engine.device.data.queue`, in the exact same
`DeviceDataMessage` JSON shape `DeviceDataConsumer` already expects.

This **bypasses** `device.data.queue` and the RabbitMQ shovel entirely —
that path belonged to Connect Engine / the device simulator and is left
completely alone. Nothing in `alarm-engine`, the shovel config, MongoDB
schema, or the Hub frontend needed to change.

## Confirmation

No code, configuration, class names, or package structure from Connect
Engine or the BPLCortexICU codebase were referenced, copied, or used as a
source for this service. The HL7 parser was built and validated entirely
against two real HL7 exports captured directly from a BPL VividVue M10
monitor (its live output and its own built-in demo-mode output) — treated
throughout as raw protocol data, not as anything derived from Connect
Engine's implementation. Connect Engine's own internal Mongo `_class`
discriminator strings (e.g. `com.rtwo.med.device.connect.mongo.dal.entities.*`,
still present in `alarm-engine`'s `ConnectEngineSyncBridge.java` /
`CenterAdminService.java` for writing documents Connect-Engine-based readers
can deserialize) were left untouched and were never referenced while
building this service.
