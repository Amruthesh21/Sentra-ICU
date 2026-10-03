# Local run — from a cold start, no assistant needed

Run these from the repo root (`E:\OneMind\Sentra-ICU`) in PowerShell, in order.
Every step here is a fix for something that actually broke during first setup.

## 1. Docker Desktop must be running
Check the whale icon in your system tray.

## 2. Create the docker network (one-time; the compose files expect it to already exist)
```bash
docker network create --subnet=172.31.0.0/16 --gateway=172.31.0.1 alarampoc_docker_compose_network
```
(Skip if you get "already exists".)

## 3. Copy the env file (one-time)
```bash
cp .env.example .env
```
Then edit `.env` and set:
- `SUPER_ADMIN_PASSWORD=` → pick a real password (blank = no super admin gets seeded)
- `HUB_AUTH_DEV_EXPOSE_OTP=true` → so MFA codes show on screen instead of needing real email
- `SMTP_ENABLED=false` → unless you actually have real SMTP creds
- `HUB_UI_PORT=7040` → 8000 is often taken by something else

## 4. Bring up infra (Mongo, RabbitMQ, Postgres)
```bash
docker compose -f docker-compose.infra.yml up -d
```

## 5. Bring up the app containers
```bash
docker compose -p alarampoc -f docker-compose.poc.yml up -d --build alarm-engine device-ingestion notification-service icu-connect-hub
```
First build takes a few minutes (Maven downloads everything). Watch it:
```bash
docker logs -f CIS-alarm-engine
```
Wait for `Started AlarmEngineApplication`.

## 6. Open the Hub
http://localhost:7040 — log in with the super admin email/password from step 3,
enter the on-screen MFA code, then use "+ Add hospital" to onboard a demo tenant
(the modal gives you the hospital admin's temp password).

## Known gaps
- **Doctor PWA (`icu-watch-pwa`) will not start** in this repo alone — its
  nginx config proxies to the *external* CIS backend / Connect Engine stack
  (a separate deployment, not part of this repo). Don't chase this without
  that other stack running on the same docker network.
- Editing `CIS-Deployment/deviceIngestion/config/bed-map.json` takes effect
  immediately (no restart) — it's re-read on every device connection.

## Feed it real device data (no hardware needed)

The committed `bed-map.json` starts **empty** (hospital mappings are site
data). Either map the source IP in Admin → Connect a device, or use
`simulation/simulate.js`, which logs in and maps for you. `replay.js` only
opens a TCP connection — without a mapping the messages land in quarantine.

```bash
cd CIS-Deployment/deviceIngestion
node test/replay.js test/fixtures/sample-real-device.hl7 localhost 7061
```
For a JSON-speaking device instead, send `test/fixtures/sample-intellivue.json`
(or any other `sample-*.json` fixture) to `localhost:7062` the same way.

The admin API (`/api/status`, `/api/quarantine`) isn't published to the host
— Hub calls `/device-ingestion/*`, nginx forwards to alarm-engine, and
alarm-engine proxies to device-ingestion (same Docker network locally, or
the hospital gateway URL over VPN in a split deploy). Easiest path: log into
the Hub UI at http://localhost:7040 and use Admin → "Connect a device".
To check by hand, get a token from `POST /api/auth/login` (+ `/api/auth/mfa/verify`
if MFA isn't already trusted) against alarm-engine on :7020, then `curl -H
"Authorization: Bearer <token>" http://localhost:7040/device-ingestion/api/status`.

## Production split (cloud Hub + hospital gateway)

Laptop all-in-one above is for development. A real hospital runs
`deviceIngestion` on the LAN and the Hub in the cloud. See
[CIS-Deployment/docs/HOSPITAL-GATEWAY.md](../../docs/HOSPITAL-GATEWAY.md).

## Stop everything
```bash
docker compose -p alarampoc -f docker-compose.poc.yml stop
docker compose -f docker-compose.infra.yml stop
```
