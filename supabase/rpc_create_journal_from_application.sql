-- supabase/rpc_create_journal_from_application.sql
CREATE OR REPLACE FUNCTION public.create_journal_from_application(
    p_application_id uuid,
    p_user_id uuid
)
RETURNS uuid -- 菴懈・縺輔ｌ縺溘ヰ繝・メID繧定ｿ斐＠縺ｾ縺・LANGUAGE plpgsql
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
    -- 1. 逕ｳ隲句・螳ｹ繧貞叙蠕・    SELECT * INTO v_application
    FROM public.applications
    WHERE id = p_application_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found: %', p_application_id;
    END IF;

    -- 2. 譌｢縺ｫ莉戊ｨｳ縺御ｽ懈・貂医∩縺九メ繧ｧ繝・け
    SELECT id INTO v_batch_id
    FROM accounting.journal_batches
    WHERE source_application_id = p_application_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_batch_id IS NOT NULL THEN
        RETURN v_batch_id;
    END IF;

    -- 3. 逕ｳ隲九ョ繝ｼ繧ｿ縺ｫ蝓ｺ縺･縺阪∽ｻ戊ｨｳ蜀・ｮｹ繧呈ｱｺ螳夲ｼ医・繝・ヴ繝ｳ繧ｰ繝ｭ繧ｸ繝・け・・    -- 縺薙％縺ｯ逕ｳ隲狗ｨｮ蛻･縺斐→縺ｫ諡｡蠑ｵ縺悟ｿ・ｦ√↑繝励Ξ繝ｼ繧ｹ繝帙Ν繝繝ｼ繝ｭ繧ｸ繝・け縺ｧ縺・    v_amount_text := COALESCE(
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

    v_description := COALESCE(v_application.form_data->>'title', v_application.form_data->>'subject', '謇ｿ隱肴ｸ医∩逕ｳ隲・);
    v_entry_date := COALESCE((v_application.form_data->>'paymentDate')::date, CURRENT_DATE);

    -- 逕ｳ隲九さ繝ｼ繝峨↓蝓ｺ縺･縺・※蜍伜ｮ夂ｧ醍岼繧呈ｱｺ螳・    DECLARE
        v_app_code text;
    BEGIN
        SELECT code INTO v_app_code
        FROM public.application_codes
        WHERE id = v_application.application_code_id;

        CASE v_app_code
            WHEN 'EXP' THEN -- 邨瑚ｲｻ邊ｾ邂・                SELECT id INTO v_debit_account_id FROM accounting.accounts WHERE code = '6201'; -- 譌・ｲｻ莠､騾夊ｲｻ
                IF v_debit_account_id IS NULL THEN
                    SELECT name, category_code INTO v_tmp_name, v_tmp_category FROM public.account_items WHERE code = '6201';
                    IF v_tmp_name IS NOT NULL THEN
                        INSERT INTO accounting.accounts (code, name, category_code, is_active, sort_order)
                        VALUES ('6201', v_tmp_name, v_tmp_category, true, 0)
                        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category_code = EXCLUDED.category_code, is_active = true
                        RETURNING id INTO v_debit_account_id;
                    END IF;
                END IF;

                SELECT id INTO v_credit_account_id FROM accounting.accounts WHERE code = '2120'; -- 譛ｪ謇暮≡
                IF v_credit_account_id IS NULL THEN
                    SELECT name, category_code INTO v_tmp_name, v_tmp_category FROM public.account_items WHERE code = '2120';
                    IF v_tmp_name IS NOT NULL THEN
                        INSERT INTO accounting.accounts (code, name, category_code, is_active, sort_order)
                        VALUES ('2120', v_tmp_name, v_tmp_category, true, 0)
                        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category_code = EXCLUDED.category_code, is_active = true
                        RETURNING id INTO v_credit_account_id;
                    END IF;
                END IF;
            WHEN 'APL' THEN -- 遞溯ｭｰ譖ｸ (雉ｼ雋ｷ逕ｳ隲九↑縺ｩ繧呈Φ螳・
                SELECT id INTO v_debit_account_id FROM accounting.accounts WHERE code = '5100'; -- 螢ｲ荳雁次萓｡ (莉募・縺ｮ莉｣譖ｿ)
                IF v_debit_account_id IS NULL THEN
                    SELECT name, category_code INTO v_tmp_name, v_tmp_category FROM public.account_items WHERE code = '5100';
                    IF v_tmp_name IS NOT NULL THEN
                        INSERT INTO accounting.accounts (code, name, category_code, is_active, sort_order)
                        VALUES ('5100', v_tmp_name, v_tmp_category, true, 0)
                        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category_code = EXCLUDED.category_code, is_active = true
                        RETURNING id INTO v_debit_account_id;
                    END IF;
                END IF;

                SELECT id INTO v_credit_account_id FROM accounting.accounts WHERE code = '2110'; -- 雋ｷ謗幃≡
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
                -- 繝・ヵ繧ｩ繝ｫ繝医・繝槭ャ繝斐Φ繧ｰ
                SELECT id INTO v_debit_account_id FROM accounting.accounts WHERE code = '6200'; -- 邨瑚ｲｻ
                IF v_debit_account_id IS NULL THEN
                    SELECT name, category_code INTO v_tmp_name, v_tmp_category FROM public.account_items WHERE code = '6200';
                    IF v_tmp_name IS NOT NULL THEN
                        INSERT INTO accounting.accounts (code, name, category_code, is_active, sort_order)
                        VALUES ('6200', v_tmp_name, v_tmp_category, true, 0)
                        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category_code = EXCLUDED.category_code, is_active = true
                        RETURNING id INTO v_debit_account_id;
                    END IF;
                END IF;

                SELECT id INTO v_credit_account_id FROM accounting.accounts WHERE code = '2120'; -- 譛ｪ謇暮≡
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

    -- 4. 莉戊ｨｳ繝舌ャ繝√√・繝・ム縲∵・邏ｰ繧剃ｽ懈・
    INSERT INTO accounting.journal_batches (source_application_id, status, created_by)
    VALUES (p_application_id, 'draft', p_user_id)
    RETURNING id INTO v_batch_id;

    INSERT INTO accounting.journal_entries (batch_id, entry_date, description)
    VALUES (v_batch_id, v_entry_date, v_description)
    RETURNING id INTO v_entry_id;

    -- 蛟滓婿
    INSERT INTO accounting.journal_lines (journal_entry_id, account_id, debit, description)
    VALUES (v_entry_id, v_debit_account_id, v_amount, v_description);

    -- 雋ｸ譁ｹ
    INSERT INTO accounting.journal_lines (journal_entry_id, account_id, credit, description)
    VALUES (v_entry_id, v_credit_account_id, v_amount, v_description);

    -- 5. 蜈・・逕ｳ隲九ユ繝ｼ繝悶Ν縺ｮ繧ｹ繝・・繧ｿ繧ｹ繧呈峩譁ｰ
    UPDATE public.applications
    SET accounting_status = 'draft'
    WHERE id = p_application_id;

    -- 6. 菴懈・縺励◆繝舌ャ繝！D繧定ｿ斐☆
    RETURN v_batch_id;

END;
$$;

