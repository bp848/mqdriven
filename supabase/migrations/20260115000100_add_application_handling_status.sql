-- Track "対応" status for approved applications (separate from accounting_status).
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS handling_status TEXT NOT NULL DEFAULT 'unhandled';

ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS handling_updated_at timestamptz;

ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS handling_updated_by uuid;

COMMENT ON COLUMN public.applications.handling_status IS '対応ステータス (unhandled: 未対応, in_progress: 対応中, done: 対応済, blocked: 保留)';
COMMENT ON COLUMN public.applications.handling_updated_at IS '対応ステータス更新日時';
COMMENT ON COLUMN public.applications.handling_updated_by IS '対応ステータス更新者 (user_id)';

CREATE INDEX IF NOT EXISTS idx_applications_handling_status
ON public.applications(handling_status);

-- Update handling status via RPC to avoid client-side RLS complexity.
CREATE OR REPLACE FUNCTION public.set_application_handling_status(
    p_application_id uuid,
    p_user_id uuid,
    p_handling_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_application_id IS NULL THEN
        RAISE EXCEPTION 'application_id is required';
    END IF;
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;
    IF p_handling_status IS NULL OR length(trim(p_handling_status)) = 0 THEN
        RAISE EXCEPTION 'handling_status is required';
    END IF;

    IF p_handling_status NOT IN ('unhandled', 'in_progress', 'done', 'blocked') THEN
        RAISE EXCEPTION 'invalid handling_status: %', p_handling_status;
    END IF;

    UPDATE public.applications
    SET
        handling_status = p_handling_status,
        handling_updated_at = now(),
        handling_updated_by = p_user_id
    WHERE id = p_application_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found: %', p_application_id;
    END IF;
END;
$$;

