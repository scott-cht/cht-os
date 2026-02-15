-- ============================================
-- CHT Operating System - Add pending_enrichment Status
-- Adds new enum value for pricelist import workflow
-- ============================================

-- Add pending_enrichment to listing_status enum
-- This allows items imported from pricelists to be tracked
-- until they are enriched with images and descriptions

-- PostgreSQL requires ALTER TYPE ... ADD VALUE
-- Note: Cannot be run inside a transaction in Supabase
ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'pending_enrichment' BEFORE 'on_demo';

-- Add comment for documentation
COMMENT ON TYPE listing_status IS 'pending_enrichment = needs images/description, on_demo = on display, ready_to_sell = listed for sale, sold = completed sale';
