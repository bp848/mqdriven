-- supabase/rpc_get_payables.sql

CREATE OR REPLACE FUNCTION public.get_payables(
    p_status TEXT DEFAULT NULL, -- 'outstanding', 'partially_paid', 'paid'
    p_due_date_start DATE DEFAULT NULL,
    p_due_date_end DATE DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    supplier text,
    category text,
    amount numeric,
    date date,
    due_date date,
    status text,
    method text,
    invoice_img text,
    paid_amount numeric,
    journal_line_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT
    p.id,
    pr.company_name AS supplier,
    acc.name AS category, -- Using account name as category
    p.amount,
    je.entry_date AS date,
    p.due_date,
    p.status,
    'Bank Transfer' AS method, -- Placeholder
    NULL AS invoice_img, -- Placeholder
    p.paid_amount,
    p.journal_line_id
FROM
    accounting.payables AS p
JOIN
    public.payment_recipients AS pr ON pr.id = p.supplier_id
JOIN
    accounting.journal_lines AS jl ON jl.id = p.journal_line_id
JOIN
    accounting.accounts AS acc ON acc.id = jl.account_id
JOIN
    accounting.journal_entries AS je ON je.id = jl.journal_entry_id
WHERE
    (p_status IS NULL OR p.status = p_status)
AND
    (p_due_date_start IS NULL OR p.due_date >= p_due_date_start)
AND
    (p_due_date_end IS NULL OR p.due_date <= p_due_date_end)
ORDER BY
    p.due_date ASC;
$$;
