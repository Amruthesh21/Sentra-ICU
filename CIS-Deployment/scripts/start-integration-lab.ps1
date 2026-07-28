# Start PULSE cloud Integration Engine + Hospital simulator (two networks on one PC)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Installing integration engine..." -ForegroundColor Cyan
Set-Location "$root\integrationEngine"
if (-not (Test-Path node_modules)) { npm install }

Write-Host "Installing hospital simulator..." -ForegroundColor Cyan
Set-Location "$root\hospitalSimulator"
if (-not (Test-Path node_modules)) { npm install }

Write-Host "Starting Integration Engine :9070 (CLOUD)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$root\integrationEngine`"; npm start"

Start-Sleep -Seconds 2

Write-Host "Starting Hospital Simulator :9080 (HOSPITAL)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$root\hospitalSimulator`"; npm start"

Write-Host ""
Write-Host "Cloud engine:     http://127.0.0.1:9070/health"
Write-Host "Hospital sim UI:  http://127.0.0.1:9080/"
Write-Host "Hub Connectivity: http://127.0.0.1:5174/connectivity"
Write-Host ""
Write-Host "Keep Hub Vite running separately (npm run dev in icuConnectHub)."
