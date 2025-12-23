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
  SELECT tstzrange(
    (date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'UTC')::timestamptz,
    (date_trunc('month', now() at time zone 'Asia/Tokyo') + interval '1 month' at time zone 'UTC')::timestamptz,
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
  WHERE je.entry_date <@ rng.month_range
    AND (jl.debit - jl.credit) > 0
  GROUP BY a.name
),
purchase_expenses AS (
  SELECT
    COALESCE(supplier_name, '未分類') as category_name,
    SUM(amount) as amount,
    COUNT(*) as count
  FROM orders o
  CROSS JOIN rng
  WHERE o.order_date <@ rng.month_range
    AND amount > 0
  GROUP BY supplier_name
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
