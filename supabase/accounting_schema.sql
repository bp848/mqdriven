-- 会計モジュール用のスキーマとテーブル
-- スキーマの作成
CREATE SCHEMA IF NOT EXISTS accounting;

-- 勘定科目マスタ (accounts)
CREATE TABLE IF NOT EXISTS accounting.accounts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category_code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    mq_code JSONB
);
COMMENT ON TABLE accounting.accounts IS '勘定科目マスタ';
COMMENT ON COLUMN accounting.accounts.code IS '勘定科目コード';
COMMENT ON COLUMN accounting.accounts.name IS '勘定科目名';
COMMENT ON COLUMN accounting.accounts.category_code IS 'カテゴリコード (資産, 負債, 純資産, 収益, 費用など)';
COMMENT ON COLUMN accounting.accounts.is_active IS '有効フラグ';

-- 仕訳バッチ (journal_batches)
CREATE TABLE IF NOT EXISTS accounting.journal_batches (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_application_id uuid, -- 承認申請テーブルのID
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'posted'
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    posted_at TIMESTAMPTZ
);
COMMENT ON TABLE accounting.journal_batches IS '仕訳バッチ';
COMMENT ON COLUMN accounting.journal_batches.source_application_id IS '元となった承認申請のID';
COMMENT ON COLUMN accounting.journal_batches.status IS '状態 (draft: 仮登録, posted: 転記済)';
COMMENT ON COLUMN accounting.journal_batches.created_by IS '作成者';
COMMENT ON COLUMN accounting.journal_batches.posted_at IS '転記日';

-- 仕訳ヘッダ (journal_entries)
CREATE TABLE IF NOT EXISTS accounting.journal_entries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id uuid NOT NULL REFERENCES accounting.journal_batches(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    description TEXT, -- 摘要
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE accounting.journal_entries IS '仕訳ヘッダ';
COMMENT ON COLUMN accounting.journal_entries.batch_id IS '仕訳バッチID';
COMMENT ON COLUMN accounting.journal_entries.entry_date IS '仕訳日';
COMMENT ON COLUMN accounting.journal_entries.description IS '摘要';

-- 仕訳明細 (journal_lines)
CREATE TABLE IF NOT EXISTS accounting.journal_lines (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id uuid NOT NULL REFERENCES accounting.journal_entries(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES accounting.accounts(id),
    debit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    credit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    description TEXT, -- 明細ごとの摘要
    project_id uuid,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT debit_or_credit_required CHECK (debit != 0 OR credit != 0),
    CONSTRAINT debit_xor_credit CHECK (debit = 0 OR credit = 0)
);
COMMENT ON TABLE accounting.journal_lines IS '仕訳明細';
COMMENT ON COLUMN accounting.journal_lines.journal_entry_id IS '仕訳ヘッダID';
COMMENT ON COLUMN accounting.journal_lines.account_id IS '勘定科目ID';
COMMENT ON COLUMN accounting.journal_lines.debit IS '借方金額';
COMMENT ON COLUMN accounting.journal_lines.credit IS '貸方金額';
COMMENT ON COLUMN accounting.journal_lines.project_id IS '関連プロジェクトID';

-- 売掛金管理 (receivables)
CREATE TABLE IF NOT EXISTS accounting.receivables (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_line_id uuid NOT NULL REFERENCES accounting.journal_lines(id),
    customer_id uuid NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'outstanding', -- 'outstanding', 'partially_paid', 'paid'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE accounting.receivables IS '売掛金管理';

-- 買掛金管理 (payables)
CREATE TABLE IF NOT EXISTS accounting.payables (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_line_id uuid NOT NULL REFERENCES accounting.journal_lines(id),
    supplier_id uuid NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'outstanding', -- 'outstanding', 'partially_paid', 'paid'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE accounting.payables IS '買掛金管理';

-- 外部キー制約の追加 (Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_source_application'
      AND conrelid = 'accounting.journal_batches'::regclass
  ) THEN
    ALTER TABLE accounting.journal_batches
      ADD CONSTRAINT fk_source_application
      FOREIGN KEY (source_application_id) REFERENCES public.applications(id) ON DELETE SET NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_project'
      AND conrelid = 'accounting.journal_lines'::regclass
  ) THEN
    ALTER TABLE accounting.journal_lines
      ADD CONSTRAINT fk_project
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_customer'
      AND conrelid = 'accounting.receivables'::regclass
  ) THEN
    ALTER TABLE accounting.receivables
      ADD CONSTRAINT fk_customer
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_supplier'
      AND conrelid = 'accounting.payables'::regclass
  ) THEN
    ALTER TABLE accounting.payables
      ADD CONSTRAINT fk_supplier
      FOREIGN KEY (supplier_id) REFERENCES public.payment_recipients(id) ON DELETE RESTRICT;
  END IF;
END;
$$;


-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounting.accounts(code);
CREATE INDEX IF NOT EXISTS idx_journal_batches_source_id ON accounting.journal_batches(source_application_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON accounting.journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_id ON accounting.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON accounting.journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_receivables_customer_id ON accounting.receivables(customer_id);
CREATE INDEX IF NOT EXISTS idx_payables_supplier_id ON accounting.payables(supplier_id);

-- RLS (Row Level Security) は要件が明確になってから設定します。
-- updated_at トリガーも、既存の set_updated_at 関数が存在するか確認してから設定します。