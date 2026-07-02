# Clean platform reset for fresh Super Admin / Hospital Admin testing.
# Removes: audit logs, hospitals, centers, units, beds, patients, clinical data,
#          hospital roles, and all users except Super Admin.
# Keeps: Super Admin account (email, username, password unchanged).
#
# Usage:
#   .\CIS-Deployment\scripts\reset-platform-clean.ps1
#   .\CIS-Deployment\scripts\reset-platform-clean.ps1 -SkipMongo

param(
    [switch]$SkipMongo
)

$ErrorActionPreference = "Stop"

Write-Host "=== Platform clean reset (Super Admin only) ===" -ForegroundColor Cyan

$sql = @"
BEGIN;

-- Clinical & patient data
DELETE FROM hub_fluid_entries;
DELETE FROM hub_score_snapshots;
DELETE FROM hub_clinical_notes;
DELETE FROM hub_orders;
DELETE FROM hub_lab_results;
DELETE FROM hub_imaging_studies;
DELETE FROM hub_bed_assignments;
DELETE FROM hub_admission_drafts;
DELETE FROM hub_patient_visits;
DELETE FROM hub_patients;

-- Center structure
DELETE FROM hub_beds;
DELETE FROM hub_units;
DELETE FROM hub_mongo_sync_log;
DELETE FROM hub_centers;

-- Auth audit & sessions (full wipe)
DELETE FROM hub_auth_audit;
DELETE FROM hub_auth_sessions;
DELETE FROM hub_mfa_challenges;
DELETE FROM hub_password_reset_tokens;

-- Hospital roles (permissions cascade)
DELETE FROM hub_role_permissions;
DELETE FROM hub_user_roles;
DELETE FROM hub_roles;

-- Users except Super Admin
UPDATE hub_admission_drafts SET created_by = NULL WHERE created_by IS NOT NULL;

DELETE FROM hub_users
WHERE UPPER(COALESCE(user_type, '')) <> 'SUPER_ADMIN'
  AND UPPER(COALESCE(role, '')) <> 'SUPER_ADMIN';

-- Detach super admin from any hospital scope
UPDATE hub_users
SET hospital_id = NULL,
    mfa_trusted_until = NULL,
    must_change_password = FALSE
WHERE UPPER(COALESCE(user_type, '')) = 'SUPER_ADMIN'
   OR UPPER(COALESCE(role, '')) = 'SUPER_ADMIN';

-- Hospitals last (centers already removed)
DELETE FROM hub_hospitals;

COMMIT;

SELECT 'users' AS entity, COUNT(*)::text AS remaining FROM hub_users
UNION ALL SELECT 'hospitals', COUNT(*)::text FROM hub_hospitals
UNION ALL SELECT 'centers', COUNT(*)::text FROM hub_centers
UNION ALL SELECT 'units', COUNT(*)::text FROM hub_units
UNION ALL SELECT 'beds', COUNT(*)::text FROM hub_beds
UNION ALL SELECT 'patients', COUNT(*)::text FROM hub_patients
UNION ALL SELECT 'audit_logs', COUNT(*)::text FROM hub_auth_audit
UNION ALL SELECT 'roles', COUNT(*)::text FROM hub_roles;

SELECT email, username, role, user_type, active
FROM hub_users
ORDER BY email;
"@

docker exec CIS-postgres psql -U icu_hub -d icu_hub -c $sql | Out-Host
Write-Host "Postgres: platform data cleared." -ForegroundColor Green

if (-not $SkipMongo) {
    $mongoJs = @"
const hub = db.getSiblingDB('v2-ICU-Connect');
const centers = hub.centerEntity.deleteMany({});
const patients = hub.patientInfoEntity.deleteMany({});
const alarms = hub.doctorAlarmConfig.deleteMany({});
print('Mongo centers removed: ' + centers.deletedCount);
print('Mongo patients removed: ' + patients.deletedCount);
print('Mongo alarm configs removed: ' + alarms.deletedCount);
"@

    try {
        docker exec CIS-mongodb mongosh -u monish -p "admin@123" --authenticationDatabase admin --quiet --eval $mongoJs | Out-Host
        Write-Host "Mongo: centers, patients, alarm configs cleared." -ForegroundColor Green
    } catch {
        Write-Warning "Mongo cleanup skipped or failed: $_"
    }
}

Write-Host ""
Write-Host "Done. Sign in as Super Admin and create hospitals, centers, and hospital admins fresh." -ForegroundColor Cyan
