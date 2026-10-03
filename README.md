# Sentra ICU

Multi-hospital ICU Hub: live vitals and waveforms from bedside monitors, Super Admin / Hospital Admin / clinical consoles, and an on-site gateway that maps devices by IP — never by what the monitor claims.

Doctors and nurses see only the ward their hospital configured. Hospital Admin builds that ward (units, beds, logins, device map). Super Admin onboards hospitals and points each tenant at its gateway.

```
Bedside monitor  --HL7 :7061 / JSON :7062-->  hospital device-ingestion
                                                      |
                                         vitals over RabbitMQ (VPN)
                                                      v
Browser  --HTTPS-->  Hub  -->  alarm-engine  -->  Postgres / Mongo / RabbitMQ
                         \-->  proxy /device-ingestion  -->  hospital :9050
                              (bed-map, quarantine, live waveforms)
```

## Three consoles, one URL

| Area | Who | What they do |
|------|-----|----------------|
| **Super Admin** | Platform operator | Create hospitals, issue hospital-admin accounts, set each site’s device gateway URL, platform analytics and audit |
| **Hospital Admin** | One hospital | Units, beds, Connect a device (IP → bed → model), staff logins vs admission roster, hospital alarms and audit |
| **Doctors & nurses** | Clinical staff | Overview, admit / readmit / discharge, bed chart (vitals, waveforms, trends, notes, orders, fluids, scores), alerts, reports |

Credentials only work in the area they belong to. A monitor is never trusted to name its own bed; unmapped traffic is quarantined.

## Stack

| Piece | Role |
|-------|------|
| **icuConnectHub** | React (Vite) SPA — the Hub |
| **alarmEngine** | Spring Boot API — auth (JWT + MFA), tenants, admissions, vitals, alarms, gateway proxy |
| **deviceIngestion** | Node.js hospital gateway — 15 HL7/JSON adapters, bed-map, in-memory waveforms |
| **Postgres** | Hub records (hospitals, users, visits, clinical docs) |
| **MongoDB** | Operational bed / vitals / threshold state |
| **RabbitMQ** | Device vitals into alarm-engine |
| **Docker Compose** | Laptop all-in-one, or cloud Hub + one gateway per hospital |

## Run it (laptop)

From a cold start the accurate steps are in
[CIS-Deployment/deviceIngestion/docs/RUNBOOK.md](CIS-Deployment/deviceIngestion/docs/RUNBOOK.md).

Short version: copy `.env.example` → `.env` (set `SUPER_ADMIN_PASSWORD` and a real `HUB_AUTH_JWT_SECRET`), then:

```bash
docker compose -f docker-compose.infra.yml up -d
docker compose -p alarampoc -f docker-compose.poc.yml up -d --build alarm-engine device-ingestion notification-service icu-connect-hub
```

Hub: [http://localhost:7040](http://localhost:7040) · API: `http://localhost:7020` · HL7: `7061` · JSON: `7062`

No real monitor? Use [`simulation/`](simulation/README.md) to admit a test patient and replay captured device traffic.

## Production split

Bedside devices stay on the hospital LAN. The cloud runs Hub + alarm-engine + data stores. Each hospital runs **device-ingestion only**, reached over VPN. See [CIS-Deployment/docs/HOSPITAL-GATEWAY.md](CIS-Deployment/docs/HOSPITAL-GATEWAY.md).

## Docs

| Doc | For |
|-----|-----|
| [Operator & training manual](CIS-Deployment/docs/SENTRA-ICU-OPERATOR-MANUAL.md) | Super Admin, Hospital Admin, and clinical how-to |
| [RUNBOOK](CIS-Deployment/deviceIngestion/docs/RUNBOOK.md) | Local bring-up |
| [HOSPITAL-GATEWAY](CIS-Deployment/docs/HOSPITAL-GATEWAY.md) | Cloud vs hospital install |
| [ARCHITECTURE-HANDOVER](CIS-Deployment/docs/ARCHITECTURE-HANDOVER.md) | APIs and internals (cross-check source for anything load-bearing) |
| [`.env.example`](.env.example) | Environment variables |

## Layout

```
CIS-Deployment/alarmEngine/       Spring Boot
CIS-Deployment/icuConnectHub/     React Hub
CIS-Deployment/deviceIngestion/   Hospital gateway
CIS-Deployment/docs/              Manual + architecture
docker-compose*.yml               Infra, POC, cloud, hospital
simulation/                       Pipeline exercise without hardware
```

## Notes

- Do not commit `.env` or `.env.hospital`. Use the `*.example` files.
- `icuWatchPwa` in this repo expects an external CIS stack and will not run standalone.
- Never expose RabbitMQ or the gateway HTTP port to the public internet.
