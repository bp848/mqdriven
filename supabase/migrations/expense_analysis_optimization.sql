-- =================================================================
-- 経費分析・ワークフロー最適化スクリプト
-- =================================================================
-- 目的: 経費分析とワークフロー分析のパフォーマンス向上と可視化
-- 実行: Supabase SQL Editorで実行
-- =================================================================

BEGIN;

-- =================================================================
-- 1. ワークフローイベントビュー（申請→承認→計上のトレース）
-- =================================================================

CREATE OR REPLACE VIEW accounting.v_expense_workflow_events AS
SELECT
  aw.id               AS workflow_id,
  aw.source_type,
  aw.source_id,
  aw.status           AS workflow_status,
  aw.created_at       AS workflow_created_at,
  aw.updated_at       AS workflow_updated_at,
  a.id                AS application_id,
  a.applicant_id,
  a.application_code_id,
  ac.code             AS application_code,
  ac.name             AS application_name,
  a.status            AS application_status,
  a.accounting_status,
  a.submitted_at,
  a.approved_at,
  a.rejected_at,
  a.created_at         AS application_created_at,
  je.id               AS journal_entry_id,
  je.entry_date,
  jb.id               AS journal_batch_id,
  jb.status           AS batch_status,
  jb.posted_at
FROM public.accounting_workflows aw
LEFT JOIN public.applications a ON a.id = aw.source_id AND aw.source_type = 'application'
LEFT JOIN public.application_codes ac ON ac.id = a.application_code_id
LEFT JOIN accounting.journal_entries je ON je.workflow_id = aw.id
LEFT JOIN accounting.journal_batches jb ON jb.id = je.batch_id
WHERE aw.source_type = 'application';

COMMENT ON VIEW accounting.v_expense_workflow_events IS 
'申請→承認→仕訳起票のワークフローイベントを可視化。SLA分析・ボトルネック分析に使用';

-- =================================================================
-- 2. applications テーブルのインデックス最適化
-- =================================================================

-- 時系列集計/フィルタ用
CREATE INDEX IF NOT EXISTS idx_applications_created_at 
  ON public.applications(created_at);

CREATE INDEX IF NOT EXISTS idx_applications_submitted_at 
  ON public.applications(submitted_at) 
  WHERE submitted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_applications_approved_at 
  ON public.applications(approved_at) 
  WHERE approved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_applications_rejected_at 
  ON public.applications(rejected_at) 
  WHERE rejected_at IS NOT NULL;

-- ステータス別集計用
CREATE INDEX IF NOT EXISTS idx_applications_status 
  ON public.applications(status);

-- accounting_status は既に存在する可能性があるが、念のため
CREATE INDEX IF NOT EXISTS idx_applications_accounting_status 
  ON public.applications(accounting_status);

-- 分布/ドリルダウン用
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id 
  ON public.applications(applicant_id) 
  WHERE applicant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_applications_approver_id 
  ON public.applications(approver_id) 
  WHERE approver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_applications_application_code_id 
  ON public.applications(application_code_id);

CREATE INDEX IF NOT EXISTS idx_applications_approval_route_id 
  ON public.applications(approval_route_id) 
  WHERE approval_route_id IS NOT NULL;

-- 複合インデックス（よく使われるクエリパターン）
CREATE INDEX IF NOT EXISTS idx_applications_status_created_at 
  ON public.applications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_accounting_status_approved_at 
  ON public.applications(accounting_status, approved_at DESC) 
  WHERE approved_at IS NOT NULL;

-- =================================================================
-- 3. 申請分析用ビュー（日別作成数・ステータス別件数など）
-- =================================================================

-- 日別作成数（直近30日）
CREATE OR REPLACE VIEW public.v_applications_daily_creation AS
SELECT
  date_trunc('day', created_at)::date AS date,
  COUNT(*) AS created_count,
  COUNT(DISTINCT applicant_id) AS unique_applicants
FROM public.applications
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date_trunc('day', created_at)::date
ORDER BY date DESC;

COMMENT ON VIEW public.v_applications_daily_creation IS 
'直近30日の日別申請作成数と申請者数';

-- ステータス別件数
CREATE OR REPLACE VIEW public.v_applications_by_status AS
SELECT
  status,
  COUNT(*) AS count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () AS percentage
FROM public.applications
GROUP BY status
ORDER BY count DESC;

COMMENT ON VIEW public.v_applications_by_status IS 
'ステータス別の申請件数と割合';

-- accounting_status 別件数
CREATE OR REPLACE VIEW public.v_applications_by_accounting_status AS
SELECT
  accounting_status,
  COUNT(*) AS count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () AS percentage
FROM public.applications
WHERE accounting_status IS NOT NULL
GROUP BY accounting_status
ORDER BY count DESC;

COMMENT ON VIEW public.v_applications_by_accounting_status IS 
'会計処理ステータス別の申請件数と割合';

-- 提出→承認の平均所要時間（直近90日）
CREATE OR REPLACE VIEW public.v_applications_approval_sla AS
SELECT
  date_trunc('day', submitted_at)::date AS submitted_date,
  COUNT(*) AS total_submitted,
  COUNT(approved_at) AS approved_count,
  AVG(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600) AS avg_hours_to_approval,
  AVG(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 86400) AS avg_days_to_approval,
  MIN(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600) AS min_hours_to_approval,
  MAX(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600) AS max_hours_to_approval
FROM public.applications
WHERE submitted_at >= CURRENT_DATE - INTERVAL '90 days'
  AND submitted_at IS NOT NULL
GROUP BY date_trunc('day', submitted_at)::date
ORDER BY submitted_date DESC;

COMMENT ON VIEW public.v_applications_approval_sla IS 
'提出→承認の平均所要時間（直近90日）。SLA分析用';

-- =================================================================
-- 4. データ品質チェック用ビュー
-- =================================================================

-- submitted_at と status の整合性チェック
CREATE OR REPLACE VIEW public.v_applications_data_quality AS
SELECT
  'submitted_at_mismatch' AS check_type,
  COUNT(*) AS issue_count,
  ARRAY_AGG(id::text) AS affected_ids
FROM public.applications
WHERE (status IN ('pending_approval', 'approved', 'rejected') AND submitted_at IS NULL)
   OR (status = 'draft' AND submitted_at IS NOT NULL)
UNION ALL
SELECT
  'approved_rejected_conflict' AS check_type,
  COUNT(*) AS issue_count,
  ARRAY_AGG(id::text) AS affected_ids
FROM public.applications
WHERE approved_at IS NOT NULL AND rejected_at IS NOT NULL
UNION ALL
SELECT
  'missing_updated_at_trigger' AS check_type,
  COUNT(*) AS issue_count,
  ARRAY_AGG(id::text) AS affected_ids
FROM public.applications
WHERE updated_at IS NULL OR updated_at < created_at;

COMMENT ON VIEW public.v_applications_data_quality IS 
'データ品質チェック: submitted_at/status整合性、approved_at/rejected_at相互排他、updated_atトリガ確認';

-- =================================================================
-- 5. 経費分析ビューへの batch_status 追加（既存ビューの拡張）
-- =================================================================

-- 注意: v_expense_lines が既に存在する場合、batch_status が含まれているか確認
-- 含まれていない場合は、以下のコメントを外してビューを再作成

/*
CREATE OR REPLACE VIEW accounting.v_expense_lines AS
SELECT
  jl.id                       AS journal_line_id,
  je.entry_date              AS occurred_on,
  jl.project_id,
  p.project_code,
  a.id                       AS account_id,
  a.code                     AS account_code,
  a.name                     AS account_name,
  (jl.debit - jl.credit)     AS amount,
  COALESCE(pr.id, NULL)      AS supplier_id,
  COALESCE(pr.company_name, pr.recipient_name) AS supplier_name,
  je.id                      AS journal_entry_id,
  jb.id                      AS journal_batch_id,
  jb.status                  AS batch_status,
  jb.posted_at               AS batch_posted_at,
  jl.description,
  je.description             AS entry_description
FROM accounting.journal_lines jl
JOIN accounting.journal_entries je ON je.id = jl.journal_entry_id
JOIN accounting.accounts a        ON a.id  = jl.account_id
LEFT JOIN public.projects p       ON p.id  = jl.project_id
LEFT JOIN accounting.journal_batches jb ON jb.id = je.batch_id
LEFT JOIN accounting.payables ap  ON ap.journal_line_id = jl.id
LEFT JOIN public.payment_recipients pr ON pr.id = ap.supplier_id
WHERE a.category_code = 'expense';
*/

-- =================================================================
-- 6. RLS ポリシー（分析専用ロール用・任意）
-- =================================================================

-- 分析専用ロールの作成（必要に応じて）
-- CREATE ROLE expense_analyst;
-- GRANT USAGE ON SCHEMA accounting TO expense_analyst;
-- GRANT SELECT ON accounting.v_expense_lines TO expense_analyst;
-- GRANT SELECT ON accounting.v_expense_by_month_account TO expense_analyst;
-- GRANT SELECT ON accounting.v_expense_by_month_supplier TO expense_analyst;
-- GRANT SELECT ON accounting.v_expense_by_month_project TO expense_analyst;
-- GRANT SELECT ON accounting.v_expense_workflow_events TO expense_analyst;

-- 現状は社内管理ダッシュボード想定のため、RLSは無効のまま
-- 将来的に一般ユーザー公開時は、以下を検討:
-- - API層で認可
-- - レポート用集約テーブルを分離してRLS設計

COMMIT;

-- =================================================================
-- 実行後の確認クエリ
-- =================================================================

-- ワークフローイベントビューの確認
-- SELECT * FROM accounting.v_expense_workflow_events LIMIT 10;

-- 日別作成数の確認
-- SELECT * FROM public.v_applications_daily_creation;

-- ステータス別件数の確認
-- SELECT * FROM public.v_applications_by_status;

-- 承認SLAの確認
-- SELECT * FROM public.v_applications_approval_sla;

-- データ品質チェック
-- SELECT * FROM public.v_applications_data_quality;
