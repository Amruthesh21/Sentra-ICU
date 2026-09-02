# Live Production Deployment — Split Architecture Guide

**Scenario:** Connect Engine + RabbitMQ run on the **hospital (client) server**. ICU Connect Hub + Alarm Engine run on the **RTWO cloud server**.

> **Status note:** this document was written when Connect Engine was the only
> option for the hospital-side device gateway. That's no longer true — this
> repo now has its own bedside device gateway, `deviceIngestion`
> (`CIS-Deployment/deviceIngestion/`, see its `docs/MIGRATION-NOTE.md` and
> `docs/RUNBOOK.md`), built specifically because Connect Engine's own source
> isn't available to this project. The split-deployment *concept* below
> (Hub + Alarm Engine centralized on a cloud server, the device gateway
> staying on the hospital LAN) still applies — but read every "Connect
> Engine" reference below as "whichever device gateway you're actually
> running," and prefer `deviceIngestion` for real hardware today.
> Device-specific sections (§7 MongoDB Strategy, §9 Connect Engine Changes)
> describe the Connect-Engine-only path and haven't been re-verified against
> `deviceIngestion`, which bypasses that path entirely by publishing straight
> to `alarm-engine.device.data.queue`.

**Companion document:** [ARCHITECTURE-HANDOVER.md](./ARCHITECTURE-HANDOVER.md) — full system architecture

**Last updated:** July 2026

---

## Table of Contents

1. [Why Split Deployment](#1-why-split-deployment)
2. [Target Architecture](#2-target-architecture)
3. [What Stays Where](#3-what-stays-where)
4. [Network & Connectivity Requirements](#4-network--connectivity-requirements)
5. [Configuration Changes — Client Site](#5-configuration-changes--client-site)
6. [Configuration Changes — RTWO Cloud](#6-configuration-changes--rtwo-cloud)
7. [MongoDB Strategy](#7-mongodb-strategy)
8. [RabbitMQ Strategy](#8-rabbitmq-strategy)
9. [Connect Engine Changes](#9-connect-engine-changes)
10. [Alarm Engine Changes](#10-alarm-engine-changes)
11. [Hub Frontend Changes](#11-hub-frontend-changes)
12. [Security Checklist](#12-security-checklist)
13. [Deployment Steps](#13-deployment-steps)
14. [Verification Checklist](#14-verification-checklist)
15. [Failure Modes & Fallbacks](#15-failure-modes--fallbacks)
16. [What Will NOT Work Without Changes](#16-what-will-not-work-without-changes)

---

## 1. Why Split Deployment

| Reason | Detail |
|--------|--------|
| **Device proximity** | Bedside monitors connect over hospital LAN. Connect Engine must sit on the same network as devices. |
| **Data sovereignty** | Raw device vitals may need to stay inside hospital firewall. |
| **Cloud Hub** | RTWO hosts the clinical UI, auth, analytics, and alarm logic centrally for multiple hospitals. |
| **Operational separation** | Hospital IT manages CE + RabbitMQ; RTWO manages Hub updates and releases. |

---

## 2. Target Architecture

```mermaid
flowchart TB
    subgraph Hospital["Hospital Site (Client Server)"]
        DEV[Bedside Devices<br/>Monitors, Pumps, Ventilators]
        CE[Connect Engine<br/>:9010]
        RMQ_C[RabbitMQ<br/>:5672]
        MG_C[(MongoDB<br/>v2-ICU-Connect)]
        DEV -->|LAN| CE
        CE --> MG_C
        CE --> RMQ_C
        RMQ_C -->|device.data.queue| CE
    end

    subgraph RTWO["RTWO Cloud Server"]
        HUB[ICU Connect Hub<br/>:443 HTTPS]
        AE[Alarm Engine<br/>:7020]
        PG[(PostgreSQL icu_hub)]
        NS[Notification Service]
        PWA[ICU Watch PWA]
        HUB --> AE
        AE --> PG
        AE --> NS
    end

    CE -->|VPN / TLS tunnel<br/>Mongo replication OR<br/>REST vitals push| AE
    RMQ_C -->|VPN / TLS / Shovel<br/>to cloud RabbitMQ| AE
    AE -.->|CONNECT_ENGINE_URL<br/>HTTPS over VPN| CE
```

### Data flows in split mode

| Flow | Path | Protocol |
|------|------|----------|
| Device vitals → CE | Hospital LAN | Device protocol (HL7, proprietary) |
| CE → Mongo (local) | Docker internal | Mongo wire protocol |
| CE → RabbitMQ (local) | Docker internal | AMQP |
| RabbitMQ → Alarm Engine | **Cross-site** | AMQP over VPN/TLS |
| Alarm Engine → Mongo vitals read | **Cross-site** OR local cache | Mongo wire / REST |
| Hub admit/discharge → CE | Alarm Engine → CE | HTTPS REST + Mongo sync |
| Hub UI → Alarm Engine | Same cloud host | HTTP internal |

---

## 3. What Stays Where

### Hospital (client) server

| Component | Required | Notes |
|-----------|----------|-------|
| Connect Engine | **Yes** | Device gateway — must be on hospital LAN |
| RabbitMQ | **Yes** | `device.data.queue` — devices publish here |
| MongoDB | **Recommended** | CE operational store; can replicate to cloud |
| Device simulators | Demo only | Not needed in production |
| CIS Backend / nginx | Optional | Legacy CIS UI — not needed for Hub V2 |
| ICU Connect Hub | **No** | Runs on RTWO cloud |
| Alarm Engine | **No** | Runs on RTWO cloud |
| PostgreSQL | **No** | Runs on RTWO cloud |

### RTWO cloud server

| Component | Required | Notes |
|-----------|----------|-------|
| ICU Connect Hub | **Yes** | Main web UI — expose via HTTPS :443 |
| Alarm Engine | **Yes** | All `/api/*` backend |
| PostgreSQL | **Yes** | Hub master data |
| MongoDB | **Depends** | See [Section 7](#7-mongodb-strategy) |
| RabbitMQ | **Depends** | See [Section 8](#8-rabbitmq-strategy) |
| Notification Service | **Yes** | Web Push for doctor alarms |
| ICU Watch PWA | **Yes** | Doctor mobile app |
| Connect Engine | **No** | Stays at hospital |

---

## 4. Network & Connectivity Requirements

### 4.1 Minimum connectivity matrix

| From (RTWO Cloud) | To (Hospital) | Port | Protocol | Purpose |
|-------------------|---------------|------|----------|---------|
| Alarm Engine | Connect Engine | 9010 or 443 | HTTPS | `/retrieve`, health checks |
| Alarm Engine | Hospital MongoDB | 27017 | Mongo (TLS) | Read `historyVitals`, write `centerEntity` sync |
| Alarm Engine / Notification | Hospital RabbitMQ | 5672 | AMQP (TLS) | Consume `alarm-engine.device.data.queue` |
| Hospital CE | RTWO Alarm Engine | 7020 or 443 | HTTPS | Optional: push vitals REST fallback |
| Clinicians (browser) | RTWO Hub | 443 | HTTPS | Hub UI access |
| Doctors (phone) | RTWO PWA + Notification | 443 | HTTPS | Web Push |

### 4.2 Recommended: site-to-site VPN

Use an **IPsec or WireGuard VPN** between hospital and RTWO cloud:

```
Hospital subnet:  10.10.0.0/24  (example)
RTWO cloud subnet: 10.20.0.0/24  (example)
```

All cross-site traffic travels over VPN. No public exposure of MongoDB or RabbitMQ ports.

### 4.3 Alternative: TLS reverse proxy / API gateway

If VPN is not possible:
- Expose Connect Engine REST API via **nginx + TLS** on hospital DMZ (port 443 only)
- Use **RabbitMQ federation or shovel** from hospital → cloud RabbitMQ over TLS (port 5671)
- **Never** expose MongoDB port 27017 to the public internet

### 4.4 Latency requirements

| Path | Max acceptable latency |
|------|----------------------|
| Vitals RabbitMQ → Alarm Engine | < 500ms (ideal < 100ms) |
| Hub dashboard poll (3s interval) | N/A — cloud-local |
| CE restart after bed add | 15–30s (existing debounce) |
| Mongo vitals fallback poll | 2s (existing scheduler) |

### 4.5 Firewall rules (hospital side)

```
ALLOW inbound from RTWO_VPN_IP → Connect Engine :9010 (or :443)
ALLOW inbound from RTWO_VPN_IP → RabbitMQ :5671 (AMQPS)
ALLOW inbound from RTWO_VPN_IP → MongoDB :27017 (if shared Mongo)
DENY all other inbound
```

### 4.6 Firewall rules (RTWO cloud side)

```
ALLOW inbound from INTERNET → Hub :443 (HTTPS)
ALLOW inbound from INTERNET → PWA :443
ALLOW inbound from HOSPITAL_VPN_IP → Alarm Engine :7020 (internal only, not public)
DENY MongoDB :7000 from internet
DENY RabbitMQ :7003 from internet
```

---

## 5. Configuration Changes — Client Site

### 5.1 Connect Engine environment

```yaml
# hospital docker-compose.yml — connectengine service
environment:
  SPRING_DATA_MONGODB_URI: "mongodb://<user>:<pass>@localhost:27017/v2-ICU-Connect?authSource=admin"
  SPRING_RABBITMQ_HOST: localhost          # or rabbitmq container name
  SPRING_RABBITMQ_PORT: "5672"
  SPRING_RABBITMQ_VIRTUAL_HOST: ICUcharting
  SPRING_RABBITMQ_USERNAME: ICUcharting
  SPRING_RABBITMQ_PASSWORD: <strong-password>
```

**No change to CE device routing** — beds still connect by hospital LAN IP.

### 5.2 RabbitMQ — add cross-site shovel (hospital → cloud)

On **hospital RabbitMQ**, create a shovel that forwards vitals to RTWO cloud:

```json
{
  "name": "hospital-to-rtwo-alarm-engine",
  "src-uri": "amqp://ICUcharting:<pass>@localhost:5672/ICUcharting",
  "src-queue": "device.data.queue",
  "dest-uri": "amqps://ICUcharting:<pass>@<RTWO_CLOUD_RABBITMQ_HOST>:5671/ICUcharting",
  "dest-queue": "alarm-engine.device.data.queue",
  "ack-mode": "on-confirm"
}
```

> **Important:** In split mode, the existing local shovel (`device.data.queue` → `alarm-engine.device.data.queue` on same broker) is **not needed on hospital side** if Alarm Engine runs in cloud. The cross-site shovel replaces it.

### 5.3 RabbitMQ TLS (production)

Enable TLS on both hospital and cloud RabbitMQ:

```ini
# rabbitmq.conf
listeners.ssl.default = 5671
ssl_options.cacertfile = /etc/rabbitmq/ca.crt
ssl_options.certfile   = /etc/rabbitmq/server.crt
ssl_options.keyfile    = /etc/rabbitmq/server.key
ssl_options.verify     = verify_peer
ssl_options.fail_if_no_peer_cert = false
```

### 5.4 MongoDB — hospital side

Keep MongoDB on hospital server for Connect Engine. Options for cloud access:

**Option A (recommended for POC):** Cloud Alarm Engine connects to hospital Mongo over VPN  
**Option B:** MongoDB replica set with secondary on RTWO cloud (read-only for vitals)  
**Option C:** Remove direct Mongo access; CE pushes vitals via REST to Alarm Engine (requires CE code change — not available in current JAR)

---

## 6. Configuration Changes — RTWO Cloud

### 6.1 `.env` on RTWO cloud server

```bash
# Connect Engine — hospital VPN IP
CONNECT_ENGINE_URL=https://<HOSPITAL_VPN_IP>:9010
# OR if behind nginx TLS:
CONNECT_ENGINE_URL=https://connect-engine.hospital.internal

# Disable Docker CE restart (CE is remote — cannot restart via local docker.sock)
CONNECT_ENGINE_AUTO_RESTART=false
CONNECT_ENGINE_CONTAINER=

# MongoDB — hospital Mongo over VPN (if using shared Mongo)
SPRING_DATA_MONGODB_URI=mongodb://<user>:<pass>@<HOSPITAL_VPN_IP>:27017/?authSource=admin

# RabbitMQ — local cloud instance (receives shovel from hospital)
SPRING_RABBITMQ_HOST=CIS-rabbitmq
SPRING_RABBITMQ_PORT=5672
ALARM_DEVICE_DATA_QUEUE=alarm-engine.device.data.queue

# Auth — enforce in production
HUB_AUTH_ENFORCED=true
HUB_AUTH_DEV_EXPOSE_OTP=false
HUB_AUTH_JWT_SECRET=<generate-strong-256-bit-secret>

# Hub port
HUB_UI_PORT=8000

# SMTP for MFA / password reset
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=<email>
SMTP_PASSWORD=<app-password>
AUTH_MAIL_FROM=noreply@rtwo.com
```

### 6.2 `docker-compose.poc.yml` changes on RTWO cloud

```yaml
alarm-engine:
  environment:
    CONNECT_ENGINE_URL: ${CONNECT_ENGINE_URL}
    CONNECT_ENGINE_AUTO_RESTART: "false"    # CRITICAL — no local CE container
    # Remove CONNECT_ENGINE_CONTAINER
    # Remove docker.sock volume mount:
  volumes:
    # DELETE: - /var/run/docker.sock:/var/run/docker.sock
    SPRING_DATA_MONGODB_URI: ${SPRING_DATA_MONGODB_URI}
```

**Remove docker.sock mount** — Alarm Engine must not restart remote CE containers. CE restart in split mode must be done manually or via a hospital-side management API.

### 6.3 Replace CE restart with remote reload API

Current code uses `ConnectEngineReloader` → Docker socket. For split deployment:

**Short-term (no code change):**
- Hospital admin manually restarts CE container after Hub bed changes
- Use `POST /api/center/reload` only if CE is reachable and hospital exposes a restart webhook

**Long-term (code change needed):**
- Add `CONNECT_ENGINE_RELOAD_URL` env var pointing to hospital management endpoint
- Replace `ConnectEngineReloader` Docker call with HTTP POST to hospital restart API
- Or enable Connect Engine `/update` API (currently returns 403)

### 6.4 HTTPS for Hub UI (production)

Put nginx or Traefik in front of Hub:

```nginx
server {
    listen 443 ssl;
    server_name hub.rtwo.com;

    ssl_certificate     /etc/ssl/hub.crt;
    ssl_certificate_key /etc/ssl/hub.key;

    location / {
        proxy_pass http://CIS-icu-connect-hub:80;
    }

    location /api/ {
        proxy_pass http://CIS-alarm-engine:9020/api/;
        proxy_read_timeout 60s;
    }
}
```

---

## 7. MongoDB Strategy

### Current POC behavior

| Data | Master | Mirror |
|------|--------|--------|
| Patients, visits, beds (Hub) | PostgreSQL (cloud) | Mongo `centerEntity` (synced by Alarm Engine) |
| Vitals history | Mongo `historyVitals` (written by CE) | — |
| Alarm thresholds | Mongo `doctorAlarmConfig` (cloud) | — |

### Split deployment options

#### Option A — Single MongoDB at hospital (simplest for vitals)

```
Hospital MongoDB (master for CE data)
    ↑ CE writes historyVitals
    ↑ Alarm Engine (cloud) reads historyVitals over VPN
    ↑ Alarm Engine writes centerEntity sync (admit/discharge)
```

**Pros:** No vitals replication needed; CE unchanged  
**Cons:** Cloud Alarm Engine depends on hospital Mongo uptime; network latency on reads

**Config:**
```bash
# RTWO cloud .env
SPRING_DATA_MONGODB_URI=mongodb://user:pass@<HOSPITAL_VPN_IP>:27017/?authSource=admin
```

#### Option B — MongoDB at both sites with replication

```
Hospital MongoDB (primary)  ──replica set──►  RTWO MongoDB (secondary, read-only)
```

**Pros:** Cloud reads local Mongo; faster vitals API  
**Cons:** Replication setup complexity; sync lag; `centerEntity` writes need conflict resolution

#### Option C — Cloud MongoDB only (not recommended without CE changes)

CE currently **requires local MongoDB**. Running CE against remote Mongo over VPN adds latency to every device write. Only viable on low-latency dedicated links.

### What Alarm Engine reads from Mongo (cloud perspective)

| Collection | Read frequency | Impact if hospital Mongo down |
|------------|---------------|-------------------------------|
| `historyVitals` | Every 2s (scheduler) + on-demand | Vitals show stale or virtual |
| `centerEntity` | On dashboard load | Bed list empty |
| `doctorAlarmConfig` | Every 30s cache | Uses cached thresholds |
| `hubTrendVitals` | On history/charts | Charts empty |

### Postgres → Mongo sync in split mode

`ConnectEngineSyncBridge` still writes `centerEntity` + `patientInfoEntity` to Mongo after admit/discharge. In Option A, these writes go to **hospital Mongo over VPN**. CE picks them up on next restart.

**Action required:** Ensure `ConnectEngineSyncBridge` Mongo URI points to hospital Mongo in split config.

---

## 8. RabbitMQ Strategy

### Current POC (single site)

```
device.data.queue ──shovel (same broker)──► alarm-engine.device.data.queue
                                              └── Alarm Engine consumes
```

### Split deployment (recommended)

```
[HOSPITAL]
device.data.queue ──shovel (cross-site TLS)──► [CLOUD] alarm-engine.device.data.queue
                                                      └── Alarm Engine consumes
                                                      └── alarm.notify.queue
                                                              └── Notification Service
```

### Cloud RabbitMQ setup

RTWO cloud runs its own RabbitMQ instance (already in `docker-compose.infra.yml`):

```bash
# On RTWO cloud — ensure queue exists (alarm-engine auto-declares on startup)
docker compose -f docker-compose.infra.yml up -d
docker compose -f docker-compose.poc.yml up -d alarm-engine
```

### Hospital shovel to cloud

Create via hospital RabbitMQ Management UI (port 15672) or CLI:

```bash
rabbitmqadmin -H hospital-rabbitmq -P 15672 \
  declare shovel name=hospital-to-rtwo \
  src-uri="amqp://ICUcharting:pass@localhost:5672/ICUcharting" \
  src-queue=device.data.queue \
  dest-uri="amqps://ICUcharting:pass@<CLOUD_IP>:5671/ICUcharting" \
  dest-queue=alarm-engine.device.data.queue \
  ack-mode=on-confirm
```

### RabbitMQ federation (alternative to shovel)

For high-volume multi-hospital deployments, use **RabbitMQ Federation** plugin:

```
Hospital exchange: device.data  ──federated──►  Cloud exchange: device.data
                                                      └── bound to alarm-engine.device.data.queue
```

### What happens to `alarm.notify.queue`

This queue stays **entirely on RTWO cloud** — Notification Service and Alarm Engine are co-located. No cross-site traffic for notifications.

---

## 9. Connect Engine Changes

### What does NOT need to change

- Device protocol handling
- Local bed IP routing
- Publishing to `device.data.queue`
- Writing `historyVitals` to local MongoDB
- Loading `centerEntity` from MongoDB on startup

### What needs attention

| Item | Current | Split deployment |
|------|---------|-----------------|
| MongoDB URI | `localhost:27017` or Docker internal | Hospital local Mongo (unchanged) |
| RabbitMQ URI | Local RabbitMQ | Hospital local RabbitMQ (unchanged) |
| `/update` API | Returns 403 | **Enable for split** OR use manual restart after Hub changes |
| Network access | Internal Docker | Hospital LAN for devices; VPN for cloud API access |
| Center ID | `RTWO` / `JPN` | Must match Hub `hub_centers.id` in cloud Postgres |

### Exposing CE REST API to RTWO cloud

Hospital nginx TLS proxy:

```nginx
# hospital nginx — expose only /retrieve and /health to RTWO VPN IP
server {
    listen 9010 ssl;
    allow <RTWO_VPN_IP>;
    deny all;

    location /retrieve { proxy_pass http://connectengine:9010; }
    location /health   { proxy_pass http://connectengine:9010; }
    # Do NOT expose /update publicly without authentication
}
```

Alarm Engine uses `GET /retrieve` for drift detection (`ConnectEngineBedSyncScheduler`).

### CE restart after Hub bed changes (split mode)

**Problem:** `ConnectEngineReloader` uses local Docker socket — won't work from cloud.

**Solutions (pick one):**

1. **Manual process:** Hospital IT restarts CE after RTWO admin adds beds (document in runbook)
2. **Hospital webhook:** Small script on hospital server listens for HTTP POST from RTWO, runs `docker restart connectengine`
3. **Enable `/update` API:** Fix 403 in CE JAR — Alarm Engine can push bed changes directly
4. **Shared Mongo only:** If `centerEntity` is updated in hospital Mongo by cloud Alarm Engine, schedule CE restart via hospital cron or systemd timer

---

## 10. Alarm Engine Changes

### Required configuration changes

| Setting | POC value (current default) | Split production value |
|---------|-----------|----------------------|
| `CONNECT_ENGINE_URL` | `http://CIS-Deployment-connect-engine:9010` | `https://<hospital-vpn-ip>:9010` |
| `CONNECT_ENGINE_AUTO_RESTART` | `false` (already off by default — Docker socket isn't mounted either) | `false` (still off; no local CE container to restart) |
| `CONNECT_ENGINE_CONTAINER` | `CIS-Deployment-connect-engine` | *(empty / removed)* |
| Docker socket mount | *(not mounted by default)* | **Stays removed** |
| `SPRING_DATA_MONGODB_URI` | `CIS-mongodb:27017` | Hospital Mongo VPN IP OR cloud replica |
| `SPRING_RABBITMQ_HOST` | `CIS-rabbitmq` | Cloud local RabbitMQ |
| `HUB_AUTH_ENFORCED` | `true` (already the default — the alternative is most endpoints reachable with no auth) | `true` |
| `HUB_AUTH_JWT_SECRET` | dev default | Strong random secret |

### Code changes recommended for production

| Change | File | Reason |
|--------|------|--------|
| Remote CE reload | `ConnectEngineReloader.java` | Replace Docker socket with HTTP webhook |
| Configurable Mongo timeout | `application.properties` | Handle VPN latency |
| Health check endpoint | New controller | Monitor hospital connectivity |
| Circuit breaker for CE | `ConnectEngineClient.java` | Graceful degradation when hospital offline |
| Remove `MongoVitalsSyncScheduler` dependency | Optional | If RabbitMQ cross-site is reliable |

### Services that continue working without CE

| Feature | Works offline from CE? |
|---------|----------------------|
| Hub login / auth | Yes (Postgres local) |
| Clinical notes, orders | Yes (Postgres local) |
| Admissions (Postgres) | Yes — but CE won't see patient until sync |
| Live vitals | **No** — needs RabbitMQ or Mongo from hospital |
| Alarms | **No** — needs vitals stream |
| Virtual vitals (simulation) | Yes — for beds without live devices |

---

## 11. Hub Frontend Changes

### No code changes required for basic split

Hub SPA uses relative `/api/*` paths. As long as nginx proxies to Alarm Engine on the same cloud host, the frontend works unchanged.

### Production considerations

| Item | Change needed |
|------|--------------|
| HTTPS | Configure nginx TLS — no frontend change |
| CORS | Not needed (same-origin via nginx proxy) |
| Polling interval | 3s dashboard poll — acceptable for cloud |
| WebSocket upgrade | Not implemented — future enhancement for lower latency |
| `doctorId` localStorage | Consider binding to authenticated user ID in production |

### PWA / Notification Service

Notification Service must be reachable at HTTPS for Web Push:

```bash
# notification-service env
VAPID_PUBLIC_KEY=<production-key>
VAPID_PRIVATE_KEY=<production-key>
PUBLIC_URL=https://watch.rtwo.com
```

Rotate VAPID keys from POC defaults in `docker-compose.poc.yml`.

---

## 12. Security Checklist

### Before go-live

- [ ] `HUB_AUTH_ENFORCED=true` on Alarm Engine
- [ ] Strong `HUB_AUTH_JWT_SECRET` (256-bit random)
- [ ] Rotate MongoDB credentials from `monish:admin@123` (set `INFRA_MONGO_USER`/`INFRA_MONGO_PASSWORD`/`INFRA_MONGO_PASSWORD_URLENC` in `.env` — no compose file editing needed)
- [ ] Rotate RabbitMQ credentials from `ICUcharting:admin@123` (`INFRA_RABBITMQ_USER`/`INFRA_RABBITMQ_PASSWORD`/`INFRA_RABBITMQ_PASSWORD_URLENC`)
- [ ] RabbitMQ AMQPS (TLS) on port 5671 for cross-site shovel
- [ ] MongoDB authentication + TLS for cross-site access
- [ ] VPN between hospital and RTWO cloud (no public Mongo/Rabbit ports)
- [ ] HTTPS on Hub UI (port 443)
- [ ] Remove `HUB_AUTH_DEV_EXPOSE_OTP=true`
- [ ] Remove Docker socket mount from Alarm Engine
- [ ] Rotate VAPID keys for Web Push
- [ ] SMTP configured for real MFA emails
- [ ] Firewall: hospital CE API accessible only from RTWO VPN IP
- [ ] Postgres backups scheduled on RTWO cloud
- [ ] MongoDB backups scheduled on hospital server
- [ ] Audit logging enabled (`hub_auth_audit` table)

---

## 13. Deployment Steps

### Phase 1 — Hospital site setup

```bash
# 1. Deploy Connect Engine + RabbitMQ + MongoDB (existing CIS stack)
cd /opt/cis-deployment
docker compose up -d connectengine rabbitmq mongodb

# 2. Verify devices connecting
curl http://localhost:9010/retrieve

# 3. Verify vitals flowing
# Check RabbitMQ Management UI → Queues → device.data.queue (message rate > 0)
# Check MongoDB → v2-ICU-Connect → historyVitals (documents growing)

# 4. Setup VPN to RTWO cloud
# (WireGuard / IPsec — follow your network team's process)

# 5. Create cross-site RabbitMQ shovel (after cloud RabbitMQ is up)
# See Section 8
```

### Phase 2 — RTWO cloud setup

```bash
# 1. Clone repo and configure .env
cp .env.example .env
# Edit: CONNECT_ENGINE_URL, SPRING_DATA_MONGODB_URI, HUB_AUTH_*, SMTP_*

# 2. Start infrastructure
docker compose -f docker-compose.infra.yml up -d
sleep 20

# 3. Start application services (no CE, no docker.sock)
docker compose -f docker-compose.poc.yml up -d alarm-engine icu-connect-hub notification-service icu-watch-pwa

# 4. Configure HTTPS reverse proxy (nginx/Traefik)
# See Section 6.4

# 5. Bootstrap super admin
./CIS-Deployment/scripts/bootstrap-super-admin.sh
```

### Phase 3 — Integration verification

```bash
# From RTWO cloud — test hospital connectivity
curl -k https://<HOSPITAL_VPN_IP>:9010/retrieve

# Test vitals pipeline
curl http://localhost:7020/api/vitals/latest/<BED_ID>

# Test alarm
curl http://localhost:7020/api/alarm/active

# Test Hub UI
curl https://hub.rtwo.com/
```

### Phase 4 — Hospital shovel activation

```bash
# On hospital RabbitMQ — create shovel to cloud
# Verify message rate on cloud alarm-engine.device.data.queue
# Verify Alarm Engine logs: "DeviceDataConsumer received message"
```

---

## 14. Verification Checklist

### Hospital site

| Check | Command / UI | Expected |
|-------|-------------|----------|
| CE running | `curl localhost:9010/retrieve` | JSON with beds array |
| Devices connected | CE retrieve → bed device status | `connected: true` |
| Vitals in Mongo | `mongosh → db.historyVitals.find().limit(1)` | Recent document |
| RabbitMQ queue | Management UI → `device.data.queue` | Message rate > 0 |
| VPN to RTWO | `ping <RTWO_VPN_IP>` | Replies |
| Shovel active | Management UI → Shovels | State: running |

### RTWO cloud

| Check | Command / UI | Expected |
|-------|-------------|----------|
| Alarm Engine up | `curl localhost:7020/api/alarm/active` | HTTP 200 |
| Hub UI up | `curl localhost:8000/` | HTTP 200 |
| Vitals from hospital | `curl localhost:7020/api/vitals/latest/<BED>` | `source: cis-live` |
| Alarms firing | Lower SpO2 threshold, wait | Alarm in `/api/alarm/active` |
| Auth enforced | `curl localhost:7020/api/hub/units` (no token) | HTTP 401 |
| HTTPS | `curl https://hub.rtwo.com/` | HTTP 200 |
| Push notification | PWA → Enable Notifications → trigger alarm | Phone vibrates |

### End-to-end

| Scenario | Steps | Expected |
|----------|-------|----------|
| Admit patient | Hub → Patients → Admit | Patient on bed in dashboard |
| CE sees patient | Hospital: `curl /retrieve` | Patient name on bed |
| Live vitals | Open bed detail | Vitals updating every 3s |
| Alarm | Set SpO2 threshold above live value | Alarm sound + notification |
| Add bed | Hub Admin → Add bed | Bed appears (CE restart needed in split) |
| Discharge | Hub → Discharge | Bed empty, CE updated after restart |

---

## 15. Failure Modes & Fallbacks

| Failure | Symptom | Fallback | Recovery |
|---------|---------|----------|----------|
| VPN down | No vitals, no alarms | Virtual vitals for demo beds; Hub clinical still works | Restore VPN |
| Hospital RabbitMQ down | No new vitals | `MongoVitalsSyncScheduler` reads last `historyVitals` if Mongo reachable | Restart RabbitMQ |
| Hospital Mongo down | Stale vitals, no bed list | In-memory Rabbit cache (seconds) | Restore Mongo |
| Hospital CE down | No device data at all | Virtual vitals only | Restart CE container |
| Cloud Alarm Engine down | Hub UI loads but no data | None — critical service | Restart alarm-engine |
| Cloud Postgres down | Hub completely down | None — critical service | Restore from backup |
| CE restart not triggered | New bed not in CE | Manual `docker restart connectengine` on hospital | Enable `/update` API or webhook |
| Shovel stopped | Vitals stop updating | Mongo poll fallback (2s delay) | Restart shovel |

### Monitoring recommendations

| Metric | Alert threshold |
|--------|----------------|
| `device.data.queue` message rate | 0 for > 60 seconds |
| `alarm-engine.device.data.queue` depth | > 1000 messages |
| VPN tunnel status | Down |
| CE `/retrieve` response time | > 5 seconds |
| Alarm Engine health | HTTP non-200 |
| Postgres connections | > 80% pool |

---

## 16. What Will NOT Work Without Changes

| Feature | Why it breaks in split | Fix required |
|---------|----------------------|--------------|
| Auto CE restart after add bed | Docker socket is local | Remote restart webhook OR enable `/update` API |
| `POST /api/center/reload` | Tries local Docker restart | Replace with remote reload |
| Single-site shovel script | Shovel is same-broker | Cross-site shovel on hospital RabbitMQ |
| `CONNECT_ENGINE_URL` Docker DNS name | CE not on cloud Docker network | VPN IP or hospital DNS |
| Alarm Engine Mongo localhost | Mongo is at hospital | Update `SPRING_DATA_MONGODB_URI` |
| Demo device simulator | Runs on cloud Docker network | Run simulator at hospital OR disable |
| `host.docker.internal` references | Host networking assumptions | Replace with VPN IPs in all configs |

---

## Appendix — Environment Variable Quick Reference (Split Mode)

### Hospital `.env`

```bash
# Connect Engine — local
SPRING_DATA_MONGODB_URI=mongodb://user:pass@mongodb:27017/v2-ICU-Connect?authSource=admin
SPRING_RABBITMQ_HOST=rabbitmq
SPRING_RABBITMQ_PORT=5672

# Cross-site shovel destination (RTWO cloud RabbitMQ)
RTWO_RABBITMQ_HOST=<RTWO_VPN_IP>
RTWO_RABBITMQ_PORT=5671
RTWO_RABBITMQ_USER=ICUcharting
RTWO_RABBITMQ_PASS=<strong-password>
```

### RTWO Cloud `.env`

```bash
CONNECT_ENGINE_URL=https://<HOSPITAL_VPN_IP>:9010
CONNECT_ENGINE_AUTO_RESTART=false
SPRING_DATA_MONGODB_URI=mongodb://user:pass@<HOSPITAL_VPN_IP>:27017/?authSource=admin
SPRING_RABBITMQ_HOST=CIS-rabbitmq
HUB_AUTH_ENFORCED=true
HUB_AUTH_JWT_SECRET=<256-bit-secret>
HUB_UI_PORT=8000
SMTP_ENABLED=true
```

---

## Appendix — Migration from Current QA Setup to Split

Current QA server (`192.168.0.125`) runs **both stacks on one machine**. To migrate:

1. **Identify hospital server** — install CE + RabbitMQ + Mongo there
2. **Export Mongo `centerEntity` + `deviceConfigEntity`** from QA — import to hospital Mongo
3. **Export Postgres `icu_hub`** from QA — import to RTWO cloud Postgres
4. **Update bed device IPs** in Hub admin to real hospital LAN IPs (replace `172.25.0.8` simulator IP)
5. **Setup VPN** between hospital and RTWO cloud
6. **Configure cross-site shovel** (Section 8)
7. **Update RTWO `.env`** with hospital VPN IPs (Section 6)
8. **Disable `CONNECT_ENGINE_AUTO_RESTART`** and remove docker.sock
9. **Run verification checklist** (Section 14)
10. **Decommission** CE + simulator from QA server (keep Hub stack only on RTWO cloud)

---

*End of Live Split Deployment Guide*
