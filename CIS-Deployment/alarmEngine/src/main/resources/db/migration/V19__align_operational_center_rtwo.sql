-- Align all operational hub data with Connect Engine center (RTWO).
-- Hospitals remain organizational; beds/admissions/units use RTWO only.

INSERT INTO hub_centers (id, name, location, status)
VALUES ('RTWO', 'RTWO', 'JPN', 'ACTIVE')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    location = COALESCE(NULLIF(hub_centers.location, ''), EXCLUDED.location),
    status = 'ACTIVE';

-- Move active bed assignments onto RTWO beds when the same bed label exists.
UPDATE hub_bed_assignments ba
SET bed_id = r.id
FROM hub_beds a
JOIN hub_beds r ON r.center_id = 'RTWO' AND r.bed_label = a.bed_label
WHERE ba.bed_id = a.id
  AND a.center_id <> 'RTWO';

-- Move beds that do not conflict with an existing RTWO label.
UPDATE hub_beds b
SET center_id = 'RTWO'
WHERE b.center_id <> 'RTWO'
  AND NOT EXISTS (
    SELECT 1 FROM hub_beds r
    WHERE r.center_id = 'RTWO' AND r.bed_label = b.bed_label
  );

-- Point beds at RTWO units when a matching unit code exists.
UPDATE hub_beds b
SET unit_id = r.id
FROM hub_units a
JOIN hub_units r ON r.center_id = 'RTWO' AND r.code = a.code
WHERE b.unit_id = a.id
  AND a.center_id <> 'RTWO';

-- Move units that do not conflict with an existing RTWO code.
UPDATE hub_units u
SET center_id = 'RTWO'
WHERE u.center_id <> 'RTWO'
  AND NOT EXISTS (
    SELECT 1 FROM hub_units r
    WHERE r.center_id = 'RTWO' AND r.code = u.code
  );

-- Link RTWO to any hospital that was tied to a hospital-specific center.
UPDATE hub_centers
SET hospital_id = (
    SELECT hospital_id
    FROM hub_centers
    WHERE hospital_id IS NOT NULL
      AND id <> 'RTWO'
    ORDER BY id
    LIMIT 1
)
WHERE id = 'RTWO'
  AND hospital_id IS NULL
  AND EXISTS (
    SELECT 1 FROM hub_centers
    WHERE hospital_id IS NOT NULL AND id <> 'RTWO'
  );

-- Deactivate orphan hospital-specific centers (e.g. APOLLO).
UPDATE hub_centers
SET hospital_id = NULL, status = 'INACTIVE'
WHERE id <> 'RTWO'
  AND hospital_id IS NOT NULL;
