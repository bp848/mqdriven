-- Generate journal entry lines for an approved application (idempotent)
CREATE OR REPLACE FUNCTION generate_journal_lines_from_application(application_id uuid)
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
    app_record RECORD;
    journal_entry_uuid uuid;
    existing_status text;
    line1_uuid uuid;
    line2_uuid uuid;
    debit_account_id uuid;
    credit_account_id uuid;
    amount numeric;
    amount_text text;
    app_code text;
    app_code_name text;
BEGIN
    SELECT * INTO app_record
    FROM applications
    WHERE id = application_id AND status = 'approved';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found or not approved: %', application_id;
    END IF;

    SELECT code, name INTO app_code, app_code_name
    FROM application_codes
    WHERE id = app_record.application_code_id;
    SELECT id, status INTO journal_entry_uuid, existing_status
    FROM journal_entries
    WHERE application_id = application_id
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;

    IF journal_entry_uuid IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM journal_entry_lines WHERE journal_entry_id = journal_entry_uuid
        ) THEN
            RETURN QUERY
            SELECT
                je.id,
                jel.id,
                jel.account_id,
                ai.code,
                ai.name,
                jel.debit_amount,
                jel.credit_amount,
                jel.description
            FROM journal_entry_lines jel
            JOIN journal_entries je ON jel.journal_entry_id = je.id
            JOIN account_items ai ON jel.account_id = ai.id
            WHERE jel.journal_entry_id = journal_entry_uuid
            ORDER BY jel.created_at;
            RETURN;
        END IF;

        IF existing_status = 'posted' THEN
            RAISE EXCEPTION 'Posted journal has no lines for application: %', application_id;
        END IF;
    END IF;

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

    IF journal_entry_uuid IS NULL THEN
        INSERT INTO journal_entries (
            date,
            description,
            status,
            application_id,
            created_at,
            updated_at
        ) VALUES (
            COALESCE(app_record.approved_at::date, CURRENT_DATE),
            COALESCE(
                app_record.form_data->>'description',
                app_record.form_data->>'purpose',
                app_record.form_data->>'title',
                'Application ' || COALESCE(app_code_name, app_code, 'Unknown')
            ),
            'draft',
            application_id,
            NOW(),
            NOW()
        ) RETURNING id INTO journal_entry_uuid;
    END IF;

    -- Account selection (server-side only)
    IF app_code = 'EXPENSE' THEN
        SELECT id INTO debit_account_id
        FROM account_items
        WHERE code = 'EXPENSE_GENERAL'
        AND is_active = true
        LIMIT 1;

        SELECT id INTO credit_account_id
        FROM account_items
        WHERE code = 'CASH_BANK'
        AND is_active = true
        LIMIT 1;
    ELSIF app_code = 'TRANSPORT' THEN
        SELECT id INTO debit_account_id
        FROM account_items
        WHERE code = 'EXPENSE_TRANSPORT'
        AND is_active = true
        LIMIT 1;

        SELECT id INTO credit_account_id
        FROM account_items
        WHERE code = 'CASH_BANK'
        AND is_active = true
        LIMIT 1;
    ELSE
        SELECT id INTO debit_account_id
        FROM account_items
        WHERE code = 'PREPAID_EXPENSE'
        AND is_active = true
        LIMIT 1;

        SELECT id INTO credit_account_id
        FROM account_items
        WHERE code = 'CASH_BANK'
        AND is_active = true
        LIMIT 1;
    END IF;

    IF debit_account_id IS NULL THEN
        SELECT id INTO debit_account_id
        FROM account_items
        WHERE code = 'MISC_EXPENSE'
        AND is_active = true
        LIMIT 1;
    END IF;

    IF credit_account_id IS NULL THEN
        SELECT id INTO credit_account_id
        FROM account_items
        WHERE code = 'CASH_BANK'
        AND is_active = true
        LIMIT 1;
    END IF;

    IF debit_account_id IS NULL OR credit_account_id IS NULL THEN
        RAISE EXCEPTION 'Could not determine accounts for application: %', application_id;
    END IF;

    line1_uuid := gen_random_uuid();
    INSERT INTO journal_entry_lines (
        id,
        journal_entry_id,
        account_id,
        debit_amount,
        credit_amount,
        description,
        created_at
    ) VALUES (
        line1_uuid,
        journal_entry_uuid,
        debit_account_id,
        amount,
        0,
        COALESCE(app_record.form_data->>'description', app_record.form_data->>'purpose'),
        NOW()
    );

    line2_uuid := gen_random_uuid();
    INSERT INTO journal_entry_lines (
        id,
        journal_entry_id,
        account_id,
        debit_amount,
        credit_amount,
        description,
        created_at
    ) VALUES (
        line2_uuid,
        journal_entry_uuid,
        credit_account_id,
        0,
        amount,
        COALESCE(app_record.form_data->>'description', app_record.form_data->>'purpose'),
        NOW()
    );

    UPDATE applications
    SET accounting_status = 'draft'
    WHERE id = application_id;

    RETURN QUERY
    SELECT
        je.id,
        jel.id,
        jel.account_id,
        ai.code,
        ai.name,
        jel.debit_amount,
        jel.credit_amount,
        jel.description
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    JOIN account_items ai ON jel.account_id = ai.id
    WHERE jel.journal_entry_id = journal_entry_uuid
    ORDER BY jel.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_journal_lines_from_application TO authenticated, service_role;



