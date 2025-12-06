-- 仕訳ドラフトを承認して posted 状態にする RPC
CREATE OR REPLACE FUNCTION public.approve_journal_batch(
    p_batch_id uuid,
    p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_application_id uuid;
BEGIN
    -- 1. ドラフト状態のバッチのみ承認対象
    UPDATE accounting.journal_batches
    SET status = 'posted',
        posted_at = timezone('utc', now()),
        updated_by = p_user_id
    WHERE id = p_batch_id
      AND status = 'draft'
    RETURNING source_application_id INTO v_application_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch not found or already posted: %', p_batch_id;
    END IF;

    -- 2. 仕訳明細が存在するか最終チェック
    IF NOT EXISTS (
        SELECT 1
        FROM accounting.journal_entries je
        JOIN accounting.journal_lines jl ON jl.journal_entry_id = je.id
        WHERE je.batch_id = p_batch_id
    ) THEN
        RAISE EXCEPTION 'Batch % has no journal lines', p_batch_id;
    END IF;

    -- 3. 元の申請があれば accounting_status を posted に更新
    IF v_application_id IS NOT NULL THEN
        UPDATE public.applications
        SET accounting_status = 'posted',
            updated_by = p_user_id
        WHERE id = v_application_id;
    END IF;

    -- 4. 監査ログ用テーブルがある場合はここでINSERT
    -- INSERT INTO audit.logs (user_id, action, table_name, record_id, details)
    -- VALUES (p_user_id, 'APPROVE_JOURNAL_BATCH', 'journal_batches', p_batch_id, 
    --         jsonb_build_object('status', 'posted', 'application_id', v_application_id));
END;
$$;

COMMENT ON FUNCTION public.approve_journal_batch(uuid, uuid)
    IS '仕訳ドラフトを承認し、元の申請の accounting_status も posted に更新する';