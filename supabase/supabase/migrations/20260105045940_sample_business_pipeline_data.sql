-- サンプルビジネスパイプラインデータ
-- リード → 見積 → 受注 → プロジェクト → 予算管理 → 仕訳 → 支払い → 会計 → 分析

-- 1. 顧客サンプルデータ
insert into public.customers (
    id,
    customer_code,
    customer_name,
    customer_name_kana,
    representative,
    phone_number,
    address_1,
    created_at
) values
    ('11111111-1111-1111-1111-111111111111', 'C001', '株式会社テクノロジーソリューションズ', 'カブシキガイシャテクノロジーソリューションズ', '田中太郎', '03-1234-5678', '東京都渋谷区1-2-3', now()),
    ('22222222-2222-2222-2222-222222222222', 'C002', 'デザインクリエイティブ株式会社', 'デザインクリエイティブカブシキガイシャ', '鈴木花子', '03-9876-5432', '東京都港区4-5-6', now()),
    ('33333333-3333-3333-3333-333333333333', 'C003', 'マーケティングインテリジェンス社', 'マーケティングインテリジェンスシャ', '佐藤次郎', '03-5555-6666', '東京都新宿区7-8-9', now());

-- 2. リードサンプルデータ
insert into public.leads_v2 (
    id,
    lead_code,
    customer_id,
    title,
    status,
    source,
    expected_close_date,
    expected_amount,
    notes,
    created_at
) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'L001', '11111111-1111-1111-1111-111111111111', 'Webシステム開発案件', 'qualified', 'Webサイト', '2026-01-15', 5000000, 'ECプラットフォーム開発の依頼', now()),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'L002', '22222222-2222-2222-2222-222222222222', '企業ロゴデザイン', 'qualified', '紹介', '2026-01-20', 800000, '新ブランドロゴデザイン', now()),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'L003', '33333333-3333-3333-3333-333333333333', 'マーケティングオートメーション', 'new', '展示会', '2026-02-01', 3000000, 'MAツール導入コンサルティング', now());

-- 3. 見積サンプルデータ
insert into public.estimates_v2 (
    id,
    estimate_number,
    lead_id,
    project_id,
    status,
    version,
    delivery_date,
    subtotal,
    notes,
    created_at
) values
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'E001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'accepted', 1, '2026-03-31', 5000000, '基本機能＋オプション機能', now()),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'E002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, 'sent', 1, '2026-01-31', 800000, 'ロゴデザイン＋名刺デザイン', now());

-- 4. 見積明細サンプルデータ
insert into public.estimate_items_v2 (
    id,
    estimate_id,
    line_no,
    item_name,
    category,
    quantity,
    unit,
    unit_price,
    variable_cost,
    tax_rate,
    created_at
) values
    ('77777777-7777-7777-7777-777777777777', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1, '基本機能開発', '開発', 100, '人日', 40000, 2800000, 10, now()),
    ('88888888-8888-8888-8888-888888888888', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 2, 'デザイン実装', 'デザイン', 20, '人日', 50000, 600000, 10, now()),
    ('99999999-9999-9999-9999-999999999999', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 1, 'ロゴデザイン', 'デザイン', 1, '式', 500000, 200000, 10, now()),
    ('10101010-1010-1010-1010-101010101010', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 2, '名刺デザイン', 'デザイン', 1, '式', 300000, 100000, 10, now());

-- 5. プロジェクトサンプルデータ
insert into public.projects_v2 (
    id,
    project_code,
    project_name,
    customer_id,
    status,
    delivery_status,
    due_date,
    budget_sales,
    budget_cost,
    created_at
) values
    ('12121212-1212-1212-1212-121212121212', 'P001', 'ECプラットフォーム開発プロジェクト', '11111111-1111-1111-1111-111111111111', 'in_progress', 'in_progress', '2026-03-31', 5000000, 3400000, now()),
    ('13131313-1313-1313-1313-131313131313', 'P002', '企業ロゴデザインプロジェクト', '22222222-2222-2222-2222-222222222222', 'planning', 'not_started', '2026-01-31', 800000, 300000, now());

-- 6. 受注サンプルデータ
insert into public.orders_v2 (
    id,
    order_code,
    project_id,
    estimate_id,
    order_type,
    order_date,
    delivery_date,
    quantity,
    unit_price,
    variable_cost,
    status,
    created_at
) values
    ('14141414-1414-1414-1414-141414141414', 'O001', '12121212-1212-1212-1212-121212121212', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'sales', '2026-01-07', '2026-03-31', 120, 41667, 3400000, 'ordered', now()),
    ('15151515-1515-1515-1515-151515151515', 'O002', '13131313-1313-1313-1313-131313131313', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'sales', '2026-01-08', '2026-01-31', 1, 800000, 300000, 'ordered', now());

-- 7. 請求書サンプルデータ
insert into public.invoices_v2 (
    id,
    invoice_code,
    project_id,
    order_id,
    invoice_date,
    due_date,
    subtotal,
    status,
    created_at
) values
    ('16161616-1616-1616-1616-161616161616', 'I001', '12121212-1212-1212-1212-121212121212', '14141414-1414-1414-1414-141414141414', '2026-01-10', '2026-01-31', 5000000, 'sent', now()),
    ('17171717-1717-1717-1717-171717171717', 'I002', '13131313-1313-1313-1313-131313131313', '15151515-1515-1515-1515-151515151515', '2026-01-11', '2026-02-10', 800000, 'draft', now());

-- 8. 支払サンプルデータ
insert into public.payments_v2 (
    id,
    invoice_id,
    payment_date,
    amount,
    method,
    reference,
    notes,
    created_at
) values
    ('18181818-1818-1818-1818-181818181818', '16161616-1616-1616-1616-161616161616', '2026-01-25', 2700000, 'bank_transfer', '振込確認20260125', '初回50%入金', now());

-- 9. 仕訳サンプルデータ
insert into accounting.journal_entries (
    id,
    entry_date,
    description,
    project_id,
    reference,
    created_at
) values
    ('19191919-1919-1919-1919-191919191919', '2026-01-10', 'ECプラットフォーム開発売上', '12121212-1212-1212-1212-121212121212', 'I001', now()),
    ('20202020-2020-2020-2020-202020202020', '2026-01-25', 'ECプラットフォーム開発入金', '12121212-1212-1212-1212-121212121212', 'PAY001', now());

-- 10. 仕訳明細サンプルデータ
insert into accounting.journal_entry_lines (
    id,
    journal_entry_id,
    account_id,
    project_id,
    debit_amount,
    credit_amount,
    description,
    created_at
) values
    ('21212121-2121-2121-2121-212121212121', '19191919-1919-1919-1919-191919191919', '11111111-1111-1111-1111-111111111111', '12121212-1212-1212-1212-121212121212', 5400000, 0, '売掛金', now()),
    ('22222222-2222-2222-2222-222222222222', '19191919-1919-1919-1919-191919191919', '22222222-2222-2222-2222-222222222222', '12121212-1212-1212-1212-121212121212', 0, 5000000, '売上高', now()),
    ('23232323-2323-2323-2323-232323232323', '19191919-1919-1919-1919-191919191919', '33333333-3333-3333-3333-333333333333', '12121212-1212-1212-1212-121212121212', 0, 400000, '仮受消費税', now()),
    ('24242424-2424-2424-2424-242424242424', '20202020-2020-2020-2020-202020202020', '44444444-4444-4444-4444-444444444444', '12121212-1212-1212-1212-121212121212', 2700000, 0, '普通預金', now()),
    ('25252525-2525-2525-2525-252525252525', '20202020-2020-2020-2020-202020202020', '11111111-1111-1111-1111-111111111111', '12121212-1212-1212-1212-121212121212', 0, 2700000, '売掛金', now());

-- 11. 勘定科目サンプルデータ
insert into accounting.accounts (
    id,
    account_code,
    account_name,
    account_type,
    parent_id,
    created_at
) values
    ('11111111-1111-1111-1111-111111111111', '1000', '売掛金', 'asset', null, now()),
    ('22222222-2222-2222-2222-222222222222', '4000', '売上高', 'revenue', null, now()),
    ('33333333-3333-3333-3333-333333333333', '8000', '仮受消費税', 'liability', null, now()),
    ('44444444-4444-4444-4444-444444444444', '1100', '普通預金', 'asset', null, now());

-- 12. 予算実績サンプルデータ
insert into public.project_budgets_v2 (
    id,
    project_id,
    budget_category,
    budget_amount,
    actual_amount,
    variance,
    period_start,
    period_end,
    created_at
) values
    ('26262626-2626-2626-2626-262626262626', '12121212-1212-1212-1212-121212121212', '開発費用', 3400000, 2800000, -600000, '2026-01-01', '2026-01-31', now()),
    ('27272727-2727-2727-2727-272727272727', '12121212-1212-1212-1212-121212121212', 'デザイン費用', 1600000, 1200000, -400000, '2026-01-01', '2026-01-31', now()),
    ('28282828-2828-2828-2828-282828282828', '13131313-1313-1313-1313-131313131313', 'デザイン費用', 300000, 0, -300000, '2026-01-01', '2026-01-31', now());

-- MQ分析結果の更新
-- estimates_list_viewのMQ計算を確認するためのデータ整合性チェック
update public.estimates_v2
set
    subtotal = (select sum(amount) from public.estimate_items_v2 where estimate_id = id),
    total = subtotal + tax_amount
where id in ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-ffff-ffff-ffff-ffffffffffff');

-- プロジェクトの進捗状況更新
update public.projects_v2
set
    actual_sales = (select sum(amount) from public.orders_v2 where project_id = id),
    actual_cost = (select sum(variable_cost) from public.orders_v2 where project_id = id)
where id in ('12121212-1212-1212-1212-121212121212', '13131313-1313-1313-1313-131313131313');