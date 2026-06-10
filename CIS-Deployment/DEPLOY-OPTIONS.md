# Deployment Options — ICU Watch Alarm POC

Docker Desktop is installed on your machine but the **daemon is not running**. You have three paths:

---

## Option 1: Fix Docker (recommended for full demo)

**Best when:** You want all 5 services (alarm-engine, notification, PWA, shovel, ngrok) in one command.

### Fix Docker Desktop

1. Open **Docker Desktop** from the Start menu
2. Wait 1–2 minutes until the tray icon shows **"Docker Desktop is running"**
3. If it stays stuck:
   - Docker Desktop → **Settings** → **General** → enable **Use the WSL 2 based engine**
   - **Settings** → **Resources** → ensure enough memory (4 GB+)
   - Restart Docker Desktop, or restart your PC
4. Verify in PowerShell:
   ```powershell
   & "C:\Program Files\Docker\Docker\resources\bin\docker.exe" info
   ```
   Should show `Server:` section without errors.

### Start POC

```powershell
cd "c:\Users\Monish Reddy\Downloads\alaram poc"
.\CIS-Deployment\scripts\start-docker.ps1
```

Uses `docker-compose.poc.yml` (no `connectengine` dependency — works standalone).

After 30 seconds:
```powershell
.\CIS-Deployment\scripts\verify-shovel.ps1
```

| Service | URL |
|---------|-----|
| PWA | http://localhost:7031 |
| Alarm dashboard | http://localhost:7020/alarm-ui |
| ngrok HTTPS URL | http://localhost:4040 |
| Push API | http://localhost:7030/api/subscriptions |

---

## Option 2: Local without Docker (partial demo)

**Best when:** Docker won't start but you still need to demo **watch notifications**.

Runs: notification-service + PWA + ngrok + RabbitMQ shovel  
Does **not** run: alarm-engine (needs Java 17 or Docker)

### Requirements

- Node.js 18+ (you have v22 ✓)
- Existing stack running: RabbitMQ (7003/7004), MongoDB (7000)
- `.env` with `NGROK_AUTHTOKEN` (already set ✓)

### Start

```powershell
cd "c:\Users\Monish Reddy\Downloads\alaram poc"
.\CIS-Deployment\scripts\start-local.ps1
```

Opens 3 PowerShell windows (notification, PWA, ngrok).

### Demo without alarm-engine

1. Open ngrok HTTPS URL on iPhone → Add to Home Screen
2. Login as Dr. Demo / doctor-001
3. Enable Notifications
4. Send test push:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:7030/api/test-push" -Method POST -ContentType "application/json" -Body '{"doctorId":"doctor-001"}'
   ```
   Or use the **Send test alarm to watch** button in the app.

This proves the **watch notification path** even without live vitals alarms.

---

## Option 3: Install Java 17 for alarm-engine locally

**Best when:** Docker broken but you need the full alarm pipeline.

```powershell
winget install EclipseAdoptium.Temurin.17.JDK
winget install Apache.Maven
```

Then in separate terminals:

```powershell
# Terminal 1 — alarm-engine
cd CIS-Deployment\alarmEngine
$env:SPRING_RABBITMQ_HOST="localhost"
$env:SPRING_RABBITMQ_PORT="7003"
$env:SPRING_DATA_MONGODB_URI="mongodb://monish:admin%40123@localhost:7000/?authSource=admin"
mvn spring-boot:run

# Terminal 2+ — use start-local.ps1 for notification + PWA + ngrok
.\CIS-Deployment\scripts\start-local.ps1
```

---

## Quick comparison

| Feature | Docker (Option 1) | Local (Option 2) | Java + Local (Option 3) |
|---------|-------------------|------------------|-------------------------|
| alarm-engine | ✓ | ✗ | ✓ |
| watch push demo | ✓ | ✓ (test button) | ✓ |
| live vitals alarms | ✓ | ✗ | ✓ |
| ngrok HTTPS | ✓ | ✓ | ✓ |
| Setup effort | Fix Docker once | Immediate | Install JDK |

---

## Recommended for your demo tomorrow

1. **Try Option 1 first** — restart PC, open Docker Desktop, run `start-docker.ps1`
2. **If Docker still fails** — use **Option 2** to demo watch buzz with test push (manager sees the concept)
3. **If you have 30 min** — install Java 17 (**Option 3**) for full end-to-end

See also: [DEMO-STEPS.md](DEMO-STEPS.md)
