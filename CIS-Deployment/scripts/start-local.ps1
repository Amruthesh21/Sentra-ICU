# Run POC services WITHOUT Docker (Node.js only)
# Prerequisites: Node.js 18+, existing stack (RabbitMQ/MongoDB/CIS) already running
# Note: alarm-engine requires Java 17 OR Docker - use start-docker.ps1 for full stack

$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

Write-Host "=== ICU Watch POC - Local (no Docker) ===" -ForegroundColor Cyan
Write-Host ""

# Load .env for ngrok token
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

# 1. RabbitMQ shovel (one-time, uses existing RabbitMQ on port 7004)
Write-Host "[1/4] Setting up RabbitMQ shovel..." -ForegroundColor Yellow
& "$PSScriptRoot\setup-rabbitmq-shovel.ps1"

# 2. Notification service
Write-Host "[2/4] Starting notification-service on port 7030..." -ForegroundColor Yellow
$notifDir = Join-Path $root "CIS-Deployment\notificationService"
Set-Location $notifDir
if (-not (Test-Path "node_modules")) { npm install }
$env:RABBITMQ_URL = "amqp://ICUcharting:admin%40123@localhost:7003/ICUcharting"
$env:MONGODB_URI = "mongodb://monish:admin%40123@localhost:7000/?authSource=admin"
$env:VAPID_PUBLIC_KEY = "BLKYwR9R10uXjN-4niWs483ccOlJFLSC0SahNIN7NZy_BTRuQ07UiT_ENTUV-mtjHGSWhutwD6bMu2jRBC-VFA4"
$env:VAPID_PRIVATE_KEY = "567k1VQcCBf9V-xSND_osaQdf0MKKQy6mfSIChFMLEg"
$env:VAPID_EMAIL = "mailto:poc@rtwo.com"
$env:PORT = "9030"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$notifDir'; `$env:RABBITMQ_URL='amqp://ICUcharting:admin%40123@localhost:7003/ICUcharting'; `$env:MONGODB_URI='mongodb://monish:admin%40123@localhost:7000/?authSource=admin'; `$env:VAPID_PUBLIC_KEY='BLKYwR9R10uXjN-4niWs483ccOlJFLSC0SahNIN7NZy_BTRuQ07UiT_ENTUV-mtjHGSWhutwD6bMu2jRBC-VFA4'; `$env:VAPID_PRIVATE_KEY='567k1VQcCBf9V-xSND_osaQdf0MKKQy6mfSIChFMLEg'; `$env:VAPID_EMAIL='mailto:poc@rtwo.com'; npm start"

Start-Sleep -Seconds 3

# 3. PWA dev server on port 7031
Write-Host "[3/4] Starting PWA on port 7031..." -ForegroundColor Yellow
$pwaDir = Join-Path $root "CIS-Deployment\icuWatchPwa"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwaDir'; npm run dev -- --port 7031 --host"

Start-Sleep -Seconds 3

# 4. ngrok for HTTPS (required for iPhone/Apple Watch)
Write-Host "[4/4] Starting ngrok tunnel to port 7031..." -ForegroundColor Yellow
if ($env:NGROK_AUTHTOKEN) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx --yes ngrok http 7031 --authtoken=$env:NGROK_AUTHTOKEN"
} else {
    Write-Host "  WARNING: NGROK_AUTHTOKEN not set in .env - skip ngrok or set token" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Local services launching in separate windows ===" -ForegroundColor Green
Write-Host ""
Write-Host "  PWA:        http://localhost:7031"
Write-Host "  Notify API: http://localhost:7030/api/subscriptions"
Write-Host "  ngrok UI:   http://localhost:4040  (copy HTTPS URL for iPhone)"
Write-Host ""
Write-Host "  ALARM ENGINE not started (needs Docker or Java 17)." -ForegroundColor Yellow
Write-Host "  Options:"
Write-Host "    A) Fix Docker -> .\CIS-Deployment\scripts\start-docker.ps1"
Write-Host "    B) Install Java 17 + Maven, then:"
Write-Host "       cd CIS-Deployment\alarmEngine && mvn spring-boot:run"
Write-Host ""
Write-Host "  For demo WITHOUT alarm-engine, test push directly:"
Write-Host "    POST http://localhost:7030/api/test-push  body: {`"doctorId`":`"doctor-001`"}"

Set-Location $root
