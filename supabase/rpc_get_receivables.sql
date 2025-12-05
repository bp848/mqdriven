-- supabase/rpc_get_receivables.sql

CREATE OR REPLACE FUNCTION public.get_receivables(
    p_status TEXT DEFAULT NULL, -- 'outstanding', 'partially_paid', 'paid'
    p_due_date_start DATE DEFAULT NULL,
    p_due_date_end DATE DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    customer text,
    category text,
    amount numeric,
    date date,
    due_date date,
    status text,
    paid_amount numeric,
    journal_line_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT
    r.id,
    c.customer_name AS customer,
    acc.name AS category, -- Using account name as category
    r.amount,
    je.entry_date AS date,
    r.due_date,
    r.status,
    r.paid_amount,
    r.journal_line_id
FROM
    accounting.receivables AS r
JOIN
    public.customers AS c ON c.id = r.customer_id
JOIN
    accounting.journal_lines AS jl ON jl.id = r.journal_line_id
JOIN
    accounting.accounts AS acc ON acc.id = jl.account_id
JOIN
    accounting.journal_entries AS je ON je.id = jl.journal_entry_id
WHERE
    (p_status IS NULL OR r.status = p_status)
AND
    (p_due_date_start IS NULL OR r.due_date >= p_due_date_start)
AND
    (p_due_date_end IS NULL OR r.due_date <= p_due_date_end)
ORDER BY
    r.due_date ASC;
$$;
