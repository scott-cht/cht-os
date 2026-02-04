-- ============================================
-- CHT Operating System - Phase 1 Schema
-- Unified Inventory Items Table
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Listing type enum
CREATE TYPE listing_type AS ENUM ('new', 'trade_in', 'ex_demo');

-- Condition grade enum for pre-owned items
CREATE TYPE condition_grade AS ENUM ('mint', 'excellent', 'good', 'fair', 'poor');

-- Sync status enum
CREATE TYPE sync_status AS ENUM ('pending', 'syncing', 'synced', 'error');

-- ============================================
-- Main Inventory Items Table
-- ============================================
CREATE TABLE inventory_items (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Listing Classification
  listing_type listing_type NOT NULL,
  
  -- Product Identification
  brand VARCHAR(255) NOT NULL,
  model VARCHAR(255) NOT NULL,
  serial_number VARCHAR(255), -- NULLABLE as per requirement
  sku VARCHAR(100),
  
  -- Pricing (all AUD)
  rrp_aud DECIMAL(10, 2),
  cost_price DECIMAL(10, 2),
  sale_price DECIMAL(10, 2) NOT NULL,
  
  -- Condition (for pre-owned/ex-demo)
  condition_grade condition_grade,
  condition_report TEXT,
  
  -- Media
  image_urls TEXT[] DEFAULT '{}',
  vision_ai_response JSONB, -- Store raw Vision AI response
  
  -- Product Content (AI Generated)
  title VARCHAR(255),
  description_html TEXT,
  meta_description VARCHAR(160),
  specifications JSONB DEFAULT '{}',
  
  -- External IDs (The "Pipes")
  shopify_product_id VARCHAR(100),
  shopify_variant_id VARCHAR(100),
  hubspot_deal_id VARCHAR(100),
  notion_page_id VARCHAR(100),
  
  -- Sync Status
  sync_status sync_status DEFAULT 'pending',
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  
  -- Source Tracking
  source_url VARCHAR(2048),
  rrp_source VARCHAR(255), -- Which retailer the RRP came from
  
  -- User/Session
  created_by UUID,
  
  -- Soft Delete
  is_archived BOOLEAN DEFAULT FALSE
);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX idx_inventory_listing_type ON inventory_items(listing_type);
CREATE INDEX idx_inventory_brand_model ON inventory_items(brand, model);
CREATE INDEX idx_inventory_serial ON inventory_items(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_inventory_sync_status ON inventory_items(sync_status);
CREATE INDEX idx_inventory_shopify_id ON inventory_items(shopify_product_id) WHERE shopify_product_id IS NOT NULL;
CREATE INDEX idx_inventory_hubspot_id ON inventory_items(hubspot_deal_id) WHERE hubspot_deal_id IS NOT NULL;
CREATE INDEX idx_inventory_created_at ON inventory_items(created_at DESC);
CREATE INDEX idx_inventory_not_archived ON inventory_items(is_archived) WHERE is_archived = FALSE;

-- ============================================
-- Trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access" ON inventory_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy: Authenticated users can read non-archived items
CREATE POLICY "Authenticated users can read" ON inventory_items
  FOR SELECT
  USING (auth.role() = 'authenticated' AND is_archived = FALSE);

-- Policy: Authenticated users can insert
CREATE POLICY "Authenticated users can insert" ON inventory_items
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can update their own items
CREATE POLICY "Authenticated users can update own" ON inventory_items
  FOR UPDATE
  USING (auth.role() = 'authenticated' AND created_by = auth.uid())
  WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

-- ============================================
-- Views for Common Queries
-- ============================================

-- Active inventory (not archived, not synced errors)
CREATE VIEW active_inventory AS
SELECT * FROM inventory_items
WHERE is_archived = FALSE
ORDER BY created_at DESC;

-- Pre-owned inventory only
CREATE VIEW preowned_inventory AS
SELECT * FROM inventory_items
WHERE listing_type IN ('trade_in', 'ex_demo')
  AND is_archived = FALSE
ORDER BY created_at DESC;

-- Pending sync items
CREATE VIEW pending_sync AS
SELECT * FROM inventory_items
WHERE sync_status IN ('pending', 'error')
  AND is_archived = FALSE
ORDER BY created_at ASC;

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON TABLE inventory_items IS 'Unified inventory table for CHT Operating System - handles both new retail and pre-owned items';
COMMENT ON COLUMN inventory_items.listing_type IS 'new = new retail, trade_in = customer trade-in, ex_demo = ex-demonstration unit';
COMMENT ON COLUMN inventory_items.serial_number IS 'Optional - encouraged for pre-owned but can be skipped';
COMMENT ON COLUMN inventory_items.vision_ai_response IS 'Raw JSON response from Vision AI for audit trail';
COMMENT ON COLUMN inventory_items.sync_status IS 'Tracks sync state across Shopify, HubSpot, Notion';
