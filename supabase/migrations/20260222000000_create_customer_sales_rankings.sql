-- 顧客売上ランキングテーブル
-- 2026-02-22 作成

CREATE TABLE IF NOT EXISTS public.customer_sales_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_period_id UUID NOT NULL,
    rank INTEGER NOT NULL,
    customer_name_raw TEXT NOT NULL,
    sales_rep_name_raw TEXT,
    department_name_raw TEXT,
    period_type TEXT NOT NULL, -- '今期' or '前期'
    month_06 NUMERIC DEFAULT 0,
    month_07 NUMERIC DEFAULT 0,
    month_08 NUMERIC DEFAULT 0,
    month_09 NUMERIC DEFAULT 0,
    month_10 NUMERIC DEFAULT 0,
    month_11 NUMERIC DEFAULT 0,
    month_12 NUMERIC DEFAULT 0,
    month_01 NUMERIC DEFAULT 0,
    month_02 NUMERIC DEFAULT 0,
    month_03 NUMERIC DEFAULT 0,
    month_04 NUMERIC DEFAULT 0,
    month_05 NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    source_file TEXT,
    doc_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_customer_sales_rankings_fiscal_period ON public.customer_sales_rankings(fiscal_period_id);
CREATE INDEX IF NOT EXISTS idx_customer_sales_rankings_period_type ON public.customer_sales_rankings(period_type);
CREATE INDEX IF NOT EXISTS idx_customer_sales_rankings_customer_name ON public.customer_sales_rankings(customer_name_raw);
CREATE INDEX IF NOT EXISTS idx_customer_sales_rankings_rank ON public.customer_sales_rankings(rank);

-- RLS有効化
ALTER TABLE public.customer_sales_rankings ENABLE ROW LEVEL SECURITY;

-- ポリシー設定（開発用：全読み取り許可）
CREATE POLICY "Enable read access for all users" ON public.customer_sales_rankings FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.customer_sales_rankings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.customer_sales_rankings FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.customer_sales_rankings FOR DELETE USING (auth.role() = 'authenticated');

-- VIEW作成：顧客売上ランキング集計用
CREATE OR REPLACE VIEW public.v_customer_sales_rankings AS
SELECT 
    id,
    fiscal_period_id,
    rank,
    customer_name_raw,
    sales_rep_name_raw,
    department_name_raw,
    period_type,
    month_06,
    month_07,
    month_08,
    month_09,
    month_10,
    month_11,
    month_12,
    month_01,
    month_02,
    month_03,
    month_04,
    month_05,
    total,
    source_file,
    created_at,
    updated_at
FROM public.customer_sales_rankings
ORDER BY fiscal_period_id, period_type, rank;
