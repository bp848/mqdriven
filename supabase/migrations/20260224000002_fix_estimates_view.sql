-- Fix estimates_list_view for PostgREST embedding compatibility
-- 2026-02-24 修正
-- PostgREST 400エラー対策：customersとのJOINを物理FKベースに変更

-- 既存のVIEWを削除
DROP VIEW IF EXISTS public.estimates_list_view;

-- 単純化したVIEWを再作成（JOINなし）
CREATE OR REPLACE VIEW public.estimates_list_view AS
WITH detail_costs AS (
    SELECT
        NULLIF(TRIM(ed.estimate_id::text), '') as estimate_business_id,
        COUNT(*) as detail_count,
        SUM(
            CASE
                WHEN REGEXP_REPLACE(TRIM(ed.variable_cost::text), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
                    THEN REGEXP_REPLACE(TRIM(ed.variable_cost::text), '[^0-9\\.-]', '', 'g')::NUMERIC
            END
        ) as detail_variable_cost_num,
        SUM(
            CASE
                WHEN REGEXP_REPLACE(TRIM(ed.quantity::text), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
                     AND REGEXP_REPLACE(TRIM(ed.unit_price::text), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
                THEN REGEXP_REPLACE(TRIM(ed.quantity::text), '[^0-9\\.-]', '', 'g')::NUMERIC
                     * REGEXP_REPLACE(TRIM(ed.unit_price::text), '[^0-9\\.-]', '', 'g')::NUMERIC
            END
        ) as detail_sales_amount_num
    FROM public.estimate_details ed
    GROUP BY NULLIF(TRIM(ed.estimate_id::text), '')
),
cleaned AS (
    SELECT
        e.*,
        dc.detail_variable_cost_num,
        dc.detail_sales_amount_num,
        dc.detail_count,
        p.project_name as project_name_joined,
        p.customer_id as project_customer_id,
        cust.customer_name as customer_name_joined,
        CASE
            WHEN REGEXP_REPLACE(TRIM(e.copies::text), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
                THEN REGEXP_REPLACE(TRIM(e.copies::text), '[^0-9\\.-]', '', 'g')::NUMERIC
        END as copies_num,
        CASE
            WHEN REGEXP_REPLACE(TRIM(e.unit_price::text), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
                THEN REGEXP_REPLACE(TRIM(e.unit_price::text), '[^0-9\\.-]', '', 'g')::NUMERIC
        END as unit_price_num,
        CASE
            WHEN REGEXP_REPLACE(TRIM(e.subtotal::text), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
                THEN REGEXP_REPLACE(TRIM(e.subtotal::text), '[^0-9\\.-]', '', 'g')::NUMERIC
        END as subtotal_num,
        CASE
            WHEN REGEXP_REPLACE(TRIM(e.total::text), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
                THEN REGEXP_REPLACE(TRIM(e.total::text), '[^0-9\\.-]', '', 'g')::NUMERIC
        END as total_num,
        CASE
            WHEN REGEXP_REPLACE(TRIM(e.total::text), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
                THEN REGEXP_REPLACE(TRIM(e.total::text), '[^0-9\\.-]', '', 'g')::NUMERIC
        END as total_num_clean
    FROM public.estimates_v2 e
    LEFT JOIN detail_costs dc ON dc.estimate_business_id = e.id
    LEFT JOIN public.projects_v2 p ON p.id = e.project_id
    LEFT JOIN public.customers_v2 cust ON cust.id = p.customer_id
),
final AS (
    SELECT
        c.*,
        c.detail_variable_cost_num as variable_cost_amount,
        c.detail_sales_amount_num as sales_amount,
        CASE
            WHEN c.subtotal_num IS NOT NULL AND c.subtotal_num > 0
                THEN c.detail_variable_cost_num / NULLIF(c.subtotal_num, 0)
            WHEN c.total_num_clean IS NOT NULL AND c.total_num_clean > 0
                THEN c.detail_variable_cost_num / NULLIF(c.total_num_clean, 0)
            ELSE NULL
        END as mq_rate,
        CASE
            WHEN c.detail_count = 0 THEN 'A'
            WHEN c.detail_variable_cost_num IS NULL THEN 'B'
            WHEN c.detail_variable_cost_num = 0 AND c.detail_sales_amount_num > 0 THEN 'C'
            ELSE NULL
        END as mq_missing_reason,
        c.project_name_joined as project_name,
        c.customer_name_joined as customer_name,
        c.project_customer_id as customer_id,
        c.detail_count,
        c.total_num_clean as total,
        c.created_at::timestamptz as created_at  -- timestamptz型に明示的にキャスト
    FROM cleaned c
)
SELECT
    id,
    project_id,
    estimate_code,
    estimate_title,
    customer_name,
    project_name,
    status,
    delivery_date,
    subtotal,
    total,
    variable_cost_amount,
    sales_amount,
    mq_rate,
    mq_missing_reason,
    detail_count,
    customer_id,
    created_at,
    updated_at
FROM final
WHERE status IS NOT NULL;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_estimates_list_view_status ON public.estimates_list_view(status);
CREATE INDEX IF NOT EXISTS idx_estimates_list_view_project_id ON public.estimates_list_view(project_id);
CREATE INDEX IF NOT EXISTS idx_estimates_list_view_customer_id ON public.estimates_list_view(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_list_view_created_at ON public.estimates_list_view(created_at);

-- RLS有効化
ALTER VIEW public.estimates_list_view ENABLE ROW LEVEL SECURITY;

-- ポリシー設定（開発用：全読み取り許可）
CREATE POLICY "Enable read access for estimates list" ON public.estimates_list_view FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.estimates_list_view FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON public.estimates_list_view FOR UPDATE USING (auth.role() = 'authenticated');

-- 権限付与
GRANT SELECT ON public.estimates_list_view TO authenticated;
GRANT SELECT ON public.estimates_list_view TO anon;
GRANT INSERT, UPDATE ON public.estimates_list_view TO authenticated;

COMMENT ON VIEW public.estimates_list_view IS 'Estimates list view simplified for PostgREST compatibility (no embedded joins)';
