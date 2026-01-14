-- 顧客別案件予算見える化ビュー作成SQL
-- これにより顧客別の予算・実績・利益率が集計される

-- ステップ1: 既存ビューの確認
SELECT viewname 
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname LIKE '%budget%';

-- ステップ2: 顧客別予算集計ビューを作成
CREATE OR REPLACE VIEW public.customer_budget_summary_view AS
WITH 
-- プロジェクト別の注文集計
project_orders AS (
    SELECT 
        project_id,
        SUM(CASE WHEN amount IS NOT NULL AND amount > 0 THEN amount ELSE 0 END) as total_orders,
        SUM(CASE WHEN variable_cost IS NOT NULL AND variable_cost > 0 THEN variable_cost ELSE 0 END) as total_order_cost,
        COUNT(*) as order_count,
        STRING_AGG(DISTINCT order_code) as order_codes
    FROM public.orders
    WHERE project_id IS NOT NULL
    GROUP BY project_id
),
-- プロジェクト基本情報と顧客情報のJOIN
project_customer_summary AS (
    SELECT 
        -- 顧客情報の優先順位付け
        COALESCE(p.customer_id, 
                 CASE WHEN p.customer_code IS NOT NULL AND c.id IS NOT NULL THEN c.id
                      WHEN p.customer_code IS NOT NULL THEN NULL
                      ELSE p.customer_id
                 END) as final_customer_id,
        
        COALESCE(p.customer_code, c.customer_code) as final_customer_code,
        
        COALESCE(c.customer_name, '顧客名未設定') as final_customer_name,
        
        -- プロジェクト集計
        COUNT(p.id) as project_count,
        COALESCE(SUM(CASE WHEN p.amount IS NOT NULL AND p.amount > 0 THEN p.amount ELSE 0 END), 0) as total_budget,
        COALESCE(SUM(CASE WHEN p.total_cost IS NOT NULL AND p.total_cost > 0 THEN p.total_cost ELSE 0 END), 0) as total_cost,
        
        -- 注文集計（存在する場合）
        COALESCE(po.total_orders, 0) as total_actual,
        COALESCE(po.total_order_cost, 0) as total_order_cost,
        
        -- プロジェクトステータス集計
        COUNT(CASE WHEN p.project_status = '0' THEN 1 END) as planning_count,
        COUNT(CASE WHEN p.project_status = '8' THEN 1 END) as completed_count,
        COUNT(CASE WHEN p.project_status IN ('1','2','3','4','5','6','7') THEN 1 END) as in_progress_count
        
    FROM public.projects p
    LEFT JOIN public.customers c ON (
        -- UUIDでのJOINを優先
        p.customer_id IS NOT NULL AND p.customer_id = c.id
        OR
        -- 顧客コードでのフォールバック
        (p.customer_id IS NULL AND p.customer_code IS NOT NULL AND p.customer_code = c.customer_code)
    )
    LEFT JOIN project_orders po ON p.id = po.project_id
    GROUP BY 
        p.customer_id, 
        p.customer_code, 
        c.id,
        c.customer_code,
        c.customer_name
)

-- 最終集計結果
SELECT 
    pcs.final_customer_id as customer_id,
    pcs.final_customer_code as customer_code,
    pcs.final_customer_name as customer_name,
    
    -- 基本集計値
    pcs.project_count,
    pcs.total_budget,
    pcs.total_cost,
    pcs.total_actual,
    pcs.total_order_cost,
    
    -- 計算指標
    CASE 
        WHEN pcs.total_budget > 0 
        THEN ((pcs.total_budget - pcs.total_cost) / pcs.total_budget) * 100 
        ELSE 0 
    END as profit_margin,
    
    CASE 
        WHEN pcs.total_budget > 0 
        THEN (pcs.total_actual / pcs.total_budget) * 100 
        ELSE 0 
    END as achievement_rate,
    
    -- 進捗状況
    pcs.planning_count,
    pcs.in_progress_count,
    pcs.completed_count,
    
    -- ランク付け
    CASE 
        WHEN pcs.total_budget >= 10000000 THEN 'S'
        WHEN pcs.total_budget >= 5000000 THEN 'A'
        WHEN pcs.total_budget >= 1000000 THEN 'B'
        WHEN pcs.total_budget >= 500000 THEN 'C'
        ELSE 'D'
    END as customer_rank,
    
    -- 最終更新日
    (
        SELECT MAX(update_date) 
        FROM public.projects p2 
        WHERE (
            p2.customer_id = pcs.final_customer_id OR 
            (p2.customer_id IS NULL AND p2.customer_code = pcs.final_customer_code)
        )
    ) as last_updated
    
FROM project_customer_summary pcs
WHERE pcs.final_customer_id IS NOT NULL OR pcs.final_customer_code IS NOT NULL
ORDER BY pcs.total_budget DESC;

-- ビュー作成の確認
DO $$
BEGIN
    RAISE NOTICE '✅ customer_budget_summary_viewが正常に作成されました。';
    RAISE NOTICE '📊 集計項目: 顧客名, プロジェクト数, 予算, 実績, 原価, 利益率, 達成率';
    RAISE NOTICE '🔗 JOIN条件: projects.customer_id = customers.id OR projects.customer_code = customers.customer_code';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ビュー作成エラー: %', SQLERRM;
END $$;
$$;

-- ステップ3: ビューのテストデータ確認
SELECT 
    customer_name,
    project_count,
    total_budget,
    total_actual,
    profit_margin,
    achievement_rate
FROM public.customer_budget_summary_view 
LIMIT 5;

-- ステップ4: インデックス作成（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_customer_budget_summary_customer_id 
ON public.customer_budget_summary_view(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_budget_summary_total_budget 
ON public.customer_budget_summary_view(total_budget DESC);

-- ステップ5: 権限確認（必要に応じて）
-- GRANT SELECT ON public.customer_budget_summary_view TO authenticated;
-- GRANT SELECT ON public.customer_budget_summary_view TO anon;
