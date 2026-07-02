-- Remove mistaken RTWO ward unit (RTWO JPN is the hospital center, not an ICU unit)

DELETE FROM hub_units
WHERE center_id = 'RTWO'
  AND UPPER(TRIM(code)) = 'RTWO'
  AND NOT EXISTS (
    SELECT 1 FROM hub_beds b WHERE b.unit_id = hub_units.id AND b.active = TRUE
  );
