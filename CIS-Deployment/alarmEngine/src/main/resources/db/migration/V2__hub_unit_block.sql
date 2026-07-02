-- ICU units: optional hospital block (wing) per unit

ALTER TABLE hub_units ADD COLUMN IF NOT EXISTS block_name VARCHAR(128);

COMMENT ON COLUMN hub_units.block_name IS 'Hospital block/wing e.g. Block A, North Wing';
