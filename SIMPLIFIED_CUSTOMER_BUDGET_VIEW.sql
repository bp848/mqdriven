-- 顧客別案件予算見える化ビュー作成SQL（簡素化版）
-- 複雑なCASE文を避け、シンプルな構造で実装

-- ステップ0: 事前確認とクリーンアップ
DROP VIEW IF EXISTS public.customer_budget_summary_view;

-- ステップ1: 基本テーブルの存在確認
DO $$
BEGIN
    DECLARE projects_count INTEGER;
    DECLARE customers_count INTEGER;
    DECLARE orders_count INTEGER;
    
    SELECT COUNT(*) INTO projects_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'projects';
    
    SELECT COUNT(*) INTO customers_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'customers';
    
    SELECT COUNT(*) INTO orders_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'orders';
    
    RAISE NOTICE '📊 テーブル確認: projects=%, customers=%, orders=%', projects_count, customers_count, orders_count;
    
    IF projects_count < 1 OR customers_count < 1 OR orders_count < 1 THEN
        RAISE EXCEPTION '必要なテーブルが存在しません。projects=%, customers=%, orders=%', projects_count, customers_count, orders_count;
    END IF;
END $$;

-- ステップ2: シンプルなビュー作成
CREATE OR REPLACE VIEW public.customer_budget_summary_view AS
SELECT 
    -- 顧客情報の確定
    COALESCE(p.customer_id, 'NO_CUSTOMER_ID') as customer_id,
    p.customer_code,
    COALESCE(c.customer_name, '顧客名未設定') as customer_name,
    
    -- 基本集計値
    COUNT(DISTINCT p.id) as project_count,
    COALESCE(SUM(p.amount), 0) as total_budget,
    COALESCE(SUM(p.total_cost), 0) as total_cost,
    
    -- 注文情報の集計
    COALESCE(o.total_orders, 0) as total_actual,
    COALESCE(o.total_order_cost, 0) as total_order_cost,
    
    -- 利益率の計算（NULLIFを使用して0除算を回避）
    ROUND(
        NULLIF(COALESCE(SUM(p.amount), 0), 0) * 100 / 
        NULLIF(COALESCE(SUM(p.amount), 0) - COALESCE(SUM(p.total_cost), 0), 0), 2
    ) as profit_margin,
    
    -- 達成率の計算
    ROUND(
        NULLIF(COALESCE(o.total_orders, 0), 0) * 100 / 
        NULLIF(COALESCE(SUM(p.amount), 0), 0), 2
    ) as achievement_rate,
    
    -- 進捗状況
    COUNT(CASE WHEN p.project_name LIKE '%完了%' OR p.project_name LIKE '%done%' THEN 1 END) as completed_count,
    COUNT(CASE WHEN p.project_name LIKE '%進行中%' OR p.project_name LIKE '%progress%' THEN 1 END) as in_progress_count,
    
    -- 最終更新日
    MAX(p.update_date) as last_updated,
    
    -- 顧客ランク付け
    CASE 
        WHEN COALESCE(SUM(p.amount), 0) >= 10000000 THEN 'S'
        WHEN COALESCE(SUM(p.amount), 0) >= 5000000 THEN 'A'
        WHEN COALESCE(SUM(p.amount), 0) >= 1000000 THEN 'B'
        WHEN COALESCE(SUM(p.amount), 0) >= 500000 THEN 'C'
        WHEN COALESCE(SUM(p.amount), 0) >= 100000 THEN 'D'
        ELSE 'E'
    END as customer_rank
    
FROM public.projects p
LEFT JOIN public.customers c ON p.customer_id = c.id OR p.customer_code = c.customer_code
LEFT JOIN (
    SELECT 
        po.project_id,
        SUM(COALESCE(po.amount, 0)) as total_orders,
        SUM(COALESCE(po.variable_cost, 0)) as total_order_cost,
        COUNT(*) as order_count
    FROM public.orders po
    WHERE po.project_id IS NOT NULL
      AND po.amount IS NOT NULL
      AND po.amount > 0
    GROUP BY po.project_id
) o ON p.id = o.project_id
WHERE p.customer_id IS NOT NULL OR p.customer_code IS NOT NULL
GROUP BY 
    p.customer_id,
    p.customer_code,
    c.customer_name
ORDER BY total_budget DESC;

-- ビュー作成の成功確認
DO $$
BEGIN
    RAISE NOTICE '✅ customer_budget_summary_viewが正常に作成されました。';
    RAISE NOTICE '📊 集計項目: 顧客名, プロジェクト数, 予算, 実績, 原価, 利益率, 達成率';
    RAISE NOTICE '🔗 JOIN方式: projects.customer_id = customers.id OR projects.customer_code = customers.customer_code';
    RAISE NOTICE '🛡️ セーフティ: NULLIF関数による0除算の回避';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ビュー作成エラー: %', SQLERRM;
    RAISE NOTICE 'エラー詳細: %', SQLSTATE;
END $$;

-- ステップ3: テストデータ確認
SELECT 
    customer_name,
    project_count,
    total_budget,
    profit_margin,
    achievement_rate
FROM public.customer_budget_summary_view 
LIMIT 5;

-- ステップ4: インデックス作成
CREATE INDEX IF NOT EXISTS idx_customer_budget_summary_customer_id 
ON public.customer_budget_summary_view(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_budget_summary_total_budget 
ON public.customer_budget_summary_view(total_budget DESC);

CREATE INDEX IF NOT EXISTS idx_customer_budget_summary_customer_name 
ON public.customer_budget_summary_view(customer_name);

-- ステップ5: 権限確認（必要に応じて）
-- GRANT SELECT ON public.customer_budget_summary_view TO authenticated;
-- GRANT SELECT ON public.customer_budget_summary_view TO anon;
