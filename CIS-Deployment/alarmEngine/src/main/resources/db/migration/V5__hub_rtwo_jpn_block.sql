-- Default hospital block for RTWO JPN and seed RTWO ICU unit

UPDATE hub_units SET block_name = 'RTWO JPN' WHERE center_id = 'RTWO' AND (block_name IS NULL OR block_name = '');

INSERT INTO hub_units (id, center_id, code, name, block_name)
VALUES ('00000000-0000-0000-0000-000000000002', 'RTWO', 'RTWO', 'RTWO', 'RTWO JPN')
ON CONFLICT (center_id, code) DO UPDATE SET block_name = EXCLUDED.block_name, name = EXCLUDED.name;

UPDATE hub_units SET name = 'R2', code = 'R2' WHERE id = '00000000-0000-0000-0000-000000000001' AND code = 'R2';
