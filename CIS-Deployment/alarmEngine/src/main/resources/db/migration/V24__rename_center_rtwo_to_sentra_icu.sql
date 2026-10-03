-- Rename the operational center id from the old product name to Sentra ICU.
-- Historical Flyway files are left untouched; this is the live data cutover.

INSERT INTO hub_centers (id, name, location, status, hospital_id)
SELECT 'SENTRA_ICU',
       'Sentra ICU',
       COALESCE(location, 'JPN'),
       COALESCE(status, 'ACTIVE'),
       hospital_id
FROM hub_centers
WHERE id = 'RTWO'
ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        location = COALESCE(hub_centers.location, EXCLUDED.location),
        status = COALESCE(hub_centers.status, EXCLUDED.status),
        hospital_id = COALESCE(hub_centers.hospital_id, EXCLUDED.hospital_id);

UPDATE hub_units SET center_id = 'SENTRA_ICU' WHERE center_id = 'RTWO';
UPDATE hub_beds SET center_id = 'SENTRA_ICU' WHERE center_id = 'RTWO';
UPDATE hub_staff SET center_id = 'SENTRA_ICU' WHERE center_id = 'RTWO';

DELETE FROM hub_centers WHERE id = 'RTWO';

ALTER TABLE hub_staff ALTER COLUMN center_id SET DEFAULT 'SENTRA_ICU';

UPDATE hub_users
SET email = 'legacy-admin@sentraicu.local',
    active = FALSE
WHERE LOWER(email) = 'admin@rtwo.com';
