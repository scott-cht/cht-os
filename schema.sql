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
    error_log TEXT
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.product_onboarding ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Only authenticated team members can see/edit data
CREATE POLICY "Allow authenticated users full access" 
ON public.product_onboarding 
FOR ALL 
TO authenticated 
USING (true);