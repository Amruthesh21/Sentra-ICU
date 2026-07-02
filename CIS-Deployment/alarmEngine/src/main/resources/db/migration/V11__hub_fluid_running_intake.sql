-- Running intake fluids: rate-based accumulation with start/stop

ALTER TABLE hub_fluid_entries
    ADD COLUMN IF NOT EXISTS intake_mode VARCHAR(16) DEFAULT 'ONE_TIME',
    ADD COLUMN IF NOT EXISTS rate_ml_per_hr DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS running_status VARCHAR(16);

UPDATE hub_fluid_entries
SET intake_mode = 'ONE_TIME'
WHERE intake_mode IS NULL;
