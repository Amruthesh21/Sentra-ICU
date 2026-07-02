-- RTWO JPN is the hospital center, not a ward block. Clear mistaken block_name values.

UPDATE hub_units
SET block_name = NULL
WHERE center_id = 'RTWO'
  AND UPPER(TRIM(block_name)) IN ('RTWO JPN', 'RTWO', 'MAIN ICU', 'JPN');
