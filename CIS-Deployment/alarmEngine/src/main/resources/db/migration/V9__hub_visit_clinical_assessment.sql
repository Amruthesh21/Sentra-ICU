-- Dedicated Postgres columns for admission clinical assessment (in addition to clinical_snapshot JSONB)

ALTER TABLE hub_patient_visits
    ADD COLUMN IF NOT EXISTS provisional_diagnosis TEXT,
    ADD COLUMN IF NOT EXISTS allergy_history TEXT,
    ADD COLUMN IF NOT EXISTS past_medical_history TEXT,
    ADD COLUMN IF NOT EXISTS family_history TEXT,
    ADD COLUMN IF NOT EXISTS systemic_examination TEXT,
    ADD COLUMN IF NOT EXISTS comorbidities JSONB;
