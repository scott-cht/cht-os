-- Add explicit serial capture state for intake workflows.
ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS serial_capture_status TEXT;

UPDATE public.inventory_items
SET serial_capture_status = CASE
  WHEN serial_number IS NOT NULL AND btrim(serial_number) <> '' THEN 'captured'
  ELSE 'skipped'
END
WHERE serial_capture_status IS NULL;

ALTER TABLE public.inventory_items
ALTER COLUMN serial_capture_status SET DEFAULT 'skipped';

ALTER TABLE public.inventory_items
ALTER COLUMN serial_capture_status SET NOT NULL;

ALTER TABLE public.inventory_items
DROP CONSTRAINT IF EXISTS inventory_items_serial_capture_status_check;

ALTER TABLE public.inventory_items
ADD CONSTRAINT inventory_items_serial_capture_status_check
CHECK (serial_capture_status IN ('captured', 'not_found', 'skipped'));
