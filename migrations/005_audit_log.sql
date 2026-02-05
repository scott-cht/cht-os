-- Audit Log Table for tracking inventory changes
-- Records all significant actions for compliance and debugging

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- What was changed
  entity_type VARCHAR(50) NOT NULL, -- 'inventory_item', 'product_onboarding', 'sync', etc.
  entity_id UUID NOT NULL,
  
  -- What happened
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'sync', 'archive', etc.
  
  -- Who did it (nullable for system actions)
  user_id UUID REFERENCES auth.users(id),
  user_email VARCHAR(255),
  
  -- Change details
  changes JSONB, -- { field: { old: value, new: value } }
  metadata JSONB, -- Additional context (IP, user agent, etc.)
  
  -- Quick access fields
  summary TEXT -- Human-readable summary of the action
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Service role full access" ON audit_log
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Read-only for authenticated users
CREATE POLICY "Authenticated users can view audit log" ON audit_log
  FOR SELECT TO authenticated
  USING (true);

-- Function to automatically log changes
CREATE OR REPLACE FUNCTION log_inventory_changes()
RETURNS TRIGGER AS $$
DECLARE
  changes_json JSONB := '{}';
  col_name TEXT;
  old_val TEXT;
  new_val TEXT;
BEGIN
  -- Only log UPDATE actions with this trigger
  IF TG_OP = 'UPDATE' THEN
    -- Compare each column and record changes
    FOR col_name IN 
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = TG_TABLE_NAME 
      AND table_schema = TG_TABLE_SCHEMA
    LOOP
      EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', col_name, col_name)
        INTO old_val, new_val
        USING OLD, NEW;
      
      IF old_val IS DISTINCT FROM new_val THEN
        changes_json := changes_json || jsonb_build_object(
          col_name, jsonb_build_object('old', old_val, 'new', new_val)
        );
      END IF;
    END LOOP;

    -- Only insert if there were actual changes
    IF changes_json != '{}' THEN
      INSERT INTO audit_log (entity_type, entity_id, action, changes, summary)
      VALUES (
        'inventory_item',
        NEW.id,
        'update',
        changes_json,
        'Updated ' || (SELECT count(*) FROM jsonb_object_keys(changes_json)) || ' field(s)'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to inventory_items table
DROP TRIGGER IF EXISTS inventory_items_audit_trigger ON inventory_items;
CREATE TRIGGER inventory_items_audit_trigger
  AFTER UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION log_inventory_changes();
