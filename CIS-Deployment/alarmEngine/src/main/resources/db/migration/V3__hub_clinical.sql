-- Clinical documentation for patient history & reports (Postgres master)

CREATE TABLE hub_clinical_notes (
    id           UUID PRIMARY KEY,
    visit_id     UUID NOT NULL REFERENCES hub_patient_visits(id) ON DELETE CASCADE,
    patient_id   UUID NOT NULL REFERENCES hub_patients(id) ON DELETE CASCADE,
    bed_label    VARCHAR(64),
    note_type    VARCHAR(64) NOT NULL DEFAULT 'Progress Note',
    title        VARCHAR(255),
    content      TEXT,
    status       VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    author_name  VARCHAR(255),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hub_orders (
    id           UUID PRIMARY KEY,
    visit_id     UUID NOT NULL REFERENCES hub_patient_visits(id) ON DELETE CASCADE,
    patient_id   UUID NOT NULL REFERENCES hub_patients(id) ON DELETE CASCADE,
    bed_label    VARCHAR(64),
    order_type   VARCHAR(64) NOT NULL,
    order_text   TEXT NOT NULL,
    priority     VARCHAR(32) NOT NULL DEFAULT 'ROUTINE',
    status       VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    ordered_by   VARCHAR(255),
    ordered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hub_lab_results (
    id               UUID PRIMARY KEY,
    visit_id         UUID NOT NULL REFERENCES hub_patient_visits(id) ON DELETE CASCADE,
    patient_id       UUID NOT NULL REFERENCES hub_patients(id) ON DELETE CASCADE,
    test_name        VARCHAR(255) NOT NULL,
    value            VARCHAR(128),
    unit             VARCHAR(64),
    reference_range  VARCHAR(128),
    flag             VARCHAR(32),
    status           VARCHAR(32) NOT NULL DEFAULT 'FINAL',
    resulted_at      TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hub_imaging_studies (
    id           UUID PRIMARY KEY,
    visit_id     UUID NOT NULL REFERENCES hub_patient_visits(id) ON DELETE CASCADE,
    patient_id   UUID NOT NULL REFERENCES hub_patients(id) ON DELETE CASCADE,
    modality     VARCHAR(64) NOT NULL,
    study_name   VARCHAR(255) NOT NULL,
    findings     TEXT,
    impression   TEXT,
    status       VARCHAR(32) NOT NULL DEFAULT 'FINAL',
    study_at     TIMESTAMPTZ NOT NULL,
    image_url    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hub_notes_visit ON hub_clinical_notes (visit_id, updated_at DESC);
CREATE INDEX idx_hub_orders_visit ON hub_orders (visit_id, ordered_at DESC);
CREATE INDEX idx_hub_labs_visit ON hub_lab_results (visit_id, resulted_at DESC);
CREATE INDEX idx_hub_imaging_visit ON hub_imaging_studies (visit_id, study_at DESC);
