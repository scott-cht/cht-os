-- ============================================
-- Phase 4: RMA + Serial Service Registry
-- ============================================

DO $$ BEGIN
  CREATE TYPE rma_status AS ENUM (
    'received',
    'testing',
    'sent_to_manufacturer',
    'repaired_replaced',
    'back_to_customer'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS rma_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_order_id VARCHAR(100) NOT NULL,
  shopify_order_name VARCHAR(100),
  shopify_order_number BIGINT,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  serial_number VARCHAR(255),
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  issue_summary TEXT NOT NULL,
  issue_details TEXT,
  arrival_condition_report TEXT,
  arrival_condition_grade condition_grade,
  arrival_condition_images TEXT[] NOT NULL DEFAULT '{}',
  status rma_status NOT NULL DEFAULT 'received',
  hubspot_ticket_id VARCHAR(100),
  ai_recommendation JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS serial_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number VARCHAR(255) NOT NULL UNIQUE,
  brand VARCHAR(255),
  model VARCHAR(255),
  first_seen_inventory_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ,
  sold_shopify_order_id VARCHAR(100),
  sold_at TIMESTAMPTZ,
  rma_count INTEGER NOT NULL DEFAULT 0,
  last_rma_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS serial_service_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_registry_id UUID NOT NULL REFERENCES serial_registry(id) ON DELETE CASCADE,
  rma_case_id UUID REFERENCES rma_cases(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  summary TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rma_cases_status ON rma_cases(status);
CREATE INDEX IF NOT EXISTS idx_rma_cases_order ON rma_cases(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_rma_cases_inventory_item ON rma_cases(inventory_item_id) WHERE inventory_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rma_cases_serial ON rma_cases(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rma_cases_customer_email ON rma_cases(customer_email) WHERE customer_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_serial_registry_brand_model ON serial_registry(brand, model);
CREATE INDEX IF NOT EXISTS idx_serial_service_events_registry ON serial_service_events(serial_registry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_serial_service_events_rma_case ON serial_service_events(rma_case_id) WHERE rma_case_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_rma_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_rma_cases_updated_at ON rma_cases;
CREATE TRIGGER trigger_rma_cases_updated_at
  BEFORE UPDATE ON rma_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_rma_cases_updated_at();

CREATE OR REPLACE FUNCTION update_serial_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_serial_registry_rma(p_serial_registry_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE serial_registry
  SET
    rma_count = COALESCE(rma_count, 0) + 1,
    last_rma_at = NOW(),
    updated_at = NOW()
  WHERE id = p_serial_registry_id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_serial_registry_updated_at ON serial_registry;
CREATE TRIGGER trigger_serial_registry_updated_at
  BEFORE UPDATE ON serial_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_serial_registry_updated_at();

ALTER TABLE rma_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_service_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rma_cases_select_authenticated" ON rma_cases;
DROP POLICY IF EXISTS "rma_cases_insert_authenticated" ON rma_cases;
DROP POLICY IF EXISTS "rma_cases_update_authenticated" ON rma_cases;
DROP POLICY IF EXISTS "rma_cases_delete_authenticated" ON rma_cases;

CREATE POLICY "rma_cases_select_authenticated"
  ON rma_cases
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "rma_cases_insert_authenticated"
  ON rma_cases
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "rma_cases_update_authenticated"
  ON rma_cases
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "rma_cases_delete_authenticated"
  ON rma_cases
  FOR DELETE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "serial_registry_select_authenticated" ON serial_registry;
DROP POLICY IF EXISTS "serial_registry_insert_authenticated" ON serial_registry;
DROP POLICY IF EXISTS "serial_registry_update_authenticated" ON serial_registry;
DROP POLICY IF EXISTS "serial_registry_delete_authenticated" ON serial_registry;

CREATE POLICY "serial_registry_select_authenticated"
  ON serial_registry
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "serial_registry_insert_authenticated"
  ON serial_registry
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "serial_registry_update_authenticated"
  ON serial_registry
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "serial_registry_delete_authenticated"
  ON serial_registry
  FOR DELETE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "serial_service_events_select_authenticated" ON serial_service_events;
DROP POLICY IF EXISTS "serial_service_events_insert_authenticated" ON serial_service_events;
DROP POLICY IF EXISTS "serial_service_events_update_authenticated" ON serial_service_events;
DROP POLICY IF EXISTS "serial_service_events_delete_authenticated" ON serial_service_events;

CREATE POLICY "serial_service_events_select_authenticated"
  ON serial_service_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "serial_service_events_insert_authenticated"
  ON serial_service_events
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "serial_service_events_update_authenticated"
  ON serial_service_events
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "serial_service_events_delete_authenticated"
  ON serial_service_events
  FOR DELETE
  USING (auth.role() = 'authenticated');
