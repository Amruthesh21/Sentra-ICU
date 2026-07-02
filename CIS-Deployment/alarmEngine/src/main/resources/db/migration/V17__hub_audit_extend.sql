-- Extend audit log for platform & hospital-scoped admin actions

ALTER TABLE hub_auth_audit ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hub_hospitals(id);
ALTER TABLE hub_auth_audit ADD COLUMN IF NOT EXISTS category VARCHAR(32);
ALTER TABLE hub_auth_audit ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255);
ALTER TABLE hub_auth_audit ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_hub_auth_audit_hospital ON hub_auth_audit (hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_auth_audit_category ON hub_auth_audit (category, created_at DESC);

UPDATE hub_auth_audit SET category = 'AUTH' WHERE category IS NULL;
