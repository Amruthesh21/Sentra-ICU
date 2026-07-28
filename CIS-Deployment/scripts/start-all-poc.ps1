# Start FULL live POC: infra + CIS stack + alarm POC
# Run PowerShell AS ADMINISTRATOR from project root
$ErrorActionPreference = "Continue"

$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$pocRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$cisRoot = "C:\Users\Monish Reddy\Downloads\Monish\192.168.0125\CIS-Deployment"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ICU Watch Alarm - FULL POC STARTUP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Check Docker ---
& $docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Open Docker Desktop first." -ForegroundColor Red
    exit 1
}

# --- Step 1: Ensure docker network exists ---
Write-Host "[1/6] Ensuring docker network..." -ForegroundColor Yellow
$networkSubnet = if ($env:POC_NETWORK_SUBNET -and $env:POC_NETWORK_SUBNET.Trim().Length -gt 0) { $env:POC_NETWORK_SUBNET } else { "172.31.0.0/16" }
& $docker network inspect alarampoc_docker_compose_network 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Creating network alarampoc_docker_compose_network ($networkSubnet)" -ForegroundColor Gray
    & $docker network create --subnet=$networkSubnet alarampoc_docker_compose_network
}

# --- Step 2: Free port 7000 if wrong service (postgres) is blocking MongoDB ---
Write-Host "[2/6] Checking port 7000 for MongoDB..." -ForegroundColor Yellow
$port7000 = netstat -ano | Select-String ":7000.*LISTENING" | Select-Object -First 1
if ($port7000) {
    $pid7000 = ($port7000 -split '\s+')[-1]
    $proc = Get-Process -Id $pid7000 -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -ne "com.docker.backend" -and $proc.ProcessName -notlike "*mongo*") {
        Write-Host "  Port 7000 used by $($proc.ProcessName) (PID $pid7000) - stopping to free for MongoDB..." -ForegroundColor Yellow
        Stop-Process -Id $pid7000 -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

# --- Step 3: Start MongoDB + RabbitMQ ---
Write-Host "[3/6] Starting MongoDB (7000) + RabbitMQ (7003/7004)..." -ForegroundColor Yellow
Set-Location $pocRoot
& $docker compose -p alarampoc -f docker-compose.infra.yml up -d
Start-Sleep -Seconds 15

# Wait for health
$retries = 0
while ($retries -lt 12) {
    $mongoOk = (Test-NetConnection localhost -Port 7000 -WarningAction SilentlyContinue).TcpTestSucceeded
    $rabbitOk = (Test-NetConnection localhost -Port 7003 -WarningAction SilentlyContinue).TcpTestSucceeded
    if ($mongoOk -and $rabbitOk) { break }
    Write-Host "  Waiting for infra... ($retries/12)" -ForegroundColor Gray
    Start-Sleep -Seconds 5
    $retries++
}

# --- Step 4: Start CIS stack (backend, connect engine, device sim) ---
Write-Host "[4/6] Starting CIS stack from $cisRoot ..." -ForegroundColor Yellow
Set-Location $cisRoot
& $docker compose -p alarampoc -f docker-compose.yml up -d critixperticubackendengine connectengine visualizationengine icuconnectdevicesimulatorbed1 nginx
Start-Sleep -Seconds 20

# --- Step 5: Start Alarm POC services ---
Write-Host "[5/6] Starting Alarm POC services..." -ForegroundColor Yellow
Set-Location $pocRoot
& $docker compose -p alarampoc -f docker-compose.poc.yml up -d --build alarm-engine notification-service icu-watch-pwa icu-connect-hub ngrok
Start-Sleep -Seconds 15

# --- Step 6: RabbitMQ shovel setup ---
Write-Host "[6/6] Setting up RabbitMQ shovel..." -ForegroundColor Yellow
& "$pocRoot\CIS-Deployment\scripts\setup-rabbitmq-shovel.ps1"

# --- Status report ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " STATUS CHECK" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$checks = @(
    @{ Name = "MongoDB";       Port = 7000 },
    @{ Name = "RabbitMQ";      Port = 7003 },
    @{ Name = "RabbitMQ UI";   Port = 7004 },
    @{ Name = "CIS Backend";   Port = 7014 },
    @{ Name = "Connect Engine"; Port = 7012 },
    @{ Name = "Visualization"; Port = 7013 },
    @{ Name = "Alarm Engine";  Port = 7020 },
    @{ Name = "Notification";  Port = 7030 },
    @{ Name = "PWA";           Port = 7031 },
    @{ Name = "ICU Hub";       Port = 7040 },
    @{ Name = "ngrok UI";      Port = 4040 }
)

foreach ($c in $checks) {
    $ok = (Test-NetConnection localhost -Port $c.Port -WarningAction SilentlyContinue).TcpTestSucceeded
    $color = if ($ok) { "Green" } else { "Red" }
    $status = if ($ok) { "UP" } else { "DOWN" }
    Write-Host ("  {0,-18} :{1,5}  (port {2})" -f $c.Name, $status, $c.Port) -ForegroundColor $color
}

Write-Host ""
Write-Host "LIVE DEMO URLS:" -ForegroundColor Cyan
Write-Host "  ICU Connect Hub: http://localhost:7040  (NEW - beds, patients, vitals)"
Write-Host "  PWA:            http://localhost:7031"
Write-Host "  ngrok HTTPS:    http://localhost:4040  (copy https URL for iPhone)"
Write-Host "  Alarm dashboard: http://localhost:7020/alarm-ui"
Write-Host "  CIS Frontend:   http://localhost:7011"
Write-Host "  Visualization:  http://localhost:7013"
Write-Host "  RabbitMQ UI:    http://localhost:7004  (ICUcharting / admin@123)"
Write-Host ""
Write-Host "iPhone: open ngrok HTTPS URL -> Add to Home Screen -> Enable Notifications -> Test alarm"
Write-Host ""

Set-Location $pocRoot
