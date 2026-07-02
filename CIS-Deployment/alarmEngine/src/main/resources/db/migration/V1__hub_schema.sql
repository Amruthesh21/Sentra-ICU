-- ICU Connect Hub — PostgreSQL master schema (Phase 1: admission)

CREATE TABLE hub_users (
    id              UUID PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255),
    display_name    VARCHAR(255),
    role            VARCHAR(64) NOT NULL DEFAULT 'CLINICIAN',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hub_centers (
    id          VARCHAR(32) PRIMARY KEY,
    name        VARCHAR(128) NOT NULL,
    location    VARCHAR(64)
);

CREATE TABLE hub_units (
    id          UUID PRIMARY KEY,
    center_id   VARCHAR(32) NOT NULL REFERENCES hub_centers(id),
    code        VARCHAR(32) NOT NULL,
    name        VARCHAR(128) NOT NULL,
    UNIQUE (center_id, code)
);

CREATE TABLE hub_beds (
    id               UUID PRIMARY KEY,
    center_id        VARCHAR(32) NOT NULL REFERENCES hub_centers(id),
    unit_id          UUID REFERENCES hub_units(id),
    bed_label        VARCHAR(64) NOT NULL,
    device_ip        VARCHAR(64),
    mongo_bed_id     VARCHAR(64),
    simulation_mode  VARCHAR(32),
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (center_id, bed_label)
);

CREATE TABLE hub_patients (
    id               UUID PRIMARY KEY,
    mrn              VARCHAR(64) NOT NULL UNIQUE,
    external_id      VARCHAR(64),
    full_name        VARCHAR(255) NOT NULL,
    sex              VARCHAR(16),
    date_of_birth    DATE,
    birth_weight_kg  DOUBLE PRECISION,
    mongo_upid       VARCHAR(24) UNIQUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hub_patient_visits (
    id                    UUID PRIMARY KEY,
    patient_id            UUID NOT NULL REFERENCES hub_patients(id),
    visit_number          INT NOT NULL,
    admission_type        VARCHAR(64),
    admission_source      VARCHAR(128),
    referring_physician   VARCHAR(255),
    primary_diagnosis     TEXT,
    isolation_flags       JSONB,
    admitted_at           TIMESTAMPTZ NOT NULL,
    discharged_at         TIMESTAMPTZ,
    status                VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    clinical_snapshot     JSONB,
    consent               JSONB,
    device_mapping        JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hub_bed_assignments (
    id           UUID PRIMARY KEY,
    visit_id     UUID NOT NULL REFERENCES hub_patient_visits(id),
    bed_id       UUID NOT NULL REFERENCES hub_beds(id),
    assigned_at  TIMESTAMPTZ NOT NULL,
    released_at  TIMESTAMPTZ,
    active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE hub_admission_drafts (
    id             UUID PRIMARY KEY,
    workflow_type  VARCHAR(32) NOT NULL,
    patient_id     UUID REFERENCES hub_patients(id),
    payload        JSONB NOT NULL,
    created_by     UUID REFERENCES hub_users(id),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hub_mongo_sync_log (
    id             UUID PRIMARY KEY,
    entity_type    VARCHAR(64) NOT NULL,
    entity_id      VARCHAR(64) NOT NULL,
    status         VARCHAR(32) NOT NULL,
    error_message  TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hub_patients_mrn ON hub_patients (mrn);
CREATE INDEX idx_hub_patients_name ON hub_patients (LOWER(full_name));
CREATE INDEX idx_hub_visits_patient ON hub_patient_visits (patient_id);
CREATE INDEX idx_hub_visits_status ON hub_patient_visits (status);
CREATE INDEX idx_hub_bed_assign_active ON hub_bed_assignments (bed_id, active) WHERE active = TRUE;

INSERT INTO hub_centers (id, name, location) VALUES ('RTWO', 'RTWO', 'JPN');

INSERT INTO hub_units (id, center_id, code, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'RTWO', 'R2', 'ICU R2');

INSERT INTO hub_users (id, email, display_name, role)
VALUES ('00000000-0000-0000-0000-000000000099', 'admin@rtwo.com', 'Hub Admin', 'ADMIN');
