# Fix WSL timeout / Docker Desktop WSL issues
# Run PowerShell AS ADMINISTRATOR

Write-Host "=== WSL / Docker Desktop Fix ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill stuck WSL processes
Write-Host "[1] Stopping WSL and Docker processes..." -ForegroundColor Yellow
Get-Process -Name "wsl", "wslservice", "Docker Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# Step 2: Shutdown WSL completely
Write-Host "[2] Shutting down WSL..." -ForegroundColor Yellow
wsl --shutdown 2>$null
Start-Sleep -Seconds 5

# Step 3: Restart WSL service (Windows 11 uses WSLService, older builds use LxssManager)
Write-Host "[3] Restarting WSL service..." -ForegroundColor Yellow
foreach ($svc in @("WSLService", "LxssManager")) {
    $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($s) {
        Restart-Service $svc -Force
        Write-Host "  Restarted $svc" -ForegroundColor Green
        break
    }
}
Start-Sleep -Seconds 5

# Step 4: Check distro state
Write-Host "[4] WSL distros:" -ForegroundColor Yellow
wsl --list --verbose

$distros = wsl --list --verbose 2>&1 | Out-String
if ($distros -match "docker-desktop.*Uninstalling") {
    Write-Host ""
    Write-Host "PROBLEM: docker-desktop is stuck 'Uninstalling'." -ForegroundColor Red
    Write-Host "Docker cannot start until this is fixed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Fix (run these commands):" -ForegroundColor Yellow
    Write-Host "  wsl --unregister docker-desktop"
    Write-Host "  Then open Docker Desktop — it will recreate the distro."
    Write-Host ""
    Write-Host "If unregister fails, repair Docker Desktop:" -ForegroundColor Yellow
    Write-Host "  Settings -> Apps -> Docker Desktop -> Modify -> Repair"
    Write-Host "  Or reinstall from https://www.docker.com/products/docker-desktop/"
}

if ($distros -match "Ubuntu") {
    Write-Host ""
    Write-Host "TIP: In Docker Desktop -> Settings -> WSL Integration" -ForegroundColor Cyan
    Write-Host "     Disable Ubuntu integration (not needed for ICU POC)."
}

Write-Host ""
Write-Host "Demo without Docker:" -ForegroundColor Green
Write-Host "  cd 'c:\Users\Monish Reddy\Downloads\alaram poc'"
Write-Host "  .\CIS-Deployment\scripts\start-local.ps1"
