# Reset Hub clinical data: units, beds, patients (Postgres + Mongo mirror).
# Keeps hospital center (SENTRA_ICU) and admin user. Device catalog unchanged.
#
# Usage:
#   .\CIS-Deployment\scripts\reset-hub-clinical-data.ps1
#   .\CIS-Deployment\scripts\reset-hub-clinical-data.ps1 -SyncConnectEngine

param(
    [switch]$SyncConnectEngine
)

$ErrorActionPreference = "Stop"

Write-Host "Resetting Hub units, beds, and patients..." -ForegroundColor Cyan

$sql = @"
DELETE FROM hub_bed_assignments;
DELETE FROM hub_admission_drafts;
DELETE FROM hub_patient_visits;
DELETE FROM hub_patients;
DELETE FROM hub_beds;
DELETE FROM hub_units;
DELETE FROM hub_mongo_sync_log;
"@

docker exec CIS-postgres psql -U icu_hub -d icu_hub -c $sql | Out-Host
Write-Host "Postgres: units, beds, patients cleared." -ForegroundColor Green

$mongoJs = @"
const hub = db.getSiblingDB('v2-ICU-Connect');
const center = hub.centerEntity.updateOne({ _id: 'SENTRA_ICU' }, { `$set: { beds: [] } });
const patients = hub.patientInfoEntity.deleteMany({});
print('Mongo center beds cleared: ' + center.modifiedCount);
print('Mongo patients removed: ' + patients.deletedCount);
"@

docker exec CIS-mongodb mongosh -u monish -p "admin@123" --authenticationDatabase admin --quiet --eval $mongoJs | Out-Host
Write-Host "Mongo: beds and patients cleared." -ForegroundColor Green

if ($SyncConnectEngine) {
    try {
        $result = Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:7020/api/center/reload"
        Write-Host "Connect Engine sync: $($result.message)" -ForegroundColor Green
    } catch {
        Write-Warning "Connect Engine reload failed (is alarm-engine running?): $_"
    }
}

Write-Host ""
Write-Host "Done. Admin and Patient Management are empty - create units and beds in Admin to test." -ForegroundColor Cyan
