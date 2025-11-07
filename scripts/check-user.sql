-- ninagaki@b-p.co.jp のユーザー情報を確認

-- 1. public.users テーブルを確認
SELECT 
    id,
    email,
    name,
    role,
    created_at,
    can_use_anything_analysis
FROM public.users 
WHERE email = 'ninagaki@b-p.co.jp';

-- 2. auth.users テーブルも確認
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at,
    raw_user_meta_data
FROM auth.users 
WHERE email = 'ninagaki@b-p.co.jp';

-- 3. leadsテーブルのデータ件数を確認
SELECT COUNT(*) as total_leads FROM leads;

-- 4. leadsテーブルの最新10件を確認
SELECT 
    id,
    name,
    email,
    company,
    status,
    created_at
FROM leads 
ORDER BY created_at DESC 
LIMIT 10;
