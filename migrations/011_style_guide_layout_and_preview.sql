-- Add optional layout/section tagging for style guides (products, category links, etc.)

ALTER TABLE email_style_guides
  ADD COLUMN IF NOT EXISTS layout_notes text,
  ADD COLUMN IF NOT EXISTS section_tags jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN email_style_guides.layout_notes IS 'Free-form instructions for AI: where to put products, category links, CTA, etc.';
COMMENT ON COLUMN email_style_guides.section_tags IS 'Structured sections: [{"type":"products","description":"Main grid"},{"type":"category_links","description":"Footer"}]';
