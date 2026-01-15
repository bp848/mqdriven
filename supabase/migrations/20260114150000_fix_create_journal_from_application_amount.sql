-- Fix amount parsing in create_journal_from_application (handle JSON string amounts like "2,200")
CREATE OR REPLACE FUNCTION public.create_journal_from_application(
    p_application_id uuid,
    p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_application record;
    v_batch_id uuid;
    v_entry_id uuid;
    v_debit_account_id uuid;
    v_credit_account_id uuid;
    v_amount numeric;
    v_amount_text text;
    v_description text;
    v_entry_date date;
    v_tmp_name text;
    v_tmp_category text;
BEGIN
    -- 1. 申請内容を取得
    SELECT * INTO v_application
    FROM public.applications
    WHERE id = p_application_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found: %', p_application_id;
    END IF;

    -- 2. 既に仕訳が作成済みかチェック
    IF v_application.accounting_status IS NOT NULL AND v_application.accounting_status <> 'none' THEN
        RAISE EXCEPTION 'Journal has already been created for this application: %', p_application_id;
    END IF;

    -- 3. 申請データに基づき、仕訳内容を決定（マッピングロジック）
    v_amount_text := COALESCE(
        v_application.form_data->>'totalAmount',
        v_application.form_data->>'amount',
        v_application.form_data->>'requestedAmount',
        v_application.form_data->'invoice'->>'totalGross',
        v_application.form_data->'invoice'->>'totalNet'
    );
    v_amount := NULLIF(regexp_replace(COALESCE(v_amount_text, ''), '[^0-9.-]', '', 'g'), '')::numeric;

    IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'Could not determine a valid amount from application form_data.';
    END IF;

    v_description := COALESCE(v_application.form_data->>'title', v_application.form_data->>'subject', '承認済み申請');
    v_entry_date := COALESCE((v_application.form_data->>'paymentDate')::date, CURRENT_DATE);

    -- 申請コードに基づいて勘定科目を決定
    DECLARE
        v_app_code text;
    BEGIN
        SELECT code INTO v_app_code
        FROM public.application_codes
        WHERE id = v_application.application_code_id;

        CASE v_app_code
            WHEN 'EXP' THEN -- 経費精算
                SELECT id INTO v_debit_account_id FROM accounting.accounts WHERE code = '6201'; -- 旅費交通費
                IF v_debit_account_id IS NULL THEN
                    SELECT name, category_code INTO v_tmp_name, v_tmp_category FROM public.account_items WHERE code = '6201';
                    IF v_tmp_name IS NOT NULL THEN
                        INSERT INTO accounting.accounts (code, name, category_code, is_active, sort_order)
                        VALUES ('6201', v_tmp_name, v_tmp_category, true, 0)
                        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category_code = EXCLUDED.category_code, is_active = true
                        RETURNING id INTO v_debit_account_id;
                    END IF;
                END IF;

                SELECT id INTO v_credit_account_id FROM accounting.accounts WHERE code = '2120'; -- 未払金
                IF v_credit_account_id IS NULL THEN
                    SELECT name, category_code INTO v_tmp_name, v_tmp_category FROM public.account_items WHERE code = '2120';
                    IF v_tmp_name IS NOT NULL THEN
                        INSERT INTO accounting.accounts (code, name, category_code, is_active, sort_order)
                        VALUES ('2120', v_tmp_name, v_tmp_category, true, 0)
                        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category_code = EXCLUDED.category_code, is_active = true
                        RETURNING id INTO v_credit_account_id;
                    END IF;
                END IF;
            WHEN 'APL' THEN -- 稟議書 (購買申請などを想定)
                SELECT id INTO v_debit_account_id FROM accounting.accounts WHERE code = '5100'; -- 売上原価 (仕入の代替)
                IF v_debit_account_id IS NULL THEN
                    SELECT name, category_code INTO v_tmp_name, v_tmp_category FROM public.account_items WHERE code = '5100';
                    IF v_tmp_name IS NOT NULL THEN
                        INSERT INTO accounting.accounts (code, name, category_code, is_active, sort_order)
                        VALUES ('5100', v_tmp_name, v_tmp_category, true, 0)
                        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category_code = EXCLUDED.category_code, is_active = true
                        RETURNING id INTO v_debit_account_id;
                    END IF;
                END IF;

                SELECT id INTO v_credit_account_id FROM accounting.accounts WHERE code = '2110'; -- 買掛金
                IF v_credit_account_id IS NULL THEN
                    SELECT name, category_code INTO v_tmp_name, v_tmp_category FROM public.account_items WHERE code = '2110';
                    IF v_tmp_name IS NOT NULL THEN
                        INSERT INTO accounting.accounts (code, name, category_code, is_active, sort_order)
                        VALUES ('2110', v_tmp_name, v_tmp_category, true, 0)
                        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category_code = EXCLUDED.category_code, is_active = true
                        RETURNING id INTO v_credit_account_id;
                    END IF;
                END IF;
            ELSE
                -- デフォルトのマッピング
                SELECT id INTO v_debit_account_id FROM accounting.accounts WHERE code = '6200'; -- 経費
                IF v_debit_account_id IS NULL THEN
                    SELECT name, category_code INTO v_tmp_name, v_tmp_category FROM public.account_items WHERE code = '6200';
                    IF v_tmp_name IS NOT NULL THEN
                        INSERT INTO accounting.accounts (code, name, category_code, is_active, sort_order)
                        VALUES ('6200', v_tmp_name, v_tmp_category, true, 0)
                        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category_code = EXCLUDED.category_code, is_active = true
                        RETURNING id INTO v_debit_account_id;
                    END IF;
                END IF;

                SELECT id INTO v_credit_account_id FROM accounting.accounts WHERE code = '2120'; -- 未払金
                IF v_credit_account_id IS NULL THEN
                    SELECT name, category_code INTO v_tmp_name, v_tmp_category FROM public.account_items WHERE code = '2120';
                    IF v_tmp_name IS NOT NULL THEN
                        INSERT INTO accounting.accounts (code, name, category_code, is_active, sort_order)
                        VALUES ('2120', v_tmp_name, v_tmp_category, true, 0)
                        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category_code = EXCLUDED.category_code, is_active = true
                        RETURNING id INTO v_credit_account_id;
                    END IF;
                END IF;
        END CASE;

        IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
            RAISE EXCEPTION 'Could not determine accounts for application code: %. (Ensure required codes exist in public.account_items)', v_app_code;
        END IF;
    END;

    -- 4. 仕訳バッチ、ヘッダ、明細を作成
    INSERT INTO accounting.journal_batches (source_application_id, status, created_by)
    VALUES (p_application_id, 'draft', p_user_id)
    RETURNING id INTO v_batch_id;

    INSERT INTO accounting.journal_entries (batch_id, entry_date, description)
    VALUES (v_batch_id, v_entry_date, v_description)
    RETURNING id INTO v_entry_id;

    -- 借方
    INSERT INTO accounting.journal_lines (journal_entry_id, account_id, debit, description)
    VALUES (v_entry_id, v_debit_account_id, v_amount, v_description);

    -- 貸方
    INSERT INTO accounting.journal_lines (journal_entry_id, account_id, credit, description)
    VALUES (v_entry_id, v_credit_account_id, v_amount, v_description);

    -- 5. 元の申請テーブルのステータスを更新
    UPDATE public.applications
    SET accounting_status = 'drafted'
    WHERE id = p_application_id;

    -- 6. 作成したバッチIDを返す
    RETURN v_batch_id;
END;
$$;
