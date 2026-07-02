-- Extended physician order fields for Order Management / MAR

ALTER TABLE hub_orders ADD COLUMN IF NOT EXISTS drug_name VARCHAR(255);
ALTER TABLE hub_orders ADD COLUMN IF NOT EXISTS dose VARCHAR(128);
ALTER TABLE hub_orders ADD COLUMN IF NOT EXISTS route VARCHAR(64);
ALTER TABLE hub_orders ADD COLUMN IF NOT EXISTS frequency VARCHAR(64);
ALTER TABLE hub_orders ADD COLUMN IF NOT EXISTS duration VARCHAR(64);
ALTER TABLE hub_orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE hub_orders ADD COLUMN IF NOT EXISTS discontinue_reason VARCHAR(255);
ALTER TABLE hub_orders ADD COLUMN IF NOT EXISTS discontinued_at TIMESTAMPTZ;

-- Normalize legacy statuses
UPDATE hub_orders SET status = 'APPROVED' WHERE status = 'ACTIVE';
UPDATE hub_orders SET status = 'DISCONTINUED' WHERE status IN ('CANCELLED', 'COMPLETED');
