-- ============================================
-- CHT Operating System - Demo Workflow Migration
-- Adds support for two-stage demo unit workflow
-- ============================================

-- New listing status enum (separate from sync_status)
-- on_demo = Currently on demonstration, not for sale
-- ready_to_sell = Ready to be listed for sale
-- sold = Item has been sold
CREATE TYPE listing_status AS ENUM ('on_demo', 'ready_to_sell', 'sold');

-- Add new columns to inventory_items
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS demo_start_date DATE,
ADD COLUMN IF NOT EXISTS demo_location VARCHAR(255),
ADD COLUMN IF NOT EXISTS listing_status listing_status,
ADD COLUMN IF NOT EXISTS registration_images TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS selling_images TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS converted_to_sale_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

-- Set default listing_status based on listing_type for existing rows
UPDATE inventory_items 
SET listing_status = 'ready_to_sell' 
WHERE listing_status IS NULL 
  AND listing_type IN ('new', 'trade_in');

UPDATE inventory_items 
SET listing_status = 'ready_to_sell' 
WHERE listing_status IS NULL 
  AND listing_type = 'ex_demo';

-- Add index for demo items queries
CREATE INDEX IF NOT EXISTS idx_inventory_listing_status 
ON inventory_items(listing_status);

CREATE INDEX IF NOT EXISTS idx_inventory_demo_start_date 
ON inventory_items(demo_start_date) 
WHERE listing_type = 'ex_demo';

-- Create view for demo items (not for sale)
CREATE OR REPLACE VIEW demo_inventory AS
SELECT 
  *,
  CURRENT_DATE - demo_start_date AS days_on_demo,
  CASE 
    WHEN demo_start_date < CURRENT_DATE - INTERVAL '24 months' THEN 'critical'
    WHEN demo_start_date < CURRENT_DATE - INTERVAL '12 months' THEN 'warning'
    ELSE 'ok'
  END AS demo_age_alert
FROM inventory_items
WHERE listing_type = 'ex_demo'
  AND listing_status = 'on_demo'
  AND is_archived = FALSE
ORDER BY demo_start_date ASC;

-- Create view for demo items ready to sell
CREATE OR REPLACE VIEW demo_ready_to_sell AS
SELECT * FROM inventory_items
WHERE listing_type = 'ex_demo'
  AND listing_status = 'ready_to_sell'
  AND is_archived = FALSE
ORDER BY converted_to_sale_at DESC;

-- Add comments
COMMENT ON COLUMN inventory_items.demo_start_date IS 'Date the item went on demonstration display';
COMMENT ON COLUMN inventory_items.demo_location IS 'Physical location where demo unit is displayed (for future multi-location support)';
COMMENT ON COLUMN inventory_items.listing_status IS 'on_demo = on display not for sale, ready_to_sell = listed for sale, sold = completed sale';
COMMENT ON COLUMN inventory_items.registration_images IS 'Original photos taken when demo unit was registered';
COMMENT ON COLUMN inventory_items.selling_images IS 'Condition photos taken when converting to sale';
COMMENT ON COLUMN inventory_items.converted_to_sale_at IS 'Timestamp when demo was converted from on_demo to ready_to_sell';
COMMENT ON COLUMN inventory_items.sold_at IS 'Timestamp when item was marked as sold';
