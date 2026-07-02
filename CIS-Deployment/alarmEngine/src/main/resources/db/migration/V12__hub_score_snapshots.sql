-- ICU clinical scoring snapshots (NEWS2, SOFA, APACHE II, RASS, CAM-ICU)

CREATE TABLE IF NOT EXISTS hub_score_snapshots (
    id              UUID PRIMARY KEY,
    visit_id        UUID NOT NULL REFERENCES hub_patient_visits(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES hub_patients(id) ON DELETE CASCADE,
    bed_label       VARCHAR(32),
    score_type      VARCHAR(32) NOT NULL,
    total_score     DECIMAL(10, 2),
    interpretation  VARCHAR(512),
    risk_level      VARCHAR(64),
    inputs_json     TEXT,
    breakdown_json  TEXT,
    source          VARCHAR(16) NOT NULL DEFAULT 'MIXED',
    notes           TEXT,
    recorded_by     VARCHAR(128),
    calculated_at   TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_score_visit ON hub_score_snapshots(visit_id);
CREATE INDEX IF NOT EXISTS idx_hub_score_type ON hub_score_snapshots(score_type);
CREATE INDEX IF NOT EXISTS idx_hub_score_calc ON hub_score_snapshots(calculated_at);
