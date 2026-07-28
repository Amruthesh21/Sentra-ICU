-- Rename operational center display name from RTWO → Sentra ICU (id stays RTWO for Connect Engine sync).
UPDATE hub_centers
SET name = 'Sentra ICU'
WHERE id = 'RTWO'
   OR UPPER(TRIM(name)) = 'RTWO'
   OR UPPER(TRIM(name)) LIKE 'RTWO %';
