-- Migration: Add price history tracking
-- Purpose: Track price changes over time for analysis and audit

-- Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  
  -- Price fields at time of change
  cost_price DECIMAL(10, 2),
  rrp_aud DECIMAL(10, 2),
  sale_price DECIMAL(10, 2),
  discount_percent DECIMAL(5, 4),
  
  -- Change metadata
  change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('create', 'manual', 'auto_discount', 'bulk_update', 'import')),
  change_reason TEXT,
  changed_by VARCHAR(255), -- User identifier if available
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_price_history_item_id ON price_history(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON price_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_item_date ON price_history(inventory_item_id, created_at DESC);

-- Function to automatically log price changes
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if price-related fields changed
  IF (
    OLD.cost_price IS DISTINCT FROM NEW.cost_price OR
    OLD.rrp_aud IS DISTINCT FROM NEW.rrp_aud OR
    OLD.sale_price IS DISTINCT FROM NEW.sale_price OR
    OLD.discount_percent IS DISTINCT FROM NEW.discount_percent
  ) THEN
    INSERT INTO price_history (
      inventory_item_id,
      cost_price,
      rrp_aud,
      sale_price,
      discount_percent,
      change_type,
      change_reason
    ) VALUES (
      NEW.id,
      NEW.cost_price,
      NEW.rrp_aud,
      NEW.sale_price,
      NEW.discount_percent,
      'manual',
      'Price updated'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic price history logging
DROP TRIGGER IF EXISTS trigger_log_price_change ON inventory_items;
CREATE TRIGGER trigger_log_price_change
  AFTER UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION log_price_change();

-- Function to log initial price on item creation
CREATE OR REPLACE FUNCTION log_initial_price()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO price_history (
    inventory_item_id,
    cost_price,
    rrp_aud,
    sale_price,
    discount_percent,
    change_type,
    change_reason
  ) VALUES (
    NEW.id,
    NEW.cost_price,
    NEW.rrp_aud,
    NEW.sale_price,
    NEW.discount_percent,
    'create',
    'Initial price set'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for initial price logging
DROP TRIGGER IF EXISTS trigger_log_initial_price ON inventory_items;
CREATE TRIGGER trigger_log_initial_price
  AFTER INSERT ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION log_initial_price();

-- Add comment for documentation
COMMENT ON TABLE price_history IS 'Tracks all price changes for inventory items over time';
COMMENT ON COLUMN price_history.change_type IS 'Type of price change: create, manual, auto_discount, bulk_update, import';
