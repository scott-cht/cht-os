-- ============================================
-- API idempotency key storage
-- Supports safe retries for expensive POST endpoints
-- ============================================

CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  state text NOT NULL CHECK (state IN ('in_progress', 'completed', 'failed')),
  status_code integer,
  response_body jsonb,
  locked_until timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_idempotency_endpoint_key
  ON api_idempotency_keys (endpoint, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_state_locked_until
  ON api_idempotency_keys (state, locked_until);

CREATE OR REPLACE FUNCTION update_api_idempotency_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_api_idempotency_updated_at ON api_idempotency_keys;
CREATE TRIGGER trigger_api_idempotency_updated_at
  BEFORE UPDATE ON api_idempotency_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_idempotency_updated_at();

ALTER TABLE api_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_idempotency_authenticated_select" ON api_idempotency_keys;
DROP POLICY IF EXISTS "api_idempotency_authenticated_insert" ON api_idempotency_keys;
DROP POLICY IF EXISTS "api_idempotency_authenticated_update" ON api_idempotency_keys;
DROP POLICY IF EXISTS "api_idempotency_authenticated_delete" ON api_idempotency_keys;

CREATE POLICY "api_idempotency_authenticated_select"
  ON api_idempotency_keys
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "api_idempotency_authenticated_insert"
  ON api_idempotency_keys
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "api_idempotency_authenticated_update"
  ON api_idempotency_keys
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "api_idempotency_authenticated_delete"
  ON api_idempotency_keys
  FOR DELETE
  USING (auth.role() = 'authenticated');
