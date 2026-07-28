# Import CIS MongoDB seed: deviceConfigEntity + centerEntity bed
# Run from project root when MongoDB is up (port 7000)

param(
    [string]$DeviceConfigPath = "",
    [string]$BedIp = "172.25.0.8",
    [string]$BedLabel = "BED-01"
)

$ErrorActionPreference = "Stop"

$candidates = @(
    $DeviceConfigPath,
    "$env:USERPROFILE\Documents\ICU-Connect.deviceConfigEntity.json",
    "C:\Users\Monish Reddy\Downloads\Monish\192.168.0125\DockerDeploymentAmbulance\ambulanceconnect\import\deviceConfigEntity.json",
    "C:\Users\Monish Reddy\Downloads\Monish\192.168.0125\CIS-Deployment\CIS-Deployment\ICU Charting Dump\deviceConfigEntity.json"
) | Where-Object { $_ -and (Test-Path $_) }

$sourceFile = $null
foreach ($path in $candidates) {
    try {
        node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log('ok')" $path 2>$null
        if ($LASTEXITCODE -eq 0) {
            $sourceFile = $path
            break
        }
    } catch { }
}

if (-not $sourceFile) {
    Write-Host "ERROR: No valid deviceConfigEntity.json found." -ForegroundColor Red
    Write-Host "Place ICU-Connect.deviceConfigEntity.json in Documents, or fix JSON syntax (remove stray commas)."
    exit 1
}

Write-Host "Using deviceConfigEntity: $sourceFile" -ForegroundColor Cyan

$encIp = node -e "const ip=process.argv[1]; console.log(Buffer.from(ip,'utf8').toString('base64').split('').reverse().join(''))" $BedIp
$bedIdentity = [guid]::NewGuid().ToString()
Write-Host "Bed $BedLabel -> encrypted IP + bedIdentity $bedIdentity"

docker cp "$sourceFile" CIS-mongodb:/tmp/deviceConfigEntity.json
docker exec CIS-mongodb mongoimport `
    --uri "mongodb://monish:admin%40123@localhost:27017/v2-ICU-Connect?authSource=admin" `
    --collection deviceConfigEntity `
    --file /tmp/deviceConfigEntity.json `
    --jsonArray `
    --drop

$mongoScript = @"
db.centerEntity.updateOne(
  { _id: 'RTWO' },
  {
    `$set: {
      centerName: 'Sentra ICU',
      centerLocation: 'JPN',
      beds: [{
        _id: '$bedIdentity',
        bedLabel: '$BedLabel',
        ip: '$encIp',
        _class: 'com.rtwo.med.device.connect.mongo.dal.entities.BedEntity'
      }],
      _class: 'com.rtwo.med.device.connect.mongo.dal.entities.CenterEntity'
    }
  },
  { upsert: true }
);
print('deviceConfigEntity count: ' + db.deviceConfigEntity.estimatedDocumentCount());
print('centerEntity beds: ' + JSON.stringify(db.centerEntity.findOne({ _id: 'RTWO' }).beds));
"@

docker exec CIS-mongodb mongosh "mongodb://monish:admin@123@localhost:27017/v2-ICU-Connect?authSource=admin" --quiet --eval $mongoScript

Write-Host "Ensuring BplElisa600 ventilator device config exists..." -ForegroundColor Cyan
$elisaScript = @'
db.deviceConfigEntity.updateOne(
  { _id: 'BplElisa600' },
  { $set: {
      _id: 'BplElisa600',
      deviceType: 'ventilator',
      deviceName: 'BplElisa600',
      attributes: [
        { _id: 'Mode', name: 'Mode', description: 'Ventilator Mode', color: 'cyan', group: 'primary', enabled: true },
        { _id: 'RR', name: 'Resp.Rate', description: 'Respiratory Rate', color: 'cyan', group: 'primary', enabled: true },
        { _id: 'PEEP', name: 'PEEP', description: 'PEEP', color: 'orange', group: 'primary', enabled: true },
        { _id: 'MV', name: 'MV', description: 'Minute Volume', color: 'limegreen', group: 'primary', enabled: true },
        { _id: 'Peak', name: 'Peak', description: 'Peak Pressure', color: 'gold', group: 'primary', enabled: true },
        { _id: 'VT', name: 'VT', description: 'Tidal Volume', color: 'yellow', group: 'primary', enabled: true },
        { _id: 'FiO2', name: 'FiO2', description: 'FiO2', color: 'lightcoral', group: 'primary', enabled: true },
        { _id: 'Paw', name: 'Paw', description: 'Airway Pressure', color: 'white', group: 'additional', enabled: true }
      ],
      alerts: [
        { enabled: true, alert: 'High airway pressure' },
        { enabled: true, alert: 'Low airway pressure' },
        { enabled: true, alert: 'Apnea' },
        { enabled: true, alert: 'High respiratory rate' },
        { enabled: true, alert: 'Low respiratory rate' }
      ],
      customAlerts: [{}],
      _class: 'com.rtwo.med.device.connect.mongo.dal.entities.DeviceConfigEntity'
    }
  },
  { upsert: true }
);
print('BplElisa600 config: ' + (db.deviceConfigEntity.findOne({ _id: 'BplElisa600' }) ? 'ok' : 'missing'));
'@
docker exec CIS-mongodb mongosh "mongodb://monish:admin@123@localhost:27017/v2-ICU-Connect?authSource=admin" --quiet --eval $elisaScript

Write-Host "Restarting Connect Engine + Visualization Engine..." -ForegroundColor Yellow
docker restart CIS-Deployment-connect-engine CIS-Deployment-visualization-engine CIS-Deployment-device-simulation-bed1 | Out-Null
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "Verification:" -ForegroundColor Green
try {
    $retrieve = Invoke-RestMethod -Uri "http://localhost:7012/retrieve" -TimeoutSec 15
    Write-Host ("  Connect Engine beds: {0} (bedId: {1})" -f $retrieve.beds.Count, $retrieve.beds[0].bedId)
} catch {
    Write-Host "  Connect Engine: not ready yet - wait and open http://localhost:7012"
}
try {
    $centers = Invoke-RestMethod -Uri "http://localhost:7013/get-centers" -TimeoutSec 15
    if ($centers.centers -and $centers.centers.Count -gt 0) {
        Write-Host ("  Visualization centers: {0}" -f $centers.centers.Count)
    } else {
        Write-Host "  Visualization get-centers: empty - refresh http://localhost:7013 after login"
    }
} catch {
    Write-Host "  Visualization: not ready yet"
}

Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "  Visualization Engine: http://localhost:7013  (login: center RTWO/JPN, password: password)"
Write-Host "  Connect Engine:       http://localhost:7012  (bed + device admin)"
Write-Host "  CIS Frontend:         http://localhost:7011"
Write-Host ""
Write-Host "Note: bed _id (UUID) is required in MongoDB or port 7013 shows infinite spinner."
