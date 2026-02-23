-- 顧客別案件予算見える化ビュー作成SQL（最終修正版）
-- 構文エラーを修正し、より安全な実装に

-- ステップ0: 事前確認とクリーンアップ
DROP VIEW IF EXISTS public.customer_budget_summary_view;

-- ステップ2: 顧客別予算集計ビューを段階的に作成
CREATE OR REPLACE VIEW public.customer_budget_summary_view AS
WITH 
-- ステップ2-1: プロジェクト情報と顧客情報のJOIN
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
        -- 顧客名の取得（UUID優先、次にコード）
        COALESCE(
            CASE WHEN p.customer_id IS NOT NULL THEN c1.customer_name END,
            CASE WHEN p.customer_code IS NOT NULL THEN c2.customer_name END,
            '顧客名未設定'
        ) as customer_name
    FROM public.projects p
    LEFT JOIN public.customers c1 ON p.customer_id = c1.id
    LEFT JOIN public.customers c2 ON p.customer_code = c2.customer_code AND p.customer_id IS NULL
),

-- ステップ2-2: 注文情報の集計
project_orders AS (
    SELECT 
        po.project_id,
        SUM(CASE WHEN po.amount IS NOT NULL AND po.amount > 0 THEN po.amount ELSE 0 END) as total_orders,
        SUM(CASE WHEN po.variable_cost IS NOT NULL AND po.variable_cost > 0 THEN po.variable_cost ELSE 0 END) as total_order_cost,
        COUNT(*) as order_count,
        STRING_AGG(DISTINCT po.order_code, ',') as order_codes
    FROM public.orders po
    WHERE po.project_id IS NOT NULL
      AND po.amount IS NOT NULL
      AND po.amount > 0
    GROUP BY po.project_id
),

-- ステップ2-3: 最終集計（安全なJOIN）
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
        COALESCE(SUM(po.total_orders), 0) as total_actual,
        COALESCE(SUM(po.total_order_cost), 0) as total_order_cost,
        
        -- 計算指標 (利益率)
        CASE 
            WHEN COALESCE(SUM(pwc.project_budget), 0) = 0 THEN 0
            ELSE ROUND(((COALESCE(SUM(pwc.project_budget), 0) - COALESCE(SUM(pwc.project_cost), 0)) * 100.0 / COALESCE(SUM(pwc.project_budget), 0)), 2)
        END as profit_margin,
        
        -- 計算指標 (達成率)
        CASE 
            WHEN COALESCE(SUM(pwc.project_budget), 0) = 0 THEN 0
            ELSE ROUND((COALESCE(SUM(po.total_orders), 0) * 100.0 / COALESCE(SUM(pwc.project_budget), 0)), 2)
        END as achievement_rate,

        -- 進捗状況
        COUNT(CASE WHEN pwc.project_name LIKE '%完了%' THEN 1 END) as completed_count,
        COUNT(CASE WHEN pwc.project_name LIKE '%進行中%' THEN 1 END) as in_progress_count,
        
        -- 最終更新日
        MAX(pwc.update_date) as last_updated
        
    FROM projects_with_customers pwc
    LEFT JOIN project_orders po ON pwc.project_id = po.project_id
    WHERE pwc.final_customer_id != 'NO_CUSTOMER_ID' OR pwc.final_customer_code IS NOT NULL
    GROUP BY pwc.customer_id_priority, pwc.customer_code, pwc.customer_name
)

-- ステップ3: 最終SELECT（安全な列参照）
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
