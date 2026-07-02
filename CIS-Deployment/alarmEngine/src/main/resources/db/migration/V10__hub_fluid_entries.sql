-- Fluid intake / output charting (ICU I/O balance — Indian ICU chart standard)

CREATE TABLE IF NOT EXISTS hub_fluid_entries (
    id              UUID PRIMARY KEY,
    visit_id        UUID NOT NULL REFERENCES hub_patient_visits(id),
    patient_id      UUID NOT NULL REFERENCES hub_patients(id),
    bed_label       VARCHAR(32),
    entry_type      VARCHAR(16) NOT NULL,
    category        VARCHAR(64) NOT NULL,
    fluid_name      VARCHAR(128) NOT NULL,
    volume_ml       DECIMAL(10, 2),
    unit            VARCHAR(16) DEFAULT 'ml',
    recorded_at     TIMESTAMPTZ NOT NULL,
    notes           TEXT,
    recorded_by     VARCHAR(128),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_fluid_visit ON hub_fluid_entries(visit_id);
CREATE INDEX IF NOT EXISTS idx_hub_fluid_recorded ON hub_fluid_entries(recorded_at);
