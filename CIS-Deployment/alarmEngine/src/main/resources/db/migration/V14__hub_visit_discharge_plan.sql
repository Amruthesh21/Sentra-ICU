ALTER TABLE hub_patient_visits ADD COLUMN IF NOT EXISTS discharge_destination TEXT;
ALTER TABLE hub_patient_visits ADD COLUMN IF NOT EXISTS follow_up_plan TEXT;
