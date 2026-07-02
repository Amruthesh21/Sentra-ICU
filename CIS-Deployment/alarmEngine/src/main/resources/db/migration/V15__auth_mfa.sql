-- ICU Connect V2 — Auth, MFA, hospitals, roles foundation

CREATE TABLE hub_hospitals (
    id          UUID PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    code        VARCHAR(64) NOT NULL UNIQUE,
    status      VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS username VARCHAR(128);
ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS user_type VARCHAR(32) NOT NULL DEFAULT 'HOSPITAL_USER';
ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hub_hospitals(id);
ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(128);
ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_users_username ON hub_users (LOWER(username)) WHERE username IS NOT NULL;

ALTER TABLE hub_centers
    ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hub_hospitals(id);

CREATE TABLE hub_roles (
    id           UUID PRIMARY KEY,
    hospital_id  UUID REFERENCES hub_hospitals(id),
    name         VARCHAR(128) NOT NULL,
    description  TEXT,
    is_system    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hub_role_permissions (
    role_id         UUID NOT NULL REFERENCES hub_roles(id) ON DELETE CASCADE,
    permission_key  VARCHAR(128) NOT NULL,
    PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE hub_user_roles (
    user_id  UUID NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
    role_id  UUID NOT NULL REFERENCES hub_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE hub_mfa_challenges (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
    channel         VARCHAR(32) NOT NULL,
    code_hash       VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed        BOOLEAN NOT NULL DEFAULT FALSE,
    attempt_count   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hub_mfa_challenges_user ON hub_mfa_challenges (user_id, consumed, expires_at);

CREATE TABLE hub_auth_sessions (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
    refresh_hash    VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN NOT NULL DEFAULT FALSE,
    user_agent      VARCHAR(512),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hub_auth_sessions_user ON hub_auth_sessions (user_id, revoked);

CREATE TABLE hub_auth_audit (
    id          UUID PRIMARY KEY,
    user_id     UUID REFERENCES hub_users(id),
    action      VARCHAR(64) NOT NULL,
    detail      TEXT,
    ip_address  VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
