# One-command start: network + infra (Mongo/RabbitMQ/Postgres) + POC services
# (alarm-engine, notification-service, device-ingestion, icu-connect-hub, PWA).
# Requires Docker Desktop running. Safe to re-run - skips what already exists.
$ErrorActionPreference = "Stop"

$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
if (-not (Test-Path $docker)) { $docker = "docker" }  # fall back to PATH
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

# Every compose file in this repo sets fixed container_names and joins a
# fixed external network, but does not set a project name - always pass -p
# so a re-run always lands on the same project. Using a different project
# name would try to build a second, separate image set while still fighting
# over the same fixed container names, which fails with a name conflict.
$project = "alarampoc"

Write-Host "Checking Docker daemon..." -ForegroundColor Cyan
# No stderr redirect here on purpose: redirecting a native command's stderr
# through PowerShell can turn it into a terminating NativeCommandError under
# $ErrorActionPreference = "Stop", which would abort the script before the
# $LASTEXITCODE check below ever runs. Letting docker.exe print its own
# output directly is harmless and avoids that.
& $docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Docker daemon is NOT running." -ForegroundColor Red
    Write-Host ""
    Write-Host "Fix steps:" -ForegroundColor Yellow
    Write-Host "  1. Open Docker Desktop from Start menu"
    Write-Host "  2. Wait until tray icon shows Docker Desktop is running"
    Write-Host "  3. If it fails: Settings -> General -> Use WSL 2 based engine"
    Write-Host "  4. Restart Docker Desktop, or restart your PC"
    Write-Host "  5. Re-run: .\CIS-Deployment\scripts\start-docker.ps1"
    Write-Host ""
    Write-Host "Alternative (no Docker): .\CIS-Deployment\scripts\start-local.ps1"
    Write-Host "  (runs notification + PWA only; alarm-engine still needs Docker or Java 17)"
    exit 1
}

Set-Location $root

if (-not (Test-Path ".env")) {
    Write-Host "No .env found - copying .env.example. Edit .env with real secrets before any real deployment." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

$networkName = "alarampoc_docker_compose_network"
& $docker network inspect $networkName *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating docker network $networkName ..." -ForegroundColor Cyan
    & $docker network create --subnet=172.31.0.0/16 --gateway=172.31.0.1 $networkName
}

Write-Host "Starting infra (MongoDB, RabbitMQ, Postgres)..." -ForegroundColor Green
& $docker compose -p $project -f docker-compose.infra.yml up -d
if ($LASTEXITCODE -ne 0) { Write-Host "Infra failed to start. See output above." -ForegroundColor Red; exit 1 }

Write-Host "Building and starting POC services..." -ForegroundColor Green
& $docker compose -p $project -f docker-compose.poc.yml up --build -d
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Services started. Wait 30s then verify:" -ForegroundColor Green
    Write-Host "  .\CIS-Deployment\scripts\verify-shovel.ps1"
    Write-Host "  http://localhost:7040 (Sentra ICU Hub)"
    Write-Host "  http://localhost:7031 (PWA)"
    Write-Host "  http://localhost:4040 (ngrok HTTPS URL, if configured)"
} else {
    Write-Host "docker compose failed. See output above." -ForegroundColor Red
    exit 1
}
