-- supabase/rpc_get_cash_schedule.sql

CREATE OR REPLACE FUNCTION public.get_cash_schedule(
    p_start_date date,
    p_end_date date
)
RETURNS TABLE (
    date date,
    opening_balance numeric,
    inflows numeric,
    outflows numeric,
    closing_balance numeric
)
LANGUAGE sql
STABLE
AS $$
WITH date_series AS (
    -- Generate a series of dates for the specified period
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date as date
),
opening_balance AS (
    -- Calculate the opening balance of all cash/bank accounts before the start date
    SELECT
        COALESCE(SUM(jl.debit - jl.credit), 0) AS amount
    FROM
        accounting.journal_lines jl
    JOIN
        accounting.accounts acc ON jl.account_id = acc.id
    JOIN
        accounting.journal_entries je ON jl.journal_entry_id = je.id
    WHERE
        (acc.code LIKE '111%' OR acc.code LIKE '112%') -- Assuming cash and bank accounts start with these codes
        AND je.entry_date < p_start_date
),
daily_inflows AS (
    -- Calculate total expected inflows for each day from receivables
    SELECT
        due_date AS date,
        SUM(amount - paid_amount) AS total
    FROM
        accounting.receivables
    WHERE
        status <> 'paid'
        AND due_date BETWEEN p_start_date AND p_end_date
    GROUP BY
        due_date
),
daily_outflows AS (
    -- Calculate total expected outflows for each day from payables
    SELECT
        due_date AS date,
        SUM(amount - paid_amount) AS total
    FROM
        accounting.payables
    WHERE
        status <> 'paid'
        AND due_date BETWEEN p_start_date AND p_end_date
    GROUP BY
        due_date
),
daily_summary AS (
    -- Combine daily inflows and outflows
    SELECT
        d.date,
        COALESCE(i.total, 0) AS inflows,
        COALESCE(o.total, 0) AS outflows
    FROM
        date_series d
    LEFT JOIN
        daily_inflows i ON d.date = i.date
    LEFT JOIN
        daily_outflows o ON d.date = o.date
),
cumulative_summary AS (
    -- Calculate the running balance for each day
    SELECT
        ds.date,
        ds.inflows,
        ds.outflows,
        (SELECT amount FROM opening_balance) + SUM(ds.inflows - ds.outflows) OVER (ORDER BY ds.date) AS closing_balance
    FROM
        daily_summary ds
)
SELECT
    cs.date,
    -- opening_balance for the day is the previous day's closing_balance
    LAG(cs.closing_balance, 1, (SELECT amount FROM opening_balance)) OVER (ORDER BY cs.date) as opening_balance,
    cs.inflows,
    cs.outflows,
    cs.closing_balance
FROM
    cumulative_summary cs
ORDER BY
    cs.date;
$$;
