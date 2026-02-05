-- ============================================
-- OAuth Tokens Table
-- Stores access tokens from OAuth providers
-- ============================================

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,  -- 'shopify', 'hubspot', etc.
  shop VARCHAR(255) NOT NULL,      -- Store domain or account identifier
  access_token TEXT NOT NULL,
  refresh_token TEXT,              -- For providers that use refresh tokens
  scope TEXT,                      -- Granted scopes
  expires_at TIMESTAMPTZ,          -- Token expiration (if applicable)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(provider, shop)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider_shop ON oauth_tokens(provider, shop);

-- Enable RLS
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access" ON oauth_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
