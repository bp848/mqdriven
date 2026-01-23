-- 在庫連動トリガー関数
-- posted仕訳が確定した瞬間に在庫トランザクションを自動生成

CREATE OR REPLACE FUNCTION public.handle_inventory_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account_record RECORD;
    v_quantity DECIMAL;
    v_unit_cost DECIMAL;
    v_item_id UUID;
BEGIN
    -- 1. 借方勘定科目が在庫連動対象かチェック
    SELECT ai.is_inventory_tracked, ai.name INTO v_account_record
    FROM public.account_items ai
    WHERE ai.code = NEW.account AND ai.is_inventory_tracked = TRUE;
    
    IF NOT FOUND THEN
        -- 在庫連動対象でなければ何もしない
        RETURN NEW;
    END IF;
    
    -- 2. 数量を算出（申請データから取得）
    -- TODO: 申請データから数量を取得するロジックを実装
    -- 現在は金額から単価1で仮計算
    IF NEW.debit > 0 THEN
        v_quantity := NEW.debit;
        v_unit_cost := 1;
    ELSIF NEW.credit > 0 THEN
        v_quantity := NEW.credit;
        v_unit_cost := 1;
    ELSE
        RETURN NEW; -- 金額がなければスキップ
    END IF;
    
    -- 3. 在庫トランザクションを生成
    INSERT INTO public.inventory_transactions (
        item_code,
        transaction_type,
        quantity,
        unit_cost,
        total_cost,
        journal_entry_id,
        transaction_date,
        created_by
    ) VALUES (
        NEW.account, -- 勘定科目コードを品目コードとして使用
        CASE 
            WHEN NEW.debit > 0 THEN 'IN' -- 入庫（仕入）
            WHEN NEW.credit > 0 THEN 'OUT' -- 出庫
        END,
        v_quantity,
        v_unit_cost,
        COALESCE(NEW.debit, NEW.credit),
        NEW.id,
        NEW.date,
        NEW.created_by
    );
    
    RETURN NEW;
END;
$$;

-- posted仕訳に対するトリガー設定
DROP TRIGGER IF EXISTS inventory_transaction_trigger ON public.journal_entries;
CREATE TRIGGER inventory_transaction_trigger
AFTER INSERT OR UPDATE ON public.journal_entries
FOR EACH ROW
WHEN (NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted'))
EXECUTE FUNCTION public.handle_inventory_transaction();
