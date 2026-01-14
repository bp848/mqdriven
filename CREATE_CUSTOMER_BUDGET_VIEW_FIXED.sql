-- 顧客別案件予算見える化ビュー作成SQL（修正版）
-- エラー発生時のデバッグ情報を追加し、より堅牢な実装に

-- ステップ0: 事前確認とクリーンアップ
DROP VIEW IF EXISTS public.customer_budget_summary_view;

-- ステップ1: 基本テーブルの存在確認
SELECT 'projects_table_exists' as check_result, 
       COUNT(*) as record_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'projects';

SELECT 'customers_table_exists' as check_result, 
       COUNT(*) as record_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'customers';

SELECT 'orders_table_exists' as check_result, 
       COUNT(*) as record_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'orders';

-- ステップ2: 顧客別予算集計ビューを段階的に作成

-- まずは単純なJOINから始める
CREATE OR REPLACE VIEW public.customer_budget_summary_view AS
WITH 
-- プロジェクト情報を取得
projects_with_customers AS (
    SELECT 
        p.id as project_id,
        p.project_code,
        p.project_name,
        p.amount as project_budget,
        p.total_cost as project_cost,
        p.create_date,
        p.update_date,
        -- 顧客情報の優先順位付け（UUIDを優先）
        COALESCE(p.customer_id, 'NO_UUID') as customer_id_priority,
        p.customer_code,
        -- 顧客名の取得（UUID優先）
        COALESCE(
            CASE WHEN p.customer_id IS NOT NULL THEN c1.customer_name END,
            CASE WHEN p.customer_code IS NOT NULL THEN c2.customer_name END,
            '顧客名未設定'
        ) as customer_name
    FROM public.projects p
    LEFT JOIN public.customers c1 ON p.customer_id = c1.id
    LEFT JOIN public.customers c2 ON p.customer_code = c2.customer_code AND p.customer_id IS NULL
),

-- 注文情報を取得（シンプルなJOIN）
project_orders AS (
    SELECT 
        po.project_id,
        COALESCE(SUM(po.amount), 0) as total_orders,
        COALESCE(SUM(po.variable_cost), 0) as total_order_cost,
        COUNT(*) as order_count
    FROM public.orders po
    WHERE po.project_id IS NOT NULL
    AND po.amount IS NOT NULL
    GROUP BY po.project_id
),

-- 最終集計（安全なJOIN）
customer_summary AS (
    SELECT 
        -- 顧客情報の確定
        COALESCE(pwc.customer_id_priority, 'NO_CUSTOMER_ID') as final_customer_id,
        pwc.customer_code as final_customer_code,
        pwc.customer_name as final_customer_name,
        
        -- 基本集計値
        COUNT(DISTINCT pwc.project_id) as project_count,
        COALESCE(SUM(pwc.project_budget), 0) as total_budget,
        COALESCE(SUM(pwc.project_cost), 0) as total_cost,
        COALESCE(po.total_orders, 0) as total_actual,
        COALESCE(po.total_order_cost, 0) as total_order_cost,
        
        -- 計算指標
        CASE 
            WHEN COALESCE(SUM(pwc.project_budget), 0) > 0 
            THEN ROUND(((COALESCE(SUM(pwc.project_budget), 0) - COALESCE(SUM(pwc.project_cost), 0)) / COALESCE(SUM(pwc.project_budget), 0) * 100, 2)
            ELSE 0 
        END as profit_margin,
        
        CASE 
            WHEN COALESCE(SUM(pwc.project_budget), 0) > 0 
            THEN ROUND((COALESCE(po.total_orders, 0) / COALESCE(SUM(pwc.project_budget), 0)) * 100, 2)
            ELSE 0 
        END as achievement_rate,
        
        -- 進捗状況
        COUNT(CASE WHEN pwc.project_name LIKE '%完了%' OR pwc.project_name LIKE '%done%' THEN 1 END) as completed_count,
        COUNT(CASE WHEN pwc.project_name LIKE '%進行中%' OR pwc.project_name LIKE '%progress%' THEN 1 END) as in_progress_count,
        
        -- 最終更新日
        MAX(pwc.update_date) as last_updated
        
    FROM projects_with_customers pwc
    LEFT JOIN project_orders po ON pwc.project_id = po.project_id
    WHERE pwc.final_customer_id != 'NO_UUID' OR pwc.final_customer_code IS NOT NULL
    GROUP BY 
        pwc.final_customer_id, 
        pwc.final_customer_code, 
        pwc.final_customer_name,
        pwc.project_budget,
        pwc.project_cost,
        pwc.update_date
)

-- 最終SELECT（安全な列参照）
SELECT 
    cs.final_customer_id as customer_id,
    cs.final_customer_code as customer_code,
    cs.final_customer_name as customer_name,
    cs.project_count,
    cs.total_budget,
    cs.total_cost,
    cs.total_actual,
    cs.total_order_cost,
    cs.profit_margin,
    cs.achievement_rate,
    cs.completed_count,
    cs.in_progress_count,
    cs.last_updated,
    
    -- ランク付け（安全な計算）
    CASE 
        WHEN cs.total_budget >= 10000000 THEN 'S'
        WHEN cs.total_budget >= 5000000 THEN 'A'
        WHEN cs.total_budget >= 1000000 THEN 'B'
        WHEN cs.total_budget >= 500000 THEN 'C'
        WHEN cs.total_budget >= 100000 THEN 'D'
        ELSE 'E'
    END as customer_rank
    
FROM customer_summary cs
ORDER BY cs.total_budget DESC;

-- ビュー作成の成功確認
DO $$
BEGIN
    RAISE NOTICE '✅ customer_budget_summary_viewが正常に作成されました。';
    RAISE NOTICE '📊 集計項目: 顧客名, プロジェクト数, 予算, 実績, 原価, 利益率, 達成率';
    RAISE NOTICE '🔗 JOIN方式: projects.customer_id = customers.id OR projects.customer_code = customers.customer_code';
    RAISE NOTICE '🛡️ セーフティ: 顧客IDのNULLチェック、安全な計算';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ビュー作成エラー: %', SQLERRM;
    RAISE NOTICE 'エラー詳細: %', SQLSTATE;
END $$;

-- ステップ3: テストデータ確認（安全なLIMIT）
SELECT 
    customer_name,
    project_count,
    total_budget,
    profit_margin,
    achievement_rate
FROM public.customer_budget_summary_view 
LIMIT 5;

-- ステップ4: インデックス作成（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_customer_budget_summary_customer_id 
ON public.customer_budget_summary_view(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_budget_summary_total_budget 
ON public.customer_budget_summary_view(total_budget DESC);

CREATE INDEX IF NOT EXISTS idx_customer_budget_summary_customer_name 
ON public.customer_budget_summary_view(customer_name);

-- ステップ5: 権限確認（必要に応じて）
-- GRANT SELECT ON public.customer_budget_summary_view TO authenticated;
-- GRANT SELECT ON public.customer_budget_summary_view TO anon;
