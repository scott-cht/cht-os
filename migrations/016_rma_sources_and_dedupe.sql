-- ============================================
-- Phase 4 rollout: RMA ingestion sources + dedupe
-- ============================================

ALTER TABLE public.rma_cases
ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE public.rma_cases
ADD COLUMN IF NOT EXISTS submission_channel TEXT;

ALTER TABLE public.rma_cases
ADD COLUMN IF NOT EXISTS shopify_return_id VARCHAR(100);

ALTER TABLE public.rma_cases
ADD COLUMN IF NOT EXISTS external_reference VARCHAR(150);

ALTER TABLE public.rma_cases
ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

UPDATE public.rma_cases
SET
  source = COALESCE(source, 'manual'),
  submission_channel = COALESCE(submission_channel, 'internal_dashboard')
WHERE source IS NULL OR submission_channel IS NULL;

ALTER TABLE public.rma_cases
ALTER COLUMN source SET DEFAULT 'manual';

ALTER TABLE public.rma_cases
ALTER COLUMN submission_channel SET DEFAULT 'internal_dashboard';

ALTER TABLE public.rma_cases
ALTER COLUMN source SET NOT NULL;

ALTER TABLE public.rma_cases
ALTER COLUMN submission_channel SET NOT NULL;

ALTER TABLE public.rma_cases
DROP CONSTRAINT IF EXISTS rma_cases_source_check;

ALTER TABLE public.rma_cases
ADD CONSTRAINT rma_cases_source_check
CHECK (source IN ('manual', 'shopify_return_webhook', 'customer_form'));

ALTER TABLE public.rma_cases
DROP CONSTRAINT IF EXISTS rma_cases_submission_channel_check;

ALTER TABLE public.rma_cases
ADD CONSTRAINT rma_cases_submission_channel_check
CHECK (submission_channel IN ('internal_dashboard', 'shopify_webhook', 'customer_portal'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_rma_cases_shopify_return_id_unique
ON public.rma_cases (shopify_return_id)
WHERE shopify_return_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rma_cases_dedupe_key_unique
ON public.rma_cases (dedupe_key)
WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rma_cases_source ON public.rma_cases(source);
CREATE INDEX IF NOT EXISTS idx_rma_cases_submission_channel ON public.rma_cases(submission_channel);
