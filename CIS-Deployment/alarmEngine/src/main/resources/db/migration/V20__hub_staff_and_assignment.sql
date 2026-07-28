-- Clinical staff roster for PULSE Admin + admission assignment
CREATE TABLE IF NOT EXISTS hub_staff (
    id            UUID PRIMARY KEY,
    center_id     VARCHAR(64) NOT NULL DEFAULT 'RTWO',
    full_name     VARCHAR(200) NOT NULL,
    role_code     VARCHAR(64) NOT NULL,
    specialty     VARCHAR(120),
    status        VARCHAR(32) NOT NULL DEFAULT 'ON_DUTY',
    assigned_beds TEXT,
    phone         VARCHAR(40),
    email         VARCHAR(160),
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_staff_center ON hub_staff (center_id);
CREATE INDEX IF NOT EXISTS idx_hub_staff_role ON hub_staff (role_code);
CREATE INDEX IF NOT EXISTS idx_hub_staff_active ON hub_staff (active);

ALTER TABLE hub_patient_visits
    ADD COLUMN IF NOT EXISTS attending_physician VARCHAR(200),
    ADD COLUMN IF NOT EXISTS primary_nurse VARCHAR(200);
