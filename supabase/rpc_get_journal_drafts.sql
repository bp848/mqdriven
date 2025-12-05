-- supabase/rpc_get_journal_drafts.sql

CREATE OR REPLACE FUNCTION public.get_journal_drafts()
RETURNS SETOF json
LANGUAGE sql
STABLE
AS $$
WITH base_query AS (
    SELECT
        jb.id AS batch_id,
        je.id AS entry_id,
        jb.status,
        je.entry_date AS date,
        je.description,
        ac.name AS source_name,
        jl.id AS line_id,
        jl.account_id,
        acc.code AS account_code,
        acc.name AS account_name,
        jl.debit,
        jl.credit
    FROM
        accounting.journal_batches AS jb
    JOIN
        accounting.journal_entries AS je ON je.batch_id = jb.id
    JOIN
        accounting.journal_lines AS jl ON jl.journal_entry_id = je.id
    JOIN
        accounting.accounts AS acc ON acc.id = jl.account_id
    LEFT JOIN
        public.applications AS app ON app.id = jb.source_application_id
    LEFT JOIN
        public.application_codes AS ac ON ac.id = app.application_code_id
    WHERE
        jb.status = 'draft'
    ORDER BY
        je.entry_date DESC, jb.id, jl.debit DESC
)
, line_agg AS (
    SELECT
        batch_id,
        entry_id,
        json_agg(
            json_build_object(
                'lineId', line_id,
                'accountId', account_id,
                'accountCode', account_code,
                'accountName', account_name,
                'debit', debit,
                'credit', credit
            )
        ) AS lines
    FROM base_query
    GROUP BY batch_id, entry_id
)
, simple_lines AS (
    SELECT
        batch_id,
        MAX(CASE WHEN debit > 0 THEN account_name END) as debit_account,
        MAX(CASE WHEN debit > 0 THEN debit END) as debit_amount,
        MAX(CASE WHEN credit > 0 THEN account_name END) as credit_account,
        MAX(CASE WHEN credit > 0 THEN credit END) as credit_amount
    FROM base_query
    GROUP BY batch_id
    HAVING COUNT(*) = 2
)
SELECT
    json_build_object(
        'batchId', bq.batch_id,
        'entryId', bq.entry_id,
        'source', COALESCE(bq.source_name, 'Manual'),
        'date', bq.date,
        'description', bq.description,
        'status', bq.status,
        'lines', la.lines,
        'debitAccount', sl.debit_account,
        'debitAmount', sl.debit_amount,
        'creditAccount', sl.credit_account,
        'creditAmount', sl.credit_amount,
        'confidence', 0.98 -- Placeholder
    )
FROM
    (SELECT DISTINCT batch_id, entry_id, status, date, description, source_name FROM base_query) AS bq
JOIN
    line_agg AS la ON la.batch_id = bq.batch_id
LEFT JOIN
    simple_lines AS sl ON sl.batch_id = bq.batch_id;
$$;