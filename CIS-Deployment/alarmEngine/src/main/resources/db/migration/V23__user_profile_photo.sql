-- Profile photos for Hub users. Kept off hub_users so login/session payloads
-- do not load image bytes. JPEG/PNG/WebP, stored as raw bytes.
CREATE TABLE hub_user_photos (
    user_id UUID PRIMARY KEY REFERENCES hub_users (id) ON DELETE CASCADE,
    content_type VARCHAR(64) NOT NULL,
    photo_bytes BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
