-- applicationsテーブルに会計ステータスカラムを追加
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS accounting_status TEXT NOT NULL DEFAULT 'none';

COMMENT ON COLUMN public.applications.accounting_status IS '会計処理ステータス (none: 未処理, drafted: 仕訳作成済, posted: 転記済)';

-- パフォーマンス向上のためにインデックスを作成
CREATE INDEX IF NOT EXISTS idx_applications_accounting_status
ON public.applications(accounting_status);