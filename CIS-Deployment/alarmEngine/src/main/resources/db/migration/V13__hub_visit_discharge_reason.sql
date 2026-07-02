ALTER TABLE hub_patient_visits
    ADD COLUMN IF NOT EXISTS discharge_reason TEXT;
