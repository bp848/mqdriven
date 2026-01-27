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
    v_invoice_lines jsonb;
    v_first_line jsonb;
    v_proposed_account_id uuid;
    v_proposed_account_id_text text;
    v_due_date date;
    v_supplier_id uuid;
    v_payment_recipient_id_text text;
    v_project_id uuid;
    v_project_id_text text;
    v_payable_id uuid;
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

    -- Account selection: Try to use AI-proposed account from form_data first
    -- Check if invoice.lines exists and has accountItemId
    -- Try to get accountItemId from invoice.lines (AI-proposed account)
    v_invoice_lines := app_record.form_data->'invoice'->'lines';
    IF v_invoice_lines IS NOT NULL AND jsonb_typeof(v_invoice_lines) = 'array' AND jsonb_array_length(v_invoice_lines) > 0 THEN
        -- Get first line's accountItemId
        v_first_line := v_invoice_lines->0;
        v_proposed_account_id_text := v_first_line->>'accountItemId';
        IF v_proposed_account_id_text IS NOT NULL AND v_proposed_account_id_text != '' THEN
            -- Try to use the proposed account
            SELECT id INTO v_proposed_account_id
            FROM account_items
            WHERE id = v_proposed_account_id_text::uuid
            AND is_active = true
            LIMIT 1;
            IF v_proposed_account_id IS NOT NULL THEN
                debit_account_id := v_proposed_account_id;
            END IF;
        END IF;
    END IF;

    -- Fallback to default account selection if AI-proposed account not found
    IF debit_account_id IS NULL THEN
        IF app_code = 'EXP' OR app_code = 'EXPENSE' THEN
            SELECT id INTO debit_account_id
            FROM account_items
            WHERE (code = '6200' OR code = 'EXPENSE_GENERAL')
            AND is_active = true
            ORDER BY CASE WHEN code = '6200' THEN 1 ELSE 2 END
            LIMIT 1;
        ELSIF app_code = 'TRP' OR app_code = 'TRANSPORT' THEN
            SELECT id INTO debit_account_id
            FROM account_items
            WHERE (code = '6201' OR code = 'EXPENSE_TRANSPORT')
            AND is_active = true
            ORDER BY CASE WHEN code = '6201' THEN 1 ELSE 2 END
            LIMIT 1;
        ELSE
            SELECT id INTO debit_account_id
            FROM account_items
            WHERE code = 'PREPAID_EXPENSE'
            AND is_active = true
            LIMIT 1;
        END IF;
    END IF;

    -- Credit account (cash/bank) - always use default
    SELECT id INTO credit_account_id
    FROM account_items
    WHERE (code = '1110' OR code = '2120' OR code = 'CASH_BANK')
    AND is_active = true
    ORDER BY CASE 
        WHEN code = '1110' THEN 1 
        WHEN code = '2120' THEN 2 
        ELSE 3 
    END
    LIMIT 1;

    -- Final fallback for debit account
    IF debit_account_id IS NULL THEN
        SELECT id INTO debit_account_id
        FROM account_items
        WHERE (code = '6200' OR code = 'MISC_EXPENSE')
        AND is_active = true
        ORDER BY CASE WHEN code = '6200' THEN 1 ELSE 2 END
        LIMIT 1;
    END IF;

    -- Final fallback for credit account
    IF credit_account_id IS NULL THEN
        SELECT id INTO credit_account_id
        FROM account_items
        WHERE (code = '1110' OR code = 'CASH_BANK')
        AND is_active = true
        ORDER BY CASE WHEN code = '1110' THEN 1 ELSE 2 END
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

    -- Create payable_v2 entry if due_date exists in invoice
    -- Get due_date from invoice
    v_due_date := (app_record.form_data->'invoice'->>'dueDate')::date;
    IF v_due_date IS NULL THEN
        -- Try alternative field names
        v_due_date := (app_record.form_data->>'paymentDate')::date;
    END IF;

    -- Get supplier_id from invoice or payment_recipient_id
    v_payment_recipient_id_text := app_record.form_data->>'paymentRecipientId';
    IF v_payment_recipient_id_text IS NULL OR v_payment_recipient_id_text = '' THEN
        v_payment_recipient_id_text := app_record.form_data->'invoice'->>'paymentRecipientId';
    END IF;
    IF v_payment_recipient_id_text IS NOT NULL AND v_payment_recipient_id_text != '' THEN
        BEGIN
            v_supplier_id := v_payment_recipient_id_text::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_supplier_id := NULL;
        END;
    END IF;

    -- Get project_id from invoice lines (first line with projectId)
    IF v_invoice_lines IS NOT NULL AND jsonb_typeof(v_invoice_lines) = 'array' AND jsonb_array_length(v_invoice_lines) > 0 THEN
        v_first_line := v_invoice_lines->0;
        v_project_id_text := v_first_line->>'projectId';
        IF v_project_id_text IS NOT NULL AND v_project_id_text != '' THEN
            BEGIN
                v_project_id := v_project_id_text::uuid;
            EXCEPTION WHEN OTHERS THEN
                v_project_id := NULL;
            END;
        END IF;
    END IF;

    -- Create payable_v2 if due_date exists
    IF v_due_date IS NOT NULL THEN
        -- If project_id is not found, try to get a default project or skip payable creation
        -- For now, we'll create payable only if project_id exists
        IF v_project_id IS NOT NULL THEN
            BEGIN
                INSERT INTO public.payables_v2 (
                    project_id,
                    supplier_id,
                    application_id,
                    due_date,
                    amount,
                    description,
                    status,
                    created_by
                ) VALUES (
                    v_project_id,
                    v_supplier_id,
                    application_id,
                    v_due_date,
                    amount,
                    COALESCE(
                        app_record.form_data->>'description',
                        app_record.form_data->>'purpose',
                        app_record.form_data->>'title',
                        'Application ' || COALESCE(app_code_name, app_code, 'Unknown')
                    ),
                    'outstanding',
                    app_record.applicant_id
                )
                ON CONFLICT DO NOTHING
                RETURNING id INTO v_payable_id;
            EXCEPTION WHEN OTHERS THEN
                -- Silently fail if payable creation fails (e.g., project_id doesn't exist)
                NULL;
            END;
        END IF;
    END IF;

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



