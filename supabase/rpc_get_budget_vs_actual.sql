-- Compare actuals vs projections for a period and scenario
CREATE OR REPLACE FUNCTION public.get_budget_vs_actual(
    p_scenario_name text,
    p_start_date date,
    p_end_date date
)
RETURNS TABLE(
    metric_type text,
    account_code text,
    account_name text,
    projected_amount numeric,
    actual_amount numeric,
    variance numeric
)
LANGUAGE sql
STABLE
AS $$
WITH actuals AS (
    SELECT
        acc.category_code,
        acc.code,
        acc.name,
        SUM(jl.debit - jl.credit) AS amount
    FROM accounting.journal_lines jl
    JOIN accounting.accounts acc ON acc.id = jl.account_id
    JOIN accounting.journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.entry_date BETWEEN p_start_date AND p_end_date
    GROUP BY acc.category_code, acc.code, acc.name
),
projected AS (
    SELECT
        metric_type,
        account_code,
        SUM(amount) AS amount
    FROM accounting.projections
    WHERE scenario_name = p_scenario_name
      AND period_start >= p_start_date
      AND period_end <= p_end_date
    GROUP BY metric_type, account_code
)
SELECT
    COALESCE(projected.metric_type,
        CASE
            WHEN act.category_code = 'REVENUE' THEN 'revenue'
            WHEN act.category_code = 'EXPENSE' THEN 'expense'
            WHEN act.category_code IN ('ASSET','LIABILITY','EQUITY') THEN 'balance'
            ELSE 'other'
        END
    ) AS metric_type,
    COALESCE(projected.account_code, act.code) AS account_code,
    act.name AS account_name,
    COALESCE(projected.amount, 0) AS projected_amount,
    COALESCE(act.amount, 0) AS actual_amount,
    COALESCE(act.amount, 0) - COALESCE(projected.amount, 0) AS variance
FROM actuals act
FULL OUTER JOIN projected ON projected.account_code = act.code;
$$;
