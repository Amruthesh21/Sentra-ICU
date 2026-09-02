# RabbitMQ Shovel Setup for Alarm Engine

**This already happens automatically.** `docker-compose.poc.yml`'s
`rabbitmq-setup` service runs
[`rabbitmq-setup.sh`](rabbitmq-setup.sh) on every `docker compose up`,
creating both the queue and this shovel — no manual step needed for a normal
run of this repo. This doc (and the manual options below) exist for the one
case that still needs them: a legacy device that publishes to Connect
Engine's own `device.data.queue` rather than talking to `deviceIngestion`
directly. `deviceIngestion` itself bypasses this shovel entirely, publishing
straight to `alarm-engine.device.data.queue` — see
[MIGRATION-NOTE.md](../deviceIngestion/docs/MIGRATION-NOTE.md).

The Connect Engine consumes `device.data.queue`. To fan-out vitals to the alarm engine without modifying Connect Engine, bind a copy queue using a RabbitMQ shovel.

## Option A: RabbitMQ Management UI (port 7004)

1. Open http://localhost:7004 and log in
2. Go to **Admin → Shovel Management**
3. Create a new shovel:
   - **Name:** `device-data-to-alarm-engine`
   - **Source queue:** `device.data.queue`
   - **Destination queue:** `alarm-engine.device.data.queue`
   - **Ack mode:** `on-confirm`

## Option B: PowerShell script

Run once after RabbitMQ is up:

```powershell
.\CIS-Deployment\scripts\setup-rabbitmq-shovel.ps1
```

## Option C: rabbitmqadmin CLI

```bash
rabbitmqadmin declare queue name=alarm-engine.device.data.queue durable=true
rabbitmqadmin declare shovel name=device-data-to-alarm-engine \
  src-queue=device.data.queue \
  dest-queue=alarm-engine.device.data.queue \
  ack-mode=on-confirm
```

## Verify

Publish a test message to `device.data.queue` and confirm it appears in `alarm-engine.device.data.queue` (Queues tab in management UI).

Both queues must exist and be durable. The alarm engine auto-declares `alarm-engine.device.data.queue` and `alarm.notify.queue` on startup.
