# ICU Alarm Notification POC

Smartwatch alarm notifications for ICU patients via Web Push PWA.

## Architecture

```
Device Simulation → RabbitMQ (device.data.queue)
                         ↓ (shovel copy)
                    Alarm Engine (9020) → RabbitMQ (alarm.notify.queue) → Notification Service (9030) → Web Push → Phone → Watch

PWA (7031) ← polls vitals ← CIS Backend (7014)
PWA → Alarm Engine REST (alarm config)
PWA → Notification Service REST (push subscribe)
```

## Services

| Service | Container | Host Port | Description |
|---------|-----------|-----------|-------------|
| alarm-engine | CIS-alarm-engine | 7020 | Threshold checking, alarm publishing |
| notification-service | CIS-notification-service | 7030 | Web Push delivery |
| icu-watch-pwa | CIS-icu-watch-pwa | 7031 | Doctor mobile PWA |

## Quick Start

### 1. Prerequisites

Ensure these are already running (existing stack):

- RabbitMQ on port 7003 (management UI: 7004)
- MongoDB on port 7000
- CIS Backend on port 7014
- Device Simulation sending vitals

### 2. Setup RabbitMQ shovel (one-time)

The alarm engine listens on `alarm-engine.device.data.queue`. Run:

```powershell
.\CIS-Deployment\scripts\setup-rabbitmq-shovel.ps1
```

See [RABBITMQ-SETUP.md](CIS-Deployment/scripts/RABBITMQ-SETUP.md) for alternatives.

### 3. Start POC services

```powershell
docker compose up --build -d alarm-engine notification-service icu-watch-pwa
```

### 4. Demo URLs

- **PWA (doctor app):** http://localhost:7031
- **Alarm UI (manager view):** http://localhost:7020/alarm-ui
- **Alarm config API:** http://localhost:7020/api/alarm-config/doctor-001
- **Push subscriptions (debug):** http://localhost:7030/api/subscriptions

## Demo Scenario

### Login

- Doctor Name: `Dr. Demo`
- Doctor ID: `doctor-001`

### Preset thresholds (auto-seeded on first startup)

| Parameter | High | Low | Enabled |
|-----------|------|-----|---------|
| SpO2 | — | 90% | ✓ |
| HeartRate | 120 bpm | 50 bpm | ✓ |
| Temp1 | 38.5°C | — | ✓ |

### Enable watch notifications

1. Open http://localhost:7031 on your phone
2. Sign in as Dr. Demo
3. Go to **Notify** tab → tap **Enable Notifications**
4. **Add to Home Screen** (required for iOS watch mirroring)
5. Open the installed app and confirm notifications are active

### Trigger alarm during demo

Temporarily modify device simulation to send SpO2 = 85% for ~5 seconds:

```json
{ "paramName": "SpO2", "value": 85.0, "unit": "%" }
```

Expected result:

1. Alarm appears on http://localhost:7020/alarm-ui
2. Phone shows push notification: "⚠ ICU Alarm — BED-01 / SpO2 dropped to 85%"
3. Paired watch vibrates (CRITICAL pattern: 200-100-200-100-200 ms)

## API Reference

### Alarm Engine (port 7020)

```
POST   /api/alarm-config              Create/update thresholds
GET    /api/alarm-config/{doctorId}   List configs for doctor
DELETE /api/alarm-config/{doctorId}/{bedId}
GET    /alarm-ui                      Manager demo dashboard
```

### Notification Service (port 7030)

```
GET    /api/vapid-public-key
POST   /api/subscribe                 Register Web Push subscription
DELETE /api/subscribe/{doctorId}
GET    /api/subscriptions             Debug list
```

## Local Development (without Docker)

```powershell
# Alarm Engine
cd CIS-Deployment/alarmEngine
mvn spring-boot:run

# Notification Service
cd CIS-Deployment/notificationService
npm install
$env:VAPID_PUBLIC_KEY="BLKYwR9R10uXjN-4niWs483ccOlJFLSC0SahNIN7NZy_BTRuQ07UiT_ENTUV-mtjHGSWhutwD6bMu2jRBC-VFA4"
$env:VAPID_PRIVATE_KEY="567k1VQcCBf9V-xSND_osaQdf0MKKQy6mfSIChFMLEg"
$env:VAPID_EMAIL="mailto:poc@rtwo.com"
$env:RABBITMQ_URL="amqp://ICUcharting:admin%40123@localhost:7003/ICUcharting"
$env:MONGODB_URI="mongodb://monish:admin%40123@localhost:7000/?authSource=admin"
npm start

# PWA
cd CIS-Deployment/icuWatchPwa
npm install
npm run dev
```

## Notes

- **No Apple/Google developer accounts needed** — VAPID Web Push only
- **iOS 16.4+** required for PWA push notifications; app must be installed to home screen
- **Samsung/Wear OS:** Chrome on Android with watch paired via Bluetooth
- Alarm engine is stateless for threshold checks (30s MongoDB config cache)
- VAPID keys are embedded in docker-compose for POC; rotate for production
