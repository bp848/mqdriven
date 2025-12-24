-- supabase/rpc_get_monthly_expenses.sql
CREATE OR REPLACE FUNCTION public.get_monthly_expenses()
RETURNS TABLE (
    category_name text,
    total_amount numeric,
    journal_amount numeric,
    purchase_amount numeric,
    count bigint
)
LANGUAGE sql
AS $$
WITH rng AS (
  SELECT daterange(
    date_trunc('month', now() at time zone 'Asia/Tokyo')::date,
    (date_trunc('month', now() at time zone 'Asia/Tokyo') + interval '1 month')::date,
    '[)'
  ) as month_range
),
journal_expenses AS (
  SELECT
    COALESCE(a.name, '未分類') as category_name,
    SUM(jl.debit - jl.credit) as amount,
    COUNT(*) as count
  FROM accounting.journal_lines jl
  JOIN accounting.journal_entries je ON jl.journal_entry_id = je.id
  LEFT JOIN accounting.accounts a ON jl.account_id = a.id
  CROSS JOIN rng
  WHERE (je.entry_date)::date <@ rng.month_range
    AND (jl.debit - jl.credit) > 0
  GROUP BY a.name
),
purchase_expenses AS (
  SELECT
    COALESCE(pr.recipient_name, pr.company_name, pr.recipient_code, '支払い先') as category_name,
    SUM(COALESCE(pr.payment_amount, pr.payment_made, pr.transfer_amount, 0)) as amount,
    COUNT(*) as count
  FROM payment_recipients pr
  CROSS JOIN rng
  WHERE (pr.payment_date)::date <@ rng.month_range
    AND COALESCE(pr.payment_amount, pr.payment_made, pr.transfer_amount, 0) > 0
  GROUP BY 1
)
SELECT
  COALESCE(j.category_name, p.category_name, 'その他') as category_name,
  COALESCE(j.amount, 0) + COALESCE(p.amount, 0) as total_amount,
  COALESCE(j.amount, 0) as journal_amount,
  COALESCE(p.amount, 0) as purchase_amount,
  COALESCE(j.count, 0) + COALESCE(p.count, 0) as count
FROM journal_expenses j
FULL OUTER JOIN purchase_expenses p ON j.category_name = p.category_name
WHERE COALESCE(j.amount, 0) + COALESCE(p.amount, 0) > 0
ORDER BY total_amount DESC;
$$;
