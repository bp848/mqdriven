-- 即時修正：projectsテーブルに外部キー制約を追加
-- これによりPostgRESTリレーションが機能するようになる

-- ステップ1: 既存の外部キー制約を確認
SELECT 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'projects'
    AND kcu.column_name = 'customer_id';

-- ステップ2: 外部キー制約を追加（既存の場合はエラーになる）
ALTER TABLE public.projects 
ADD CONSTRAINT projects_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- ステップ3: 制約追加を確認
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'projects'
    AND kcu.column_name = 'customer_id';

-- ステップ4: リレーションが機能するかテスト
SELECT 
    p.id,
    p.project_code,
    p.customer_id,
    c.customer_name,
    c.customer_code
FROM public.projects p
LEFT JOIN public.customers c ON p.customer_id = c.id
LIMIT 5;

-- 成功メッセージ
DO $$
BEGIN
    RAISE NOTICE '✅ 外部キー制約が正常に追加されました。PostgRESTリレーションが機能するようになります。';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ エラーが発生しました: %', SQLERRM;
END $$;
$$;
