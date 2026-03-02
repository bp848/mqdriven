-- 会計VIEW/TABLE 全面修正
-- public スキーマの journal_entries, journal_lines 等が
-- TABLE の場合は DROP TABLE → VIEW 作成
-- VIEW の場合は DROP VIEW → VIEW 再作成
-- 2026-03-03

-- ========================================
-- 1. journal_entries: TABLE→VIEW変換 (batch_id欠落修正)
-- ========================================
DO $$
BEGIN
  -- テーブルとして存在する場合はDROP TABLE
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'journal_entries' AND table_type = 'BASE TABLE'
  ) THEN
    DROP TABLE public.journal_entries CASCADE;
  END IF;
  -- VIEWとして存在する場合はDROP VIEW
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'journal_entries'
  ) THEN
    DROP VIEW public.journal_entries CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.journal_entries AS
SELECT id, batch_id, entry_date, description, created_at, updated_at
FROM accounting.journal_entries;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT SELECT ON public.journal_entries TO anon;

-- ========================================
-- 2. journal_lines: TABLE→VIEW変換
-- ========================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'journal_lines' AND table_type = 'BASE TABLE'
  ) THEN
    DROP TABLE public.journal_lines CASCADE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'journal_lines'
  ) THEN
    DROP VIEW public.journal_lines CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.journal_lines AS
SELECT id, journal_entry_id, account_id, debit, credit, description, project_id, created_at
FROM accounting.journal_lines;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO authenticated;
GRANT SELECT ON public.journal_lines TO anon;

-- ========================================
-- 3. v_journal_batches VIEW（既存カラムのみ）
-- ========================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'v_journal_batches' AND table_type = 'BASE TABLE'
  ) THEN
    DROP TABLE public.v_journal_batches CASCADE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'v_journal_batches'
  ) THEN
    DROP VIEW public.v_journal_batches CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.v_journal_batches AS
SELECT id, source_application_id, status, created_by, created_at, posted_at
FROM accounting.journal_batches;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.v_journal_batches TO authenticated;
GRANT SELECT ON public.v_journal_batches TO anon;

-- ========================================
-- 4. journal_batches VIEW（v_なし版、互換性）
-- ========================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'journal_batches' AND table_type = 'BASE TABLE'
  ) THEN
    DROP TABLE public.journal_batches CASCADE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'journal_batches'
  ) THEN
    DROP VIEW public.journal_batches CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.journal_batches AS
SELECT id, source_application_id, status, created_by, created_at, posted_at
FROM accounting.journal_batches;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_batches TO authenticated;
GRANT SELECT ON public.journal_batches TO anon;

-- ========================================
-- 5. accounts VIEW
-- ========================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accounts' AND table_type = 'BASE TABLE'
  ) THEN
    DROP TABLE public.accounts CASCADE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'accounts'
  ) THEN
    DROP VIEW public.accounts CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.accounts AS
SELECT id, code, name, category_code, is_active, sort_order, created_at, updated_at, mq_code
FROM accounting.accounts;

GRANT SELECT ON public.accounts TO authenticated;
GRANT SELECT ON public.accounts TO anon;

-- ========================================
-- 6. approve_journal_batch RPC（updated_by削除版）
-- ========================================
CREATE OR REPLACE FUNCTION public.approve_journal_batch(
    p_batch_id uuid,
    p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_application_id uuid;
BEGIN
    UPDATE accounting.journal_batches
    SET status = 'posted',
        posted_at = timezone('utc', now())
    WHERE id = p_batch_id
      AND status = 'draft'
    RETURNING source_application_id INTO v_application_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch not found or already posted: %', p_batch_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM accounting.journal_entries je
        JOIN accounting.journal_lines jl ON jl.journal_entry_id = je.id
        WHERE je.batch_id = p_batch_id
    ) THEN
        RAISE EXCEPTION 'Batch % has no journal lines', p_batch_id;
    END IF;

    IF v_application_id IS NOT NULL THEN
        UPDATE public.applications
        SET accounting_status = 'posted'
        WHERE id = v_application_id;
    END IF;
END;
$$;

-- スキーマキャッシュ更新
NOTIFY pgrst, 'reload schema';
