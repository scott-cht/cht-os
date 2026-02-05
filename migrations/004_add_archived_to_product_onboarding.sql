-- Add archived column to product_onboarding for soft delete consistency
-- This aligns with the inventory_items table behavior

ALTER TABLE public.product_onboarding 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Add index for filtering archived items
CREATE INDEX IF NOT EXISTS idx_product_onboarding_archived 
ON public.product_onboarding(archived);

-- Update status check constraint to include 'archived' status
ALTER TABLE public.product_onboarding 
DROP CONSTRAINT IF EXISTS product_onboarding_status_check;

ALTER TABLE public.product_onboarding 
ADD CONSTRAINT product_onboarding_status_check 
CHECK (status IN ('pending', 'processing', 'reviewed', 'synced', 'error', 'archived'));
