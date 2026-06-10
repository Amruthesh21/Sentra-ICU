# RabbitMQ Shovel Setup for Alarm Engine

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
