-- ============================================
-- Phase 4 hardening: RMA ops enrichment
-- ============================================

ALTER TABLE public.rma_cases
ADD COLUMN IF NOT EXISTS customer_first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_last_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_company VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_contact_preference TEXT,
ADD COLUMN IF NOT EXISTS customer_address_json JSONB,
ADD COLUMN IF NOT EXISTS shopify_customer_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS order_processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS order_financial_status VARCHAR(80),
ADD COLUMN IF NOT EXISTS order_fulfillment_status VARCHAR(80),
ADD COLUMN IF NOT EXISTS order_currency VARCHAR(8),
ADD COLUMN IF NOT EXISTS order_total_amount NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS order_line_items_json JSONB,
ADD COLUMN IF NOT EXISTS warranty_status TEXT,
ADD COLUMN IF NOT EXISTS warranty_basis TEXT,
ADD COLUMN IF NOT EXISTS warranty_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS warranty_decision_notes TEXT,
ADD COLUMN IF NOT EXISTS warranty_checked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS inbound_carrier VARCHAR(120),
ADD COLUMN IF NOT EXISTS inbound_tracking_number VARCHAR(200),
ADD COLUMN IF NOT EXISTS inbound_tracking_url TEXT,
ADD COLUMN IF NOT EXISTS inbound_status VARCHAR(80),
ADD COLUMN IF NOT EXISTS outbound_carrier VARCHAR(120),
ADD COLUMN IF NOT EXISTS outbound_tracking_number VARCHAR(200),
ADD COLUMN IF NOT EXISTS outbound_tracking_url TEXT,
ADD COLUMN IF NOT EXISTS outbound_status VARCHAR(80),
ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shipped_back_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_back_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS return_label_url TEXT,
ADD COLUMN IF NOT EXISTS proof_of_delivery_url TEXT,
ADD COLUMN IF NOT EXISTS disposition TEXT,
ADD COLUMN IF NOT EXISTS disposition_reason TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT,
ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;

UPDATE public.rma_cases
SET
  customer_contact_preference = COALESCE(customer_contact_preference, 'unknown'),
  warranty_status = COALESCE(warranty_status, 'unknown'),
  warranty_basis = COALESCE(warranty_basis, 'unknown'),
  priority = COALESCE(priority, 'normal')
WHERE
  customer_contact_preference IS NULL
  OR warranty_status IS NULL
  OR warranty_basis IS NULL
  OR priority IS NULL;

ALTER TABLE public.rma_cases
ALTER COLUMN customer_contact_preference SET DEFAULT 'unknown';

ALTER TABLE public.rma_cases
ALTER COLUMN warranty_status SET DEFAULT 'unknown';

ALTER TABLE public.rma_cases
ALTER COLUMN warranty_basis SET DEFAULT 'unknown';

ALTER TABLE public.rma_cases
ALTER COLUMN priority SET DEFAULT 'normal';

ALTER TABLE public.rma_cases
ALTER COLUMN customer_contact_preference SET NOT NULL;

ALTER TABLE public.rma_cases
ALTER COLUMN warranty_status SET NOT NULL;

ALTER TABLE public.rma_cases
ALTER COLUMN warranty_basis SET NOT NULL;

ALTER TABLE public.rma_cases
ALTER COLUMN priority SET NOT NULL;

ALTER TABLE public.rma_cases
DROP CONSTRAINT IF EXISTS rma_cases_customer_contact_preference_check;

ALTER TABLE public.rma_cases
ADD CONSTRAINT rma_cases_customer_contact_preference_check
CHECK (customer_contact_preference IN ('email', 'phone', 'sms', 'unknown'));

ALTER TABLE public.rma_cases
DROP CONSTRAINT IF EXISTS rma_cases_warranty_status_check;

ALTER TABLE public.rma_cases
ADD CONSTRAINT rma_cases_warranty_status_check
CHECK (warranty_status IN ('in_warranty', 'out_of_warranty', 'unknown'));

ALTER TABLE public.rma_cases
DROP CONSTRAINT IF EXISTS rma_cases_warranty_basis_check;

ALTER TABLE public.rma_cases
ADD CONSTRAINT rma_cases_warranty_basis_check
CHECK (warranty_basis IN ('manufacturer', 'extended', 'acl', 'manual_override', 'unknown'));

ALTER TABLE public.rma_cases
DROP CONSTRAINT IF EXISTS rma_cases_disposition_check;

ALTER TABLE public.rma_cases
ADD CONSTRAINT rma_cases_disposition_check
CHECK (disposition IS NULL OR disposition IN ('repair', 'replace', 'refund', 'reject', 'monitor'));

ALTER TABLE public.rma_cases
DROP CONSTRAINT IF EXISTS rma_cases_priority_check;

ALTER TABLE public.rma_cases
ADD CONSTRAINT rma_cases_priority_check
CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_rma_cases_warranty_status ON public.rma_cases(warranty_status);
CREATE INDEX IF NOT EXISTS idx_rma_cases_priority ON public.rma_cases(priority);
CREATE INDEX IF NOT EXISTS idx_rma_cases_sla_due_at ON public.rma_cases(sla_due_at) WHERE sla_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rma_cases_shopify_customer_id ON public.rma_cases(shopify_customer_id) WHERE shopify_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rma_cases_inbound_tracking ON public.rma_cases(inbound_tracking_number) WHERE inbound_tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rma_cases_outbound_tracking ON public.rma_cases(outbound_tracking_number) WHERE outbound_tracking_number IS NOT NULL;
