# Remove all Hub users except Super Admin (keeps super admin credentials unchanged).
#
# Usage:
#   .\CIS-Deployment\scripts\reset-hub-users.ps1

$ErrorActionPreference = "Stop"

Write-Host "Removing all users except Super Admin..." -ForegroundColor Cyan

$sql = @"
BEGIN;

UPDATE hub_admission_drafts SET created_by = NULL WHERE created_by IS NOT NULL;

UPDATE hub_auth_audit
SET user_id = NULL
WHERE user_id IN (
    SELECT id FROM hub_users
    WHERE UPPER(COALESCE(user_type, '')) <> 'SUPER_ADMIN'
      AND UPPER(COALESCE(role, '')) <> 'SUPER_ADMIN'
);

DELETE FROM hub_users
WHERE UPPER(COALESCE(user_type, '')) <> 'SUPER_ADMIN'
  AND UPPER(COALESCE(role, '')) <> 'SUPER_ADMIN';

COMMIT;

SELECT email, username, role, user_type, active
FROM hub_users
ORDER BY email;
"@

docker exec CIS-postgres psql -U icu_hub -d icu_hub -c $sql | Out-Host
Write-Host "Done. Only Super Admin account remains." -ForegroundColor Green
