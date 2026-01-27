-- Add application_id to payables_v2 to link with applications
ALTER TABLE public.payables_v2 
ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payables_v2_application ON public.payables_v2(application_id);

COMMENT ON COLUMN public.payables_v2.application_id IS '申請ID（申請から生成された買掛金の場合）';
