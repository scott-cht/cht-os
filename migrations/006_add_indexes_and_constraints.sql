-- ============================================
-- Migration 006: Add Missing Indexes & Constraints
-- ============================================
-- Improves query performance and data integrity
-- for product_onboarding and inventory_items tables

-- ============================================
-- PART 1: Indexes for product_onboarding
-- ============================================

-- Index for brand filtering (frequently filtered)
CREATE INDEX IF NOT EXISTS idx_product_onboarding_brand 
ON product_onboarding(brand);

-- Index for model number searches
CREATE INDEX IF NOT EXISTS idx_product_onboarding_model 
ON product_onboarding(model_number);

-- Index for status filtering (workflow queries)
CREATE INDEX IF NOT EXISTS idx_product_onboarding_status 
ON product_onboarding(status);

-- Index for sorting by created date
CREATE INDEX IF NOT EXISTS idx_product_onboarding_created_at 
ON product_onboarding(created_at DESC);

-- Composite index for brand + model lookups
CREATE INDEX IF NOT EXISTS idx_product_onboarding_brand_model 
ON product_onboarding(brand, model_number);

-- Index for Shopify ID lookups
CREATE INDEX IF NOT EXISTS idx_product_onboarding_shopify_id 
ON product_onboarding(shopify_product_id) 
WHERE shopify_product_id IS NOT NULL;

-- ============================================
-- PART 2: Add archived column to product_onboarding
-- (Sync with migration 004)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_onboarding' 
    AND column_name = 'archived'
  ) THEN
    ALTER TABLE product_onboarding 
    ADD COLUMN archived BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Index for non-archived items
CREATE INDEX IF NOT EXISTS idx_product_onboarding_not_archived 
ON product_onboarding(archived) 
WHERE archived = FALSE;

-- ============================================
-- PART 3: Constraints for product_onboarding
-- ============================================

-- Ensure RRP is non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'product_onboarding_rrp_positive'
  ) THEN
    ALTER TABLE product_onboarding 
    ADD CONSTRAINT product_onboarding_rrp_positive 
    CHECK (rrp_aud IS NULL OR rrp_aud >= 0);
  END IF;
EXCEPTION WHEN others THEN
  -- Constraint may already exist with different format
  NULL;
END $$;

-- Ensure cost price is non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'product_onboarding_cost_positive'
  ) THEN
    ALTER TABLE product_onboarding 
    ADD CONSTRAINT product_onboarding_cost_positive 
    CHECK (cost_price IS NULL OR cost_price >= 0);
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Ensure sales price is non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'product_onboarding_sales_positive'
  ) THEN
    ALTER TABLE product_onboarding 
    ADD CONSTRAINT product_onboarding_sales_positive 
    CHECK (sales_price IS NULL OR sales_price >= 0);
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- ============================================
-- PART 4: Constraints for inventory_items
-- ============================================

-- Ensure sale_price is positive (required field)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'inventory_items_sale_price_positive'
  ) THEN
    ALTER TABLE inventory_items 
    ADD CONSTRAINT inventory_items_sale_price_positive 
    CHECK (sale_price > 0);
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Ensure RRP is non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'inventory_items_rrp_positive'
  ) THEN
    ALTER TABLE inventory_items 
    ADD CONSTRAINT inventory_items_rrp_positive 
    CHECK (rrp_aud IS NULL OR rrp_aud >= 0);
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Ensure cost price is non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'inventory_items_cost_positive'
  ) THEN
    ALTER TABLE inventory_items 
    ADD CONSTRAINT inventory_items_cost_positive 
    CHECK (cost_price IS NULL OR cost_price >= 0);
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- ============================================
-- PART 5: Additional useful indexes for inventory_items
-- ============================================

-- Index for listing_status filtering
CREATE INDEX IF NOT EXISTS idx_inventory_listing_status 
ON inventory_items(listing_status);

-- Index for price range queries
CREATE INDEX IF NOT EXISTS idx_inventory_sale_price 
ON inventory_items(sale_price);

-- Index for updated_at (useful for sync queries)
CREATE INDEX IF NOT EXISTS idx_inventory_updated_at 
ON inventory_items(updated_at DESC);

-- Full-text search index for brand + model + title
CREATE INDEX IF NOT EXISTS idx_inventory_search 
ON inventory_items USING gin(
  to_tsvector('english', coalesce(brand, '') || ' ' || coalesce(model, '') || ' ' || coalesce(title, ''))
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON INDEX idx_product_onboarding_brand IS 'Speeds up brand filtering in product search';
COMMENT ON INDEX idx_product_onboarding_status IS 'Speeds up workflow status queries';
COMMENT ON INDEX idx_inventory_listing_status IS 'Speeds up listing status filtering';
COMMENT ON INDEX idx_inventory_sale_price IS 'Speeds up price range queries';
