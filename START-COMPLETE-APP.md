# Sentra ICU — Complete App Start (One Sheet)

Windows + Docker Desktop. Run PowerShell from the **project root**  
(`alaram poc` / this repo).

---

## Prerequisites

1. **Docker Desktop** running (whale icon healthy)
2. **External CIS stack path** (Connect Engine / device sim) — default in script:  
   `C:\Users\Monish Reddy\Downloads\Monish\192.168.0125\CIS-Deployment`  
   Edit `$cisRoot` in `CIS-Deployment\scripts\start-all-poc.ps1` if your path differs.
3. Copy env once:  
   `copy .env.example .env`  
   (fill `NGROK_AUTHTOKEN` only if you need phone HTTPS tunnel)

---

## One-command start (recommended)

```powershell
# From project root — preferably Run as Administrator
.\CIS-Deployment\scripts\start-all-poc.ps1
```

If Hub port **8000** is busy (e.g. another container), start Hub on **7040**:

```powershell
$env:HUB_UI_PORT = "7040"
docker compose -p alarampoc -f docker-compose.poc.yml up -d icu-connect-hub
```

---

## Manual start (step by step)

```powershell
# 0) Network (subnet must match .env — default 172.31.0.0/16)
docker network create --subnet=172.31.0.0/16 --gateway=172.31.0.1 alarampoc_docker_compose_network

# 1) Infra: MongoDB :7000, RabbitMQ :7003 / UI :7004, Postgres :7001
docker compose -p alarampoc -f docker-compose.infra.yml up -d

# 2) CIS stack (Connect Engine, Visualization, Backend, Device Sim, Nginx)
#    Use IP override so CIS matches 172.31 network
cd "C:\Users\Monish Reddy\Downloads\Monish\192.168.0125\CIS-Deployment"
docker compose -p alarampoc -f docker-compose.yml `
  -f "C:\Users\Monish Reddy\Downloads\alaram poc\CIS-Deployment\docker-compose.cis-ip-override.yml" `
  up -d critixperticubackendengine connectengine visualizationengine icuconnectdevicesimulatorbed1 nginx
cd "C:\Users\Monish Reddy\Downloads\alaram poc"

# 3) Hub + Alarm + Notification + PWA
$env:HUB_UI_PORT = "7040"
docker compose -p alarampoc -f docker-compose.poc.yml up -d --build `
  alarm-engine notification-service icu-watch-pwa icu-connect-hub

# 4) RabbitMQ shovel (vitals → alarm engine)
.\CIS-Deployment\scripts\setup-rabbitmq-shovel.ps1
```

---

## URLs to test

| App | URL |
|-----|-----|
| **Sentra ICU Hub** | http://localhost:7040 |
| Alarm Engine | http://localhost:7020 |
| Doctor PWA | http://localhost:7031 |
| Connect Engine | http://localhost:7012 |
| Visualization | http://localhost:7013 |
| CIS Frontend | http://localhost:7011 |
| RabbitMQ UI | http://localhost:7004 (`ICUcharting` / `admin@123`) |

Demo login (if seeded): `admin@icu.med` / `admin123` · MFA `123456`

---

## Status check

```powershell
docker ps --filter "name=CIS-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

@(7000,7001,7003,7011,7012,7013,7014,7020,7030,7031,7040) | ForEach-Object {
  $ok = (Test-NetConnection localhost -Port $_ -WarningAction SilentlyContinue).TcpTestSucceeded
  "{0}: {1}" -f $_, ($(if ($ok) { "UP" } else { "DOWN" }))
}
```

---

## Stop

```powershell
docker compose -p alarampoc -f docker-compose.poc.yml stop
docker compose -p alarampoc -f docker-compose.infra.yml stop
# Optional — stop CIS stack from its folder:
# docker compose -p alarampoc -f docker-compose.yml stop
```

---

## Common fixes

| Problem | Fix |
|---------|-----|
| `no configured subnet contains IP 172.31.x` | Recreate network as `172.31.0.0/16` (see step 0). CIS needs `docker-compose.cis-ip-override.yml`. |
| Hub bind **8000** failed | Port taken (e.g. chromadb). Use `$env:HUB_UI_PORT="7040"`. |
| PWA nginx: host not found `cisBackend` | Start CIS backend first, then `docker start CIS-icu-watch-pwa`. |
| No live vitals | Wait ~1 min for device sim; check Connect Engine :7012 and shovel script. |
| Brand shows old name | Hard-refresh Hub; restart `CIS-alarm-engine` after pull. |

---

## Rebuild after code changes

```powershell
$env:HUB_UI_PORT = "7040"
docker compose -p alarampoc -f docker-compose.poc.yml up -d --build alarm-engine icu-connect-hub
```
