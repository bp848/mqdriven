-- 承認済みなのに会計pendingの不整合を修正する暫定バッチ
-- 安全のため、承認後1日以上経過したもののみ更新

-- 1. 事前確認クエリ（影響件数の確認）
-- 実行前にこのクエリで件数を確認してください
/*
SELECT 
    COUNT(*) AS target_count,
    MIN(approved_at) AS oldest_approved,
    MAX(approved_at) AS newest_approved,
    AVG(EXTRACT(EPOCH FROM (now() - approved_at))/86400.0) AS avg_days_since_approved
FROM public.applications
WHERE status = 'approved' 
  AND accounting_status = 'pending'
  AND approved_at IS NOT NULL
  AND approved_at <= now() - interval '1 day';
*/

-- 2. 暫定バッチ更新（承認後1日以上経過したもののみ）
-- 安全のため、一律 'none' に補正（仕訳生成判定は後で必要に応じて追加可能）
-- 注意: 'pending'は本来存在しない値だが、データ不整合で存在している
UPDATE public.applications
SET 
    accounting_status = 'none',
    updated_at = now()
WHERE status = 'approved' 
  AND accounting_status = 'pending'
  AND approved_at IS NOT NULL
  AND approved_at <= now() - interval '1 day';

-- 3. 更新結果の確認クエリ
-- 実行後にこのクエリで結果を確認してください
/*
SELECT 
    accounting_status,
    COUNT(*) AS count,
    MIN(approved_at) AS oldest_approved,
    MAX(approved_at) AS newest_approved
FROM public.applications
WHERE status = 'approved'
  AND approved_at IS NOT NULL
GROUP BY accounting_status
ORDER BY accounting_status;
*/
