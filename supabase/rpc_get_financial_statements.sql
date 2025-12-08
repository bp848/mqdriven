-- Returns BS/PL style aggregates between two dates.
CREATE OR REPLACE FUNCTION public.get_financial_statements(
    p_start_date date,
    p_end_date date DEFAULT NULL
)
RETURNS TABLE(
    section text,
    account_code text,
    account_name text,
    amount numeric
)
LANGUAGE sql
STABLE
AS $$
WITH base_lines AS (
    SELECT
        acc.category_code,
        acc.code,
        acc.name,
        SUM(CASE
            WHEN acc.category_code IN ('ASSET') THEN jl.debit - jl.credit
            WHEN acc.category_code IN ('LIABILITY','EQUITY') THEN jl.credit - jl.debit
            WHEN acc.category_code IN ('REVENUE') THEN jl.credit - jl.debit
            WHEN acc.category_code IN ('EXPENSE') THEN jl.debit - jl.credit
            ELSE jl.debit - jl.credit
        END) AS balance
    FROM accounting.journal_lines jl
    JOIN accounting.accounts acc ON acc.id = jl.account_id
    JOIN accounting.journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.entry_date >= p_start_date
      AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
    GROUP BY acc.category_code, acc.code, acc.name
)
SELECT
    CASE
        WHEN category_code = 'ASSET' THEN 'balance_sheet_asset'
        WHEN category_code IN ('LIABILITY','EQUITY') THEN 'balance_sheet_liability_equity'
        WHEN category_code = 'REVENUE' THEN 'income_statement_revenue'
        WHEN category_code = 'EXPENSE' THEN 'income_statement_expense'
        ELSE 'other'
    END AS section,
    code AS account_code,
    name AS account_name,
    balance AS amount
FROM base_lines
WHERE balance <> 0;
$$;
