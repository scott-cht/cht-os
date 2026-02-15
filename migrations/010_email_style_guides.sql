-- Phase 2: Klaviyo Marketing Engine - Style guides exported from Klaviyo for AI email copy
-- Table: email_style_guides

CREATE TABLE IF NOT EXISTS email_style_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text,
  html text NOT NULL,
  plain_text text,
  source_type text NOT NULL CHECK (source_type IN ('template', 'campaign_message')),
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_style_guides_source ON email_style_guides (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_email_style_guides_created_at ON email_style_guides (created_at DESC);

COMMENT ON TABLE email_style_guides IS 'Exported Klaviyo email/template content used as style guides for AI-generated marketing emails';
