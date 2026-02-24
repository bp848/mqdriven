-- Journal Batches VIEW作成
-- 2026-02-24 作成
-- accountingスキーマのjournal_batchesをpublicスキーマから参照可能にする

-- VIEWが存在する場合は削除
DROP VIEW IF EXISTS public.v_journal_batches;

-- accountingスキーマのjournal_batchesを参照するVIEWを作成
CREATE OR REPLACE VIEW public.v_journal_batches AS
SELECT 
    id,
    batch_number,
    status,
    source_application_id,
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
CREATE INDEX IF NOT EXISTS idx_v_journal_batches_status ON public.v_journal_batches(status);
CREATE INDEX IF NOT EXISTS idx_v_journal_batches_source_app ON public.v_journal_batches(source_application_id);
CREATE INDEX IF NOT EXISTS idx_v_journal_batches_created_at ON public.v_journal_batches(created_at);

-- RLS有効化
ALTER VIEW public.v_journal_batches ENABLE ROW LEVEL SECURITY;

-- ポリシー設定（開発用：全読み取り許可）
CREATE POLICY "Enable read access for journal batches" ON public.v_journal_batches FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.v_journal_batches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON public.v_journal_batches FOR UPDATE USING (auth.role() = 'authenticated');

-- 権限付与
GRANT SELECT ON public.v_journal_batches TO authenticated;
GRANT SELECT ON public.v_journal_batches TO anon;
GRANT INSERT, UPDATE ON public.v_journal_batches TO authenticated;

COMMENT ON VIEW public.v_journal_batches IS 'Journal batches view for public schema access';
