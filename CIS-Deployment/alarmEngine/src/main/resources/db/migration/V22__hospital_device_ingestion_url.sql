-- Per-hospital bedside gateway URL. Cloud Hub/alarm-engine reach the
-- hospital's device-ingestion HTTP API over VPN/private link; devices
-- themselves never talk to the cloud. NULL means "use DEVICE_INGESTION_URL"
-- (the local all-in-one default).
ALTER TABLE hub_hospitals
    ADD COLUMN IF NOT EXISTS device_ingestion_url VARCHAR(512);
