-- ============================================
-- CHT Operating System - Shopify Product Import & Enrichment
-- Creates tables for importing and managing Shopify products locally
-- ============================================

-- Create enum for Shopify product status
DO $$ BEGIN
    CREATE TYPE shopify_product_status AS ENUM ('active', 'draft', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for enrichment status
DO $$ BEGIN
    CREATE TYPE enrichment_status AS ENUM ('pending', 'enriched', 'synced');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for snapshot type
DO $$ BEGIN
    CREATE TYPE snapshot_type AS ENUM ('original', 'before_sync', 'manual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- Main table: shopify_products
-- Stores imported Shopify products for local management
-- ============================================
CREATE TABLE IF NOT EXISTS shopify_products (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Shopify identifiers
    shopify_id VARCHAR(100) NOT NULL UNIQUE,
    shopify_variant_id VARCHAR(100),
    handle VARCHAR(255),
    
    -- Product content
    title VARCHAR(255) NOT NULL,
    description_html TEXT,
    vendor VARCHAR(255),
    product_type VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    
    -- Shopify status
    status shopify_product_status DEFAULT 'active',
    
    -- Media and variants (stored as JSONB for flexibility)
    images JSONB DEFAULT '[]',
    variants JSONB DEFAULT '[]',
    metafields JSONB DEFAULT '{}',
    
    -- Enriched content (stored separately from original)
    enriched_title VARCHAR(255),
    enriched_description_html TEXT,
    enriched_meta_description VARCHAR(160),
    
    -- Linking to pricelist items
    linked_inventory_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    
    -- Status tracking
    enrichment_status enrichment_status DEFAULT 'pending',
    
    -- Timestamps
    shopify_created_at TIMESTAMPTZ,
    shopify_updated_at TIMESTAMPTZ,
    last_imported_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Snapshots table: shopify_product_snapshots
-- Stores original and pre-sync snapshots for rollback
-- ============================================
CREATE TABLE IF NOT EXISTS shopify_product_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to product
    shopify_product_id UUID NOT NULL REFERENCES shopify_products(id) ON DELETE CASCADE,
    
    -- Snapshot metadata
    snapshot_type snapshot_type NOT NULL,
    note TEXT,
    
    -- Complete product data at time of snapshot
    data JSONB NOT NULL,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for shopify_products
-- ============================================

-- Shopify ID lookup (already unique, but explicit index)
CREATE INDEX IF NOT EXISTS idx_shopify_products_shopify_id 
    ON shopify_products(shopify_id);

-- Handle lookup for URL matching
CREATE INDEX IF NOT EXISTS idx_shopify_products_handle 
    ON shopify_products(handle);

-- Vendor/brand for matching
CREATE INDEX IF NOT EXISTS idx_shopify_products_vendor 
    ON shopify_products(vendor);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_shopify_products_status 
    ON shopify_products(status);

-- Enrichment status for workflow filtering
CREATE INDEX IF NOT EXISTS idx_shopify_products_enrichment_status 
    ON shopify_products(enrichment_status);

-- Linked inventory for join queries
CREATE INDEX IF NOT EXISTS idx_shopify_products_linked_inventory 
    ON shopify_products(linked_inventory_id) 
    WHERE linked_inventory_id IS NOT NULL;

-- Full-text search on title and vendor
CREATE INDEX IF NOT EXISTS idx_shopify_products_search 
    ON shopify_products USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(vendor, '')));

-- Updated at for sync detection
CREATE INDEX IF NOT EXISTS idx_shopify_products_updated 
    ON shopify_products(updated_at DESC);

-- ============================================
-- Indexes for shopify_product_snapshots
-- ============================================

-- Product lookup with type
CREATE INDEX IF NOT EXISTS idx_snapshots_product_type 
    ON shopify_product_snapshots(shopify_product_id, snapshot_type);

-- Chronological ordering
CREATE INDEX IF NOT EXISTS idx_snapshots_created 
    ON shopify_product_snapshots(shopify_product_id, created_at DESC);

-- ============================================
-- Trigger: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_shopify_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_shopify_products_updated_at ON shopify_products;
CREATE TRIGGER trigger_shopify_products_updated_at
    BEFORE UPDATE ON shopify_products
    FOR EACH ROW
    EXECUTE FUNCTION update_shopify_products_updated_at();

-- ============================================
-- View: Unlinked products (need pricelist matching)
-- ============================================
CREATE OR REPLACE VIEW shopify_products_unlinked AS
SELECT 
    sp.*,
    (SELECT COUNT(*) FROM shopify_product_snapshots WHERE shopify_product_id = sp.id) as snapshot_count
FROM shopify_products sp
WHERE sp.linked_inventory_id IS NULL;

-- ============================================
-- View: Products needing enrichment
-- ============================================
CREATE OR REPLACE VIEW shopify_products_pending_enrichment AS
SELECT 
    sp.*,
    ii.brand as linked_brand,
    ii.model as linked_model,
    ii.rrp_aud as linked_rrp
FROM shopify_products sp
LEFT JOIN inventory_items ii ON sp.linked_inventory_id = ii.id
WHERE sp.enrichment_status = 'pending';

-- ============================================
-- View: Products with changes ready to sync
-- ============================================
CREATE OR REPLACE VIEW shopify_products_ready_to_sync AS
SELECT 
    sp.*,
    (sp.enriched_title IS NOT NULL AND sp.enriched_title != sp.title) as title_changed,
    (sp.enriched_description_html IS NOT NULL AND sp.enriched_description_html != sp.description_html) as description_changed,
    (sp.enriched_meta_description IS NOT NULL) as meta_changed
FROM shopify_products sp
WHERE sp.enrichment_status = 'enriched'
  AND (
    sp.enriched_title IS NOT NULL 
    OR sp.enriched_description_html IS NOT NULL 
    OR sp.enriched_meta_description IS NOT NULL
  );

-- ============================================
-- Enable Row Level Security
-- ============================================
ALTER TABLE shopify_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_product_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated users" ON shopify_products
    FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON shopify_product_snapshots
    FOR ALL USING (true);

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE shopify_products IS 'Imported Shopify products for local enrichment and management';
COMMENT ON TABLE shopify_product_snapshots IS 'Point-in-time snapshots of product data for rollback capability';

COMMENT ON COLUMN shopify_products.shopify_id IS 'Shopify product GID (e.g., gid://shopify/Product/123)';
COMMENT ON COLUMN shopify_products.enriched_title IS 'AI-optimized title (stored separately for diff view)';
COMMENT ON COLUMN shopify_products.enriched_description_html IS 'AI-optimized description (stored separately for diff view)';
COMMENT ON COLUMN shopify_products.enriched_meta_description IS 'AI-generated meta description for SEO';
COMMENT ON COLUMN shopify_products.linked_inventory_id IS 'Link to pricelist/inventory item for data enrichment';

COMMENT ON COLUMN shopify_product_snapshots.snapshot_type IS 'original = first import, before_sync = pre-push backup, manual = user-created';
COMMENT ON COLUMN shopify_product_snapshots.data IS 'Complete JSONB snapshot of product state at time of creation';
