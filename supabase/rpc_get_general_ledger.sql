-- supabase/rpc_get_general_ledger.sql
CREATE OR REPLACE FUNCTION public.get_general_ledger(
    p_account_id uuid,
    p_start_date date,
    p_end_date date
)
RETURNS TABLE (
    id uuid,
    date date,
    voucher_no uuid,
    description text,
    partner text,
    debit numeric,
    credit numeric,
    balance numeric
)
LANGUAGE sql
AS $$
WITH opening_balance AS (
    -- Calculate the balance of the account just before the start date
    SELECT
        COALESCE(SUM(debit - credit), 0) AS amount
    FROM
        accounting.journal_lines jl
    JOIN
        accounting.journal_entries je ON jl.journal_entry_id = je.id
    WHERE
        jl.account_id = p_account_id
        AND je.entry_date < p_start_date
),
transactions AS (
    -- Get all transactions for the account within the specified period
    SELECT
        jl.id,
        je.entry_date AS date,
        je.id AS voucher_no,
        je.description,
        jl.debit,
        jl.credit,
        -- Find the name of the partner account in the same journal entry
        (
            SELECT a.name
            FROM accounting.journal_lines AS partner_jl
            JOIN accounting.accounts AS a ON a.id = partner_jl.account_id
            WHERE partner_jl.journal_entry_id = je.id
              AND partner_jl.id <> jl.id
            ORDER BY partner_jl.debit + partner_jl.credit DESC -- In complex entries, pick the largest one
            LIMIT 1
        ) AS partner
    FROM
        accounting.journal_lines jl
    JOIN
        accounting.journal_entries je ON jl.journal_entry_id = je.id
    WHERE
        jl.account_id = p_account_id
        AND je.entry_date >= p_start_date
        AND je.entry_date <= p_end_date
),
cumulative_balance AS (
    -- Calculate the running balance for each transaction
    SELECT
        t.*,
        (SELECT amount FROM opening_balance) + SUM(t.debit - t.credit) OVER (ORDER BY t.date, t.id) AS running_balance
    FROM
        transactions t
)
-- We need a "opening balance" row to start the ledger
SELECT
    uuid_generate_v4() as id, -- pseudo id
    (p_start_date - INTERVAL '1 day')::date as date,
    null as voucher_no,
    '前月繰越' as description,
    null as partner,
    null as debit,
    null as credit,
    (SELECT amount FROM opening_balance) as balance
UNION ALL
SELECT
    cb.id,
    cb.date,
    cb.voucher_no,
    cb.description,
    cb.partner,
    cb.debit,
    cb.credit,
    cb.running_balance as balance
FROM
    cumulative_balance cb
ORDER BY
    date;
$$;
