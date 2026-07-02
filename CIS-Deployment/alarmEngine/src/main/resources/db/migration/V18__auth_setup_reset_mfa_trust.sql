-- Account setup, password reset, MFA trust window, clinician specialty

ALTER TABLE hub_users
    ADD COLUMN IF NOT EXISTS specialty VARCHAR(128);

ALTER TABLE hub_users
    ADD COLUMN IF NOT EXISTS mfa_trusted_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS hub_password_reset_tokens (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_password_reset_user
    ON hub_password_reset_tokens (user_id, consumed, expires_at);
