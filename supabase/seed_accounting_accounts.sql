-- 会計モジュール用の基本的な勘定科目マスタのシードデータ
INSERT INTO accounting.accounts (code, name, category_code, sort_order)
VALUES
    -- 資産 (Assets)
    ('1110', '現金', 'ASSETS', 10),
    ('1120', '普通預金', 'ASSETS', 20),
    ('1210', '売掛金', 'ASSETS', 30),
    -- 負債 (Liabilities)
    ('2110', '買掛金', 'LIABILITIES', 100),
    ('2120', '未払金', 'LIABILITIES', 110),
    -- 純資産 (Equity)
    ('3100', '資本金', 'EQUITY', 200),
    -- 収益 (Revenue)
    ('4100', '売上', 'REVENUE', 300),
    -- 費用 (Expense)
    ('5100', '売上原価', 'EXPENSE', 400),
    ('6100', '給料手当', 'EXPENSE', 500),
    ('6200', '経費', 'EXPENSE', 510),
    ('6201', '旅費交通費', 'EXPENSE', 520)
ON CONFLICT (code) DO NOTHING;