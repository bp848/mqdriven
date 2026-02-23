-- Accounting workflow + journal generation (workflow-based)

-- Core tables (public schema)
create table if not exists public.accounting_workflows (
    id uuid primary key default gen_random_uuid(),
    source_type text not null,
    source_id uuid not null,
    status text not null default 'draft' check (status in ('draft', 'reviewed', 'approved', 'posted')),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint accounting_workflows_source_unique unique (source_type, source_id)
);

create index if not exists idx_accounting_workflows_source on public.accounting_workflows(source_type, source_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'accounting_workflows_source_unique'
    ) THEN
        ALTER TABLE public.accounting_workflows
            ADD CONSTRAINT accounting_workflows_source_unique UNIQUE (source_type, source_id);
    END IF;
END $$;

-- Ensure journal_entries has workflow_id
create table if not exists public.journal_entries (
    id uuid primary key default gen_random_uuid(),
    workflow_id uuid not null references public.accounting_workflows(id) on delete cascade,
    status text not null default 'draft' check (status in ('draft', 'reviewed', 'approved', 'posted')),
    date date not null default current_date,
    description text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint journal_entries_workflow_unique unique (workflow_id)
);

alter table public.journal_entries
    add column if not exists workflow_id uuid;

-- Backfill workflow_id from legacy application_id when present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'journal_entries'
          AND column_name = 'application_id'
    ) THEN
        INSERT INTO public.accounting_workflows (source_type, source_id, status, created_at, updated_at)
        SELECT 'application', je.application_id, COALESCE(je.status, 'draft'), timezone('utc', now()), timezone('utc', now())
        FROM public.journal_entries je
        WHERE je.application_id IS NOT NULL
        ON CONFLICT (source_type, source_id) DO NOTHING;

        UPDATE public.journal_entries je
        SET workflow_id = aw.id
        FROM public.accounting_workflows aw
        WHERE aw.source_type = 'application'
          AND aw.source_id = je.application_id
          AND je.workflow_id IS NULL;

        -- Deduplicate journal_entries per workflow_id (keep latest)
        WITH ranked AS (
            SELECT id,
                   workflow_id,
                   ROW_NUMBER() OVER (
                       PARTITION BY workflow_id
                       ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, created_at DESC NULLS LAST
                   ) AS rn
            FROM public.journal_entries
            WHERE workflow_id IS NOT NULL
        )
        DELETE FROM public.journal_entry_lines jl
        USING ranked r
        WHERE jl.journal_entry_id = r.id
          AND r.rn > 1;

        WITH ranked AS (
            SELECT id,
                   workflow_id,
                   ROW_NUMBER() OVER (
                       PARTITION BY workflow_id
                       ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, created_at DESC NULLS LAST
                   ) AS rn
            FROM public.journal_entries
            WHERE workflow_id IS NOT NULL
        )
        DELETE FROM public.journal_entries je
        USING ranked r
        WHERE je.id = r.id
          AND r.rn > 1;

        ALTER TABLE public.journal_entries DROP COLUMN IF EXISTS application_id;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'journal_entries_workflow_fkey'
    ) THEN
        ALTER TABLE public.journal_entries
            ADD CONSTRAINT journal_entries_workflow_fkey
            FOREIGN KEY (workflow_id)
            REFERENCES public.accounting_workflows(id)
            ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'journal_entries_workflow_unique'
    ) THEN
        ALTER TABLE public.journal_entries
            ADD CONSTRAINT journal_entries_workflow_unique UNIQUE (workflow_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.journal_entries
        WHERE workflow_id IS NULL
    ) THEN
        ALTER TABLE public.journal_entries
            ALTER COLUMN workflow_id SET NOT NULL;
    END IF;
END $$;

-- Ensure journal_entry_lines has required columns/constraints
create table if not exists public.journal_entry_lines (
    id uuid primary key default gen_random_uuid(),
    journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
    account_id uuid not null references public.account_items(id) on delete restrict,
    debit numeric not null default 0,
    credit numeric not null default 0,
    tax_code_id uuid null,
    memo text null,
    description text null,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.journal_entry_lines
    add column if not exists debit numeric not null default 0,
    add column if not exists credit numeric not null default 0,
    add column if not exists tax_code_id uuid,
    add column if not exists memo text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'journal_entry_lines_nonzero_chk'
    ) THEN
        ALTER TABLE public.journal_entry_lines
            ADD CONSTRAINT journal_entry_lines_nonzero_chk
            CHECK (debit > 0 OR credit > 0) NOT VALID;
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'journal_entry_lines_account_chk'
    ) THEN
        ALTER TABLE public.journal_entry_lines
            ADD CONSTRAINT journal_entry_lines_account_chk
            CHECK (account_id IS NOT NULL) NOT VALID;
    END IF;
END $$;

-- RPC: get_or_create_workflow
CREATE OR REPLACE FUNCTION public.get_or_create_workflow(
    p_source_type text,
    p_source_id uuid
)
RETURNS TABLE(
    id uuid,
    source_type text,
    source_id uuid,
    status text,
    created_at timestamptz,
    updated_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO public.accounting_workflows (source_type, source_id, status, created_at, updated_at)
    VALUES (p_source_type, p_source_id, 'draft', timezone('utc', now()), timezone('utc', now()))
    ON CONFLICT (source_type, source_id) DO UPDATE
        SET updated_at = EXCLUDED.updated_at
    RETURNING public.accounting_workflows.id,
              public.accounting_workflows.source_type,
              public.accounting_workflows.source_id,
              public.accounting_workflows.status,
              public.accounting_workflows.created_at,
              public.accounting_workflows.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_or_create_journal_entry
CREATE OR REPLACE FUNCTION public.get_or_create_journal_entry(
    p_workflow_id uuid
)
RETURNS TABLE(
    id uuid,
    workflow_id uuid,
    status text,
    date date,
    description text,
    created_at timestamptz,
    updated_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO public.journal_entries (workflow_id, status, date, created_at, updated_at)
    VALUES (p_workflow_id, 'draft', CURRENT_DATE, timezone('utc', now()), timezone('utc', now()))
    ON CONFLICT (workflow_id) DO UPDATE
        SET updated_at = EXCLUDED.updated_at
    RETURNING public.journal_entries.id,
              public.journal_entries.workflow_id,
              public.journal_entries.status,
              public.journal_entries.date,
              public.journal_entries.description,
              public.journal_entries.created_at,
              public.journal_entries.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Build lines from source (no DB writes)
CREATE OR REPLACE FUNCTION public.build_journal_lines(
    p_source_type text,
    p_source_id uuid
)
RETURNS TABLE(
    account_id uuid,
    debit numeric,
    credit numeric,
    tax_code_id uuid,
    memo text
) AS $$
DECLARE
    app_record RECORD;
    debit_account_id uuid;
    credit_account_id uuid;
    amount numeric;
    amount_text text;
    app_code text;
    app_code_name text;
    memo_text text;
BEGIN
    IF p_source_type <> 'application' THEN
        RAISE EXCEPTION 'Unsupported source_type: %', p_source_type;
    END IF;

    SELECT * INTO app_record
    FROM public.applications
    WHERE id = p_source_id AND status = 'approved';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found or not approved: %', p_source_id;
    END IF;

    SELECT code, name INTO app_code, app_code_name
    FROM public.application_codes
    WHERE id = app_record.application_code_id;

    amount_text := COALESCE(
        app_record.form_data->>'totalAmount',
        app_record.form_data->>'amount',
        app_record.form_data->>'requestedAmount',
        app_record.form_data->'invoice'->>'totalGross',
        app_record.form_data->'invoice'->>'totalNet',
        app_record.form_data->>'total_amount',
        app_record.form_data->>'expense_amount'
    );
    amount := NULLIF(regexp_replace(COALESCE(amount_text, ''), '[^0-9.-]', '', 'g'), '')::numeric;

    IF amount IS NULL OR amount <= 0 THEN
        RAISE EXCEPTION 'Invalid amount for application: %', amount_text;
    END IF;

    memo_text := COALESCE(app_record.form_data->>'description', app_record.form_data->>'purpose');

    -- Account selection (server-side only)
    IF app_code = 'EXPENSE' THEN
        SELECT id INTO debit_account_id
        FROM public.account_items
        WHERE code = 'EXPENSE_GENERAL'
          AND is_active = true
        LIMIT 1;

        SELECT id INTO credit_account_id
        FROM public.account_items
        WHERE code = 'CASH_BANK'
          AND is_active = true
        LIMIT 1;
    ELSIF app_code = 'TRANSPORT' THEN
        SELECT id INTO debit_account_id
        FROM public.account_items
        WHERE code = 'EXPENSE_TRANSPORT'
          AND is_active = true
        LIMIT 1;

        SELECT id INTO credit_account_id
        FROM public.account_items
        WHERE code = 'CASH_BANK'
          AND is_active = true
        LIMIT 1;
    ELSE
        SELECT id INTO debit_account_id
        FROM public.account_items
        WHERE code = 'PREPAID_EXPENSE'
          AND is_active = true
        LIMIT 1;

        SELECT id INTO credit_account_id
        FROM public.account_items
        WHERE code = 'CASH_BANK'
          AND is_active = true
        LIMIT 1;
    END IF;

    IF debit_account_id IS NULL THEN
        SELECT id INTO debit_account_id
        FROM public.account_items
        WHERE code = 'MISC_EXPENSE'
          AND is_active = true
        LIMIT 1;
    END IF;

    IF credit_account_id IS NULL THEN
        SELECT id INTO credit_account_id
        FROM public.account_items
        WHERE code = 'CASH_BANK'
          AND is_active = true
        LIMIT 1;
    END IF;

    IF debit_account_id IS NULL OR credit_account_id IS NULL THEN
        RAISE EXCEPTION 'Could not determine accounts for application: %', p_source_id;
    END IF;

    RETURN QUERY
    SELECT debit_account_id, amount, 0::numeric, NULL::uuid, memo_text
    UNION ALL
    SELECT credit_account_id, 0::numeric, amount, NULL::uuid, memo_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Materialize lines for a journal entry
CREATE OR REPLACE FUNCTION public.materialize_journal_lines(
    p_journal_entry_id uuid,
    p_lines jsonb
)
RETURNS void AS $$
DECLARE
    entry_status text;
    total_debit numeric;
    total_credit numeric;
BEGIN
    SELECT status INTO entry_status
    FROM public.journal_entries
    WHERE id = p_journal_entry_id;

    IF entry_status IS NULL THEN
        RAISE EXCEPTION 'Journal entry not found: %', p_journal_entry_id;
    END IF;

    IF entry_status NOT IN ('draft', 'reviewed') THEN
        RAISE EXCEPTION 'Cannot modify journal lines for status: %', entry_status;
    END IF;

    DELETE FROM public.journal_entry_lines
    WHERE journal_entry_id = p_journal_entry_id;

    INSERT INTO public.journal_entry_lines (
        id,
        journal_entry_id,
        account_id,
        debit,
        credit,
        tax_code_id,
        memo,
        description,
        created_at
    )
    SELECT
        gen_random_uuid(),
        p_journal_entry_id,
        (line->>'account_id')::uuid,
        COALESCE((line->>'debit')::numeric, 0),
        COALESCE((line->>'credit')::numeric, 0),
        NULLIF(line->>'tax_code_id', '')::uuid,
        NULLIF(line->>'memo', ''),
        NULLIF(line->>'memo', ''),
        timezone('utc', now())
    FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) AS line
    WHERE (COALESCE((line->>'debit')::numeric, 0) > 0 OR COALESCE((line->>'credit')::numeric, 0) > 0)
      AND (line->>'account_id') IS NOT NULL;

    SELECT
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0)
    INTO total_debit, total_credit
    FROM public.journal_entry_lines
    WHERE journal_entry_id = p_journal_entry_id;

    IF total_debit <> total_credit THEN
        RAISE EXCEPTION 'Unbalanced journal entry: debit %, credit %', total_debit, total_credit;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_or_create_lines
CREATE OR REPLACE FUNCTION public.get_or_create_lines(
    p_journal_entry_id uuid
)
RETURNS TABLE(
    journal_entry_id uuid,
    line_id uuid,
    account_id uuid,
    account_code text,
    account_name text,
    debit numeric,
    credit numeric,
    memo text
) AS $$
DECLARE
    wf RECORD;
    built_lines jsonb;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.journal_entry_lines
        WHERE journal_entry_id = p_journal_entry_id
    ) THEN
        RETURN QUERY
        SELECT
            je.id,
            jel.id,
            jel.account_id,
            ai.code,
            ai.name,
            jel.debit,
            jel.credit,
            jel.memo
        FROM public.journal_entry_lines jel
        JOIN public.journal_entries je ON je.id = jel.journal_entry_id
        JOIN public.account_items ai ON ai.id = jel.account_id
        WHERE jel.journal_entry_id = p_journal_entry_id
        ORDER BY jel.created_at;
        RETURN;
    END IF;

    SELECT aw.* INTO wf
    FROM public.accounting_workflows aw
    JOIN public.journal_entries je ON je.workflow_id = aw.id
    WHERE je.id = p_journal_entry_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workflow not found for journal entry: %', p_journal_entry_id;
    END IF;

    SELECT jsonb_agg(to_jsonb(bl)) INTO built_lines
    FROM public.build_journal_lines(wf.source_type, wf.source_id) bl;

    PERFORM public.materialize_journal_lines(p_journal_entry_id, built_lines);

    RETURN QUERY
    SELECT
        je.id,
        jel.id,
        jel.account_id,
        ai.code,
        ai.name,
        jel.debit,
        jel.credit,
        jel.memo
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    JOIN public.account_items ai ON ai.id = jel.account_id
    WHERE jel.journal_entry_id = p_journal_entry_id
    ORDER BY jel.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Compatibility wrapper: generate lines by application id
CREATE OR REPLACE FUNCTION public.generate_journal_lines_from_application(
    application_id uuid
)
RETURNS TABLE(
    journal_entry_id uuid,
    line_id uuid,
    account_id uuid,
    account_code text,
    account_name text,
    debit_amount numeric,
    credit_amount numeric,
    description text
) AS $$
DECLARE
    wf RECORD;
    je RECORD;
BEGIN
    SELECT * INTO wf
    FROM public.get_or_create_workflow('application', application_id)
    LIMIT 1;

    SELECT * INTO je
    FROM public.get_or_create_journal_entry(wf.id)
    LIMIT 1;

    RETURN QUERY
    SELECT
        lines.journal_entry_id,
        lines.line_id,
        lines.account_id,
        lines.account_code,
        lines.account_name,
        lines.debit,
        lines.credit,
        lines.memo
    FROM public.get_or_create_lines(je.id) AS lines;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_or_create_workflow TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_or_create_journal_entry TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.build_journal_lines TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.materialize_journal_lines TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_or_create_lines TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_journal_lines_from_application TO authenticated, service_role;

