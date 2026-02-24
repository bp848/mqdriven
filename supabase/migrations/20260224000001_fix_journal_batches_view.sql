-- Fix journal_batches VIEW with proper UUID casting
-- 2026-02-24 修正
-- PostgREST 400エラー対策：source_application_idをUUID型にキャスト

-- 既存のVIEWを削除
DROP VIEW IF EXISTS public.v_journal_batches;

-- UUID型キャスト付きでVIEWを再作成
CREATE OR REPLACE VIEW public.journal_batches AS
SELECT 
    id,
    batch_number,
    status,
    source_application_id::uuid as source_application_id,  -- UUID型に明示的にキャスト
    created_by,
    created_at,
    updated_at,
    posted_at,
    description,
    total_debit,
    total_credit,
    period_id
FROM accounting.journal_batches;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_journal_batches_status ON public.journal_batches(status);
CREATE INDEX IF NOT EXISTS idx_journal_batches_source_app ON public.journal_batches(source_application_id);
CREATE INDEX IF NOT EXISTS idx_journal_batches_created_at ON public.journal_batches(created_at);

-- RLS有効化
ALTER VIEW public.journal_batches ENABLE ROW LEVEL SECURITY;

-- ポリシー設定（開発用：全読み取り許可）
CREATE POLICY "Enable read access for journal batches" ON public.journal_batches FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.journal_batches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON public.journal_batches FOR UPDATE USING (auth.role() = 'authenticated');

-- 権限付与
GRANT SELECT ON public.journal_batches TO authenticated;
GRANT SELECT ON public.journal_batches TO anon;
GRANT INSERT, UPDATE ON public.journal_batches TO authenticated;

COMMENT ON VIEW public.journal_batches IS 'Journal batches view with UUID casting for PostgREST compatibility';
