-- 1. Table for storing the initial discovery and scraping results
CREATE TABLE public.product_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    brand TEXT NOT NULL,
    model_number TEXT NOT NULL,
    source_url TEXT,
    
    -- Raw data storage (Source of Truth)
    raw_scraped_json JSONB,
    
    -- Processed data (For review before Shopify push)
    title TEXT,
    description_html TEXT,
    rrp_aud DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    sales_price DECIMAL(10,2),
    
    -- Meta for tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'reviewed', 'synced', 'error')),
    shopify_product_id TEXT,
    error_log TEXT,
    
    -- Soft delete (added in migration 004)
    archived BOOLEAN DEFAULT FALSE,
    
    -- Constraints for data integrity
    CONSTRAINT product_onboarding_rrp_positive CHECK (rrp_aud IS NULL OR rrp_aud >= 0),
    CONSTRAINT product_onboarding_cost_positive CHECK (cost_price IS NULL OR cost_price >= 0),
    CONSTRAINT product_onboarding_sales_positive CHECK (sales_price IS NULL OR sales_price >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_onboarding_brand ON product_onboarding(brand);
CREATE INDEX IF NOT EXISTS idx_product_onboarding_model ON product_onboarding(model_number);
CREATE INDEX IF NOT EXISTS idx_product_onboarding_status ON product_onboarding(status);
CREATE INDEX IF NOT EXISTS idx_product_onboarding_created_at ON product_onboarding(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_onboarding_brand_model ON product_onboarding(brand, model_number);
CREATE INDEX IF NOT EXISTS idx_product_onboarding_not_archived ON product_onboarding(archived) WHERE archived = FALSE;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.product_onboarding ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Only authenticated team members can see/edit data
CREATE POLICY "Allow authenticated users full access" 
ON public.product_onboarding 
FOR ALL 
TO authenticated 
USING (true);