# Start POC services via Docker (requires Docker Desktop running)
$ErrorActionPreference = "Stop"

$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

if (-not (Test-Path $docker)) {
    Write-Host "Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
    exit 1
}

Write-Host "Checking Docker daemon..." -ForegroundColor Cyan
& $docker info 2>&1 | Out-Null
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

Write-Host "Building and starting POC services..." -ForegroundColor Green
& $docker compose -f docker-compose.poc.yml up --build -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Services started. Wait 30s then verify:" -ForegroundColor Green
    Write-Host "  .\CIS-Deployment\scripts\verify-shovel.ps1"
    Write-Host "  http://localhost:7031          (PWA)"
    Write-Host "  http://localhost:7020/alarm-ui (alarm dashboard)"
    Write-Host "  http://localhost:4040          (ngrok HTTPS URL)"
} else {
    Write-Host "docker compose failed. See output above." -ForegroundColor Red
    exit 1
}
