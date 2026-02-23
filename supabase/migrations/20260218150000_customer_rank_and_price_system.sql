-- 顧客ランク・価格表システム用マイグレーション
-- 2026-02-18 作成

-- 1. 顧客ランク定義テーブル (customer_ranks)
CREATE TABLE IF NOT EXISTS public.customer_ranks (
    id TEXT PRIMARY KEY, -- 'S', 'A', 'B', 'C', etc.
    name TEXT NOT NULL,
    default_markup NUMERIC DEFAULT 30, -- パーセント (例: 30 = 30%)
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 初期データの投入
INSERT INTO public.customer_ranks (id, name, default_markup, description) VALUES
('S', 'VIP顧客', 15, '特別優遇顧客 (薄利多売OK)'),
('A', '優良顧客', 20, '継続的な取引がある顧客'),
('B', '一般顧客', 30, '通常設定'),
('C', '新規/小口', 40, 'リスクヘッジ設定'),
('D', '要注意', 50, '未回収リスク等あり')
ON CONFLICT (id) DO NOTHING;

-- 2. 商品マスタテーブル (products)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT, -- 'business_card', 'flyer', 'booklet', etc.
    standard_price NUMERIC, -- 基本販売価格 (税抜)
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. 価格表テーブル (price_lists)
CREATE TABLE IF NOT EXISTS public.price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    rank_id TEXT REFERENCES public.customer_ranks(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    price NUMERIC NOT NULL, -- 適用単価
    currency TEXT DEFAULT 'JPY',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    -- 制約: rank_id か customer_id のどちらかは必須、かつ両方設定はNG推奨（優先順位混乱防止のため）
    CONSTRAINT price_list_target_check CHECK (
        (rank_id IS NOT NULL AND customer_id IS NULL) OR 
        (rank_id IS NULL AND customer_id IS NOT NULL)
    ),
    -- ユニーク制約: 同じ商品に対して、同じランク/顧客で重複しない
    CONSTRAINT price_list_unique_rank UNIQUE (product_id, rank_id),
    CONSTRAINT price_list_unique_customer UNIQUE (product_id, customer_id)
);

-- 4. 顧客テーブルへのランク紐付け (既存テーブル更新)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'rank_id') THEN
        ALTER TABLE public.customers ADD COLUMN rank_id TEXT REFERENCES public.customer_ranks(id);
    END IF;
END $$;

-- RLSポリシーの適用 (安全のためpublicアクセス許可)
ALTER TABLE public.customer_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを参考にとりあえず全開放 (開発用)
CREATE POLICY "Enable read access for all users" ON public.customer_ranks FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.customer_ranks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.customer_ranks FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON public.products FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.products FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON public.price_lists FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.price_lists FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.price_lists FOR UPDATE USING (auth.role() = 'authenticated');
