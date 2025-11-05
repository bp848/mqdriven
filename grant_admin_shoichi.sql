-- shoichi@b-p.co.jp に管理者権限を付与
-- Supabase SQL Editor で実行してください

-- usersテーブルのroleを更新
UPDATE users
SET role = 'admin'
WHERE email = 'shoichi@b-p.co.jp';

-- employeesテーブルも存在する場合は更新
UPDATE employees
SET role = 'admin'
WHERE email = 'shoichi@b-p.co.jp';

-- 確認クエリ
SELECT id, name, email, role, created_at
FROM users
WHERE email = 'shoichi@b-p.co.jp';
