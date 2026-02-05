-- ============================================
-- COMBINED MIGRATIONS (005, 006, 007)
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- ============================================
-- MIGRATION 005: Audit Log
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  user_id UUID,
  user_email VARCHAR(255),
  changes JSONB,
  metadata JSONB,
  summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- ============================================
-- MIGRATION 006: Indexes & Constraints
-- ============================================

CREATE INDEX IF NOT EXISTS idx_product_onboarding_brand ON product_onboarding(brand);
CREATE INDEX IF NOT EXISTS idx_product_onboarding_model ON product_onboarding(model_number);
CREATE INDEX IF NOT EXISTS idx_product_onboarding_status ON product_onboarding(status);
CREATE INDEX IF NOT EXISTS idx_product_onboarding_created_at ON product_onboarding(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_onboarding_brand_model ON product_onboarding(brand, model_number);
CREATE INDEX IF NOT EXISTS idx_product_onboarding_shopify_id ON product_onboarding(shopify_product_id) WHERE shopify_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_listing_status ON inventory_items(listing_status);
CREATE INDEX IF NOT EXISTS idx_inventory_sale_price ON inventory_items(sale_price);
CREATE INDEX IF NOT EXISTS idx_inventory_updated_at ON inventory_items(updated_at DESC);

-- ============================================
-- MIGRATION 007: Price History
-- ============================================

CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  cost_price DECIMAL(10, 2),
  rrp_aud DECIMAL(10, 2),
  sale_price DECIMAL(10, 2),
  discount_percent DECIMAL(5, 4),
  change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('create', 'manual', 'auto_discount', 'bulk_update', 'import')),
  change_reason TEXT,
  changed_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_item_id ON price_history(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON price_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_item_date ON price_history(inventory_item_id, created_at DESC);

-- Price change trigger
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    OLD.cost_price IS DISTINCT FROM NEW.cost_price OR
    OLD.rrp_aud IS DISTINCT FROM NEW.rrp_aud OR
    OLD.sale_price IS DISTINCT FROM NEW.sale_price
  ) THEN
    INSERT INTO price_history (
      inventory_item_id, cost_price, rrp_aud, sale_price,
      change_type, change_reason
    ) VALUES (
      NEW.id, NEW.cost_price, NEW.rrp_aud, NEW.sale_price,
      'manual', 'Price updated'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_price_change ON inventory_items;
CREATE TRIGGER trigger_log_price_change
  AFTER UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION log_price_change();

-- Initial price trigger
CREATE OR REPLACE FUNCTION log_initial_price()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO price_history (
    inventory_item_id, cost_price, rrp_aud, sale_price,
    change_type, change_reason
  ) VALUES (
    NEW.id, NEW.cost_price, NEW.rrp_aud, NEW.sale_price,
    'create', 'Initial price set'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_initial_price ON inventory_items;
CREATE TRIGGER trigger_log_initial_price
  AFTER INSERT ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION log_initial_price();

-- ============================================
-- DONE!
-- ============================================
SELECT 'Migrations completed successfully!' as status;
