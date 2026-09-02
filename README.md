# Sentra ICU

A clinical ICU monitoring platform: real-time bedside vitals and alarms, patient
admission/discharge, staff and unit management, clinical documentation, and
reporting — built around a Java/Spring alarm-and-vitals backend and a React
clinical Hub.

**New here?** Start with
[CIS-Deployment/deviceIngestion/docs/RUNBOOK.md](CIS-Deployment/deviceIngestion/docs/RUNBOOK.md) —
the accurate, tested, from-cold-start instructions for running this repo
today. Everything below is an orientation map, not a run guide.

## Services (`CIS-Deployment/`)

| Service | What it is | Container | Host port |
|---|---|---|---|
| `alarmEngine` | Java/Spring backend — vitals, alarm thresholds, admissions, staff, auth, reporting (Postgres + Mongo) | CIS-alarm-engine | 7020 |
| `icuConnectHub` | React clinical Hub — the app doctors/admins actually use | CIS-icu-connect-hub | 7040 (or `HUB_UI_PORT`) |
| `deviceIngestion` | Listens for HL7v2/MLLP from bedside monitors, parses per-device-model, publishes vitals straight into alarmEngine's queue. Replaces Connect Engine for this one path — see its own [MIGRATION-NOTE.md](CIS-Deployment/deviceIngestion/docs/MIGRATION-NOTE.md) | CIS-device-ingestion | 7061 (HL7 only; admin API is internal-only, proxied via the Hub) |
| `notificationService` | Web Push delivery for the doctor PWA | CIS-notification-service | internal only, proxied via the PWA |
| `icuWatchPwa` | Doctor mobile PWA (watch/phone alarm notifications) | CIS-icu-watch-pwa | 7031 — **will not start standalone in this repo**; its nginx proxies to an external CIS backend/Connect Engine stack that isn't part of this repository |

Infra (MongoDB, RabbitMQ, Postgres) is defined in `docker-compose.infra.yml`
at the repo root, not under `CIS-Deployment/`.

## Not part of the running app

- `simulation/` (repo root) — a standalone tool for exercising the whole
  pipeline (login → admit a patient → replay real captured device data) with
  nothing hardcoded into app source or the database. See
  [simulation/README.md](simulation/README.md). Run it any time you want to
  see the app working without real hardware.
- `CIS-Deployment/scripts/` — operational scripts (start/stop, resets, RabbitMQ
  setup, seeding). Most are still current; a few carry old "RTWO" branding in
  comments only (cosmetic, not functional).

## Docs

- [CIS-Deployment/deviceIngestion/docs/RUNBOOK.md](CIS-Deployment/deviceIngestion/docs/RUNBOOK.md) — how to actually run this, today
- [CIS-Deployment/deviceIngestion/docs/MIGRATION-NOTE.md](CIS-Deployment/deviceIngestion/docs/MIGRATION-NOTE.md) — what deviceIngestion replaces and why
- [CIS-Deployment/docs/ARCHITECTURE-HANDOVER.md](CIS-Deployment/docs/ARCHITECTURE-HANDOVER.md) — deep architecture/API reference (large; some sections describe earlier iterations — cross-check against source for anything load-bearing)
- [CIS-Deployment/docs/LIVE-SPLIT-DEPLOYMENT.md](CIS-Deployment/docs/LIVE-SPLIT-DEPLOYMENT.md) — production split-server deployment guide, written for the Connect-Engine-era topology; the hospital-side/cloud-side split concept still applies, but check current service names against the table above before following it literally
- [.env.example](.env.example) — every environment variable this stack reads, with explanations

## Known limitations

- The doctor PWA (`icuWatchPwa`) needs an external CIS backend/Connect Engine
  deployment this repo doesn't include — it's not expected to run standalone here.
- Some docs under `CIS-Deployment/docs/` predate the deviceIngestion service
  and the RTWO→Sentra ICU rename; treat the RUNBOOK and this README as current,
  and the rest as background reading.
