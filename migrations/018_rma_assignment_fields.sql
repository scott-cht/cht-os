-- ============================================
-- Phase 4 hardening: RMA owner/technician assignment
-- ============================================

ALTER TABLE public.rma_cases
ADD COLUMN IF NOT EXISTS assigned_owner_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_owner_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_technician_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_technician_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rma_cases_assigned_owner_email
ON public.rma_cases(assigned_owner_email)
WHERE assigned_owner_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rma_cases_assigned_technician_email
ON public.rma_cases(assigned_technician_email)
WHERE assigned_technician_email IS NOT NULL;
