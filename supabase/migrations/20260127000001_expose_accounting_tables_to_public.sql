-- accountingスキーマのテーブルをpublicスキーマからアクセス可能にするためのVIEW作成
-- PostgRESTはデフォルトでpublicとgraphql_publicスキーマのみを公開するため、
-- accountingスキーマのテーブルにアクセスするにはpublicスキーマにVIEWを作成する必要がある

-- journal_batches VIEW
CREATE OR REPLACE VIEW public.journal_batches AS
SELECT 
    id,
    source_application_id,
    status,
    created_by,
    created_at,
    posted_at
FROM accounting.journal_batches;

COMMENT ON VIEW public.journal_batches IS 'accounting.journal_batchesへのアクセス用VIEW';

-- journal_entries VIEW
CREATE OR REPLACE VIEW public.journal_entries AS
SELECT 
    id,
    batch_id,
    entry_date,
    description,
    created_at,
    updated_at
FROM accounting.journal_entries;

COMMENT ON VIEW public.journal_entries IS 'accounting.journal_entriesへのアクセス用VIEW';

-- journal_lines VIEW (journal_entry_linesとしても参照される可能性があるため)
CREATE OR REPLACE VIEW public.journal_lines AS
SELECT 
    id,
    journal_entry_id,
    account_id,
    debit,
    credit,
    description,
    project_id,
    created_at
FROM accounting.journal_lines;

COMMENT ON VIEW public.journal_lines IS 'accounting.journal_linesへのアクセス用VIEW';

-- accounts VIEW (chart_of_accountsとしても参照される可能性があるため)
CREATE OR REPLACE VIEW public.accounts AS
SELECT 
    id,
    code,
    name,
    category_code,
    is_active,
    sort_order,
    created_at,
    updated_at,
    mq_code
FROM accounting.accounts;

COMMENT ON VIEW public.accounts IS 'accounting.accountsへのアクセス用VIEW';

-- RLSポリシーを設定（必要に応じて）
-- 認証済みユーザーにSELECT権限を付与
GRANT SELECT ON public.journal_batches TO authenticated, anon;
GRANT SELECT ON public.journal_entries TO authenticated, anon;
GRANT SELECT ON public.journal_lines TO authenticated, anon;
GRANT SELECT ON public.accounts TO authenticated, anon;

-- INSERT, UPDATE, DELETE権限も必要に応じて付与
-- ただし、VIEW経由での更新は制限があるため、RPC関数を使用することを推奨
GRANT INSERT, UPDATE, DELETE ON public.journal_batches TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.journal_lines TO authenticated;
GRANT SELECT ON public.accounts TO authenticated; -- accountsは参照専用の想定

-- PostgRESTにスキーマの変更を通知
NOTIFY pgrst, 'reload schema';
