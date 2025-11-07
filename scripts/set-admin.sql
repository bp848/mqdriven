-- ninagaki@b-p.co.jp を管理者に設定

-- まず、ユーザーが存在するか確認
SELECT * FROM public.users WHERE email = 'ninagaki@b-p.co.jp';

-- ユーザーが存在する場合、管理者に設定
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'ninagaki@b-p.co.jp';

-- ユーザーが存在しない場合、新規作成（auth.usersに既に存在する場合）
-- まず auth.users から ID を取得
-- INSERT INTO public.users (id, email, name, role)
-- SELECT id, email, raw_user_meta_data->>'name', 'admin'
-- FROM auth.users
-- WHERE email = 'ninagaki@b-p.co.jp'
-- ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- 確認
SELECT id, email, name, role, created_at 
FROM public.users 
WHERE email = 'ninagaki@b-p.co.jp';
