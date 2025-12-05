-- supabase/rpc_approve_journal_batch.sql

CREATE OR REPLACE FUNCTION public.approve_journal_batch(
    p_batch_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE accounting.journal_batches
    SET
        status = 'posted',
        posted_at = timezone('utc', now())
    WHERE
        id = p_batch_id
        AND status = 'draft';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Draft batch not found or already posted: %', p_batch_id;
    END IF;

    -- 元の申請テーブルのステータスも更新
    UPDATE public.applications
    SET accounting_status = 'posted'
    WHERE id = (
        SELECT source_application_id
        FROM accounting.journal_batches
        WHERE id = p_batch_id
    );
END;
$$;