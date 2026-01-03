-- サンプルデータ投入スクリプト
-- 見積もり管理、予算管理、プロジェクト管理のテストデータ

-- 1. 取引先データ
INSERT INTO customers (id, name, contact_person, email, phone, address, created_at, updated_at)
VALUES
  (gen_random_uuid(), '株式会社ABC商事', '田中太郎', 'tanaka@abc-shoji.jp', '03-1234-5678', '東京都千代田区丸の内1-2-3', now(), now()),
  (gen_random_uuid(), 'XYZ株式会社', '鈴木花子', 'suzuki@xyz-corp.jp', '03-9876-5432', '東京都港区虎ノ門4-5-6', now(), now()),
  (gen_random_uuid(), '有限会社DEF', '佐藤次郎', 'sato@def-ltd.co.jp', '03-5555-7777', '東京都新宿区西新宿8-9-10', now(), now())
ON CONFLICT DO NOTHING;

-- 2. プロジェクトデータ
INSERT INTO projects (
  id, project_code, project_name, customer_id, customer_code, 
  project_status, classification_id, sales_user_id, 
  created_at, updated_at
)
SELECT 
  gen_random_uuid(), 
  'P2025-001', 
  'ABC商事 パンフレット印刷', 
  c.id, 
  'C001',
  '進行中',
  'CLS001',
  'USR001',
  now(), 
  now()
FROM customers c WHERE c.name = '株式会社ABC商事' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO projects (
  id, project_code, project_name, customer_id, customer_code, 
  project_status, classification_id, sales_user_id, 
  created_at, updated_at
)
SELECT 
  gen_random_uuid(), 
  'P2025-002', 
  'XYZ株式会社 年報印刷', 
  c.id, 
  'C002',
  '進行中',
  'CLS001',
  'USR002',
  now(), 
  now()
FROM customers c WHERE c.name = 'XYZ株式会社' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO projects (
  id, project_code, project_name, customer_id, customer_code, 
  project_status, classification_id, sales_user_id, 
  created_at, updated_at
)
SELECT 
  gen_random_uuid(), 
  'P2025-003', 
  '有限会社DEF カタログ制作', 
  c.id, 
  'C003',
  '完了',
  'CLS002',
  'USR001',
  now(), 
  now()
FROM customers c WHERE c.name = '有限会社DEF' LIMIT 1
ON CONFLICT DO NOTHING;

-- 3. 見積もりデータ
INSERT INTO estimates (
  id, estimate_number, title, customer_name, project_id, pattern_no,
  subtotal, tax_rate, consumption, total, grand_total,
  status, delivery_date, expiration_date, notes,
  user_id, created_at, updated_at
)
SELECT 
  gen_random_uuid(),
  2025001,
  'パンフレット印刷見積もり',
  c.name,
  p.id,
  'V1',
  500000,
  10,
  50000,
  550000,
  550000,
  '見積中',
  '2025-02-15',
  '2025-02-28',
  'A4サイズ、フルカラー、1000部',
  'USR001',
  now(),
  now()
FROM customers c, projects p 
WHERE c.name = '株式会社ABC商事' AND p.project_code = 'P2025-001'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO estimates (
  id, estimate_number, title, customer_name, project_id, pattern_no,
  subtotal, tax_rate, consumption, total, grand_total,
  status, delivery_date, expiration_date, notes,
  user_id, created_at, updated_at
)
SELECT 
  gen_random_uuid(),
  2025002,
  '年報印刷見積もり',
  c.name,
  p.id,
  'V1',
  800000,
  10,
  80000,
  880000,
  880000,
  '受注',
  '2025-03-01',
  '2025-03-15',
  'B5サイズ、モノカラー、500部',
  'USR002',
  now(),
  now()
FROM customers c, projects p 
WHERE c.name = 'XYZ株式会社' AND p.project_code = 'P2025-002'
LIMIT 1
ON CONFLICT DO NOTHING;

-- 4. 受注データ（ordersテーブル）
INSERT INTO orders (
  id, client_custmer, project_code, order_date, quantity, amount, subamount, total_cost,
  approval_status1, created_at, updated_at
)
VALUES
  (gen_random_uuid(), '株式会社ABC商事', 'P2025-001', '2025-01-15', 1000, 550000, 500000, 350000, '発注済', now(), now()),
  (gen_random_uuid(), 'XYZ株式会社', 'P2025-002', '2025-01-20', 500, 880000, 800000, 600000, '発注済', now(), now()),
  (gen_random_uuid(), '有限会社DEF', 'P2025-003', '2024-12-10', 200, 320000, 300000, 220000, '受領済', now(), now())
ON CONFLICT DO NOTHING;

-- 5. 見積詳細データ
INSERT INTO estimate_details (
  id, estimate_id, item_name, quantity, unit_price, amount, variable_cost,
  created_at, updated_at
)
SELECT 
  gen_random_uuid(),
  e.id,
  'パンフレット印刷',
  1000,
  500,
  500000,
  350000,
  now(),
  now()
FROM estimates e WHERE e.estimate_number = 2025001
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO estimate_details (
  id, estimate_id, item_name, quantity, unit_price, amount, variable_cost,
  created_at, updated_at
)
SELECT 
  gen_random_uuid(),
  e.id,
  '年報印刷',
  500,
  1760,
  880000,
  600000,
  now(),
  now()
FROM estimates e WHERE e.estimate_number = 2025002
LIMIT 1
ON CONFLICT DO NOTHING;

-- 6. カレンダーイベントデータ
INSERT INTO calendar_events (
  id, user_id, title, start_at, end_at, all_day, source,
  created_at, updated_at
)
VALUES
  (gen_random_uuid(), 'USR001', 'ABC商事 商談', '2025-01-25 10:00:00', '2025-01-25 11:00:00', false, 'system', now(), now()),
  (gen_random_uuid(), 'USR001', 'XYZ株式会社 納品打ち合わせ', '2025-01-26 14:00:00', '2025-01-26 15:00:00', false, 'system', now(), now()),
  (gen_random_uuid(), 'USR002', '有限会社DEF 仕様確認', '2025-01-27 16:00:00', '2025-01-27 17:00:00', false, 'system', now(), now()),
  (gen_random_uuid(), 'USR001', '週次定例会', '2025-01-27 09:00:00', '2025-01-27 10:00:00', false, 'system', now(), now())
ON CONFLICT DO NOTHING;

-- 7. 議事録データ
INSERT INTO bulletin_threads (
  id, title, content, category, author_id, status,
  created_at, updated_at
)
VALUES
  (gen_random_uuid(), 'ABC商事 プロジェクト進捗会議', 'パンフレット印刷の仕様と納期について協議', '議事録', 'USR001', '公開', now(), now()),
  (gen_random_uuid(), 'XYZ株式会社 年報制作キックオフ', '年報印刷プロジェクトの開始会議', '議事録', 'USR002', '公開', now(), now()),
  (gen_random_uuid(), '今週の営業会議', '新規案件の状況確認と今後の戦略について', '掲示板', 'USR001', '公開', now(), now())
ON CONFLICT DO NOTHING;

-- 8. 議事録コメント
INSERT INTO bulletin_comments (
  id, thread_id, content, author_id,
  created_at, updated_at
)
SELECT 
  gen_random_uuid(),
  t.id,
  '仕様変更の要望がありました。対応可能か確認中です。',
  'USR001',
  now(),
  now()
FROM bulletin_threads t WHERE t.title = 'ABC商事 プロジェクト進捗会議'
LIMIT 1
ON CONFLICT DO NOTHING;

SELECT 
  gen_random_uuid(),
  t.id,
  'デザイン案は承認されました。印刷工程を開始してください。',
  'USR002',
  now(),
  now()
FROM bulletin_threads t WHERE t.title = 'XYZ株式会社 年報制作キックオフ'
LIMIT 1
ON CONFLICT DO NOTHING;

-- 確認用クエリ
SELECT 'Customers' as table_name, COUNT(*) as count FROM customers
UNION ALL
SELECT 'Projects', COUNT(*) FROM projects
UNION ALL  
SELECT 'Estimates', COUNT(*) FROM estimates
UNION ALL
SELECT 'Orders', COUNT(*) FROM orders
UNION ALL
SELECT 'Calendar Events', COUNT(*) FROM calendar_events
UNION ALL
SELECT 'Bulletin Threads', COUNT(*) FROM bulletin_threads
UNION ALL
SELECT 'Bulletin Comments', COUNT(*) FROM bulletin_comments;
