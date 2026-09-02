# RabbitMQ Shovel Setup for Alarm Engine

**This already happens automatically when running via Docker.**
`docker-compose.poc.yml`'s `rabbitmq-setup` service runs
[`rabbitmq-setup.sh`](rabbitmq-setup.sh) on every `docker compose up`,
creating both the queue and this shovel — no manual step needed for a normal
Docker run of this repo. `deviceIngestion` itself bypasses this shovel
entirely, publishing straight to `alarm-engine.device.data.queue` — see
[MIGRATION-NOTE.md](../deviceIngestion/docs/MIGRATION-NOTE.md).

This doc (and `setup-rabbitmq-shovel.ps1`, Option B below) still matter for
two cases with no automatic container to do it for them:
- **`start-local.ps1`'s no-Docker path** — it calls
  `setup-rabbitmq-shovel.ps1` directly as its own step 1, since there's no
  `rabbitmq-setup` container in that flow. Keep this script; don't remove it
  even though the Docker path no longer needs it manually.
- A legacy device that publishes to Connect Engine's own `device.data.queue`
  rather than talking to `deviceIngestion` directly.

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
