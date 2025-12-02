

import React from 'react';
import { X, BookOpen, ArrowRight } from './Icons';

interface Props {
    onRetry: () => void;
}

const sqlScript = `-- Supabase SQL Editorで以下のスクリプト全体を実行してください。
-- このスクリプトは何度実行しても安全なように設計されています。

BEGIN;

-- =================================================================
-- === 最重要: RLS再帰エラーの修正 ===
-- =================================================================
-- public.usersテーブルは認証情報と直接関連しないユーザー情報のため、
-- RLS（行レベルセキュリティ）を無効化します。
-- これにより、SupabaseのRLS再帰チェックに起因する致命的なエラーを防ぎます。
-- これを最初に実行することが、すべての問題を解決する鍵となります。
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;


-- 1. 必要なテーブルを作成（存在しない場合のみ）

-- アプリケーションのユーザープロファイルテーブル
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    schema JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.application_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.approval_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    route_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id UUID REFERENCES public.users(id),
    application_code_id UUID REFERENCES public.application_codes(id),
    form_data JSONB,
    status TEXT NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    current_level INTEGER,
    approver_id UUID REFERENCES public.users(id),
    rejection_reason TEXT,
    approval_route_id UUID REFERENCES public.approval_routes(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- usersテーブルに関連するemployeesテーブルとビューが存在しない場合に作成
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) UNIQUE, -- auth.users の ID を参照
    name TEXT NOT NULL,
    department TEXT,
    title TEXT,
    hire_date DATE,
    salary NUMERIC,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- v_employees_active ビューを修正
CREATE OR REPLACE VIEW public.v_employees_active AS
SELECT
    e.user_id,
    e.name,
    e.department,
    e.title,
    u.email, -- auth.users から email を取得
    COALESCE(pu.role, 'user') AS role, -- public.users テーブルからロールを取得
    e.created_at
FROM
    public.employees e
JOIN
    auth.users u ON e.user_id = u.id
LEFT JOIN
    public.users pu ON e.user_id = pu.id
WHERE
    e.active = true;


-- accounts_item テーブル
CREATE TABLE IF NOT EXISTS public.account_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category_code VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- payment_recipients テーブル
CREATE TABLE IF NOT EXISTS public.payment_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_code VARCHAR(50) UNIQUE,
    company_name TEXT,
    recipient_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- leads テーブル (完全なスキーマ)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    source TEXT,
    tags TEXT[],
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    status TEXT NOT NULL,
    inquiry_types TEXT[],
    info_sales_activity TEXT,
    ip_address TEXT,
    device_type TEXT,
    assignee_id UUID,
    is_first_visit TEXT,
    landing_page_url TEXT,
    previous_visit_date DATE,
    referrer TEXT,
    referrer_url TEXT,
    search_keywords TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_medium TEXT,
    utm_source TEXT,
    utm_term TEXT,
    visit_count TEXT,
    browser_name TEXT,
    browser_version TEXT,
    os_name TEXT,
    os_version TEXT,
    screen_resolution TEXT,
    viewport_size TEXT,
    language TEXT,
    timezone TEXT,
    session_id TEXT,
    page_load_time INTEGER,
    time_on_page INTEGER,
    cta_source TEXT,
    scroll_depth TEXT,
    sections_viewed TEXT,
    print_types TEXT,
    user_agent TEXT,
    country TEXT,
    city TEXT,
    region TEXT,
    employees TEXT,
    budget TEXT,
    timeline TEXT,
    inquiry_type TEXT,
    score INTEGER,
    ai_analysis_report TEXT,
    ai_draft_proposal TEXT,
    ai_investigation JSONB
);

-- customers テーブル
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code TEXT,
    customer_name TEXT NOT NULL,
    customer_name_kana TEXT,
    representative TEXT,
    representative_title TEXT,
    phone_number TEXT,
    address1 TEXT,
    company_content TEXT,
    annual_sales TEXT,
    employees_count TEXT,
    note TEXT,
    info_sales_activity TEXT,
    info_requirements TEXT,
    info_history TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    post_no TEXT,
    address_2 TEXT,
    fax TEXT,
    closing_day TEXT,
    monthly_plan TEXT,
    pay_day TEXT,
    recovery_method TEXT,
    user_id UUID REFERENCES auth.users (id),
    name2 TEXT,
    website_url TEXT,
    zip_code TEXT,
    foundation_date DATE,
    capital TEXT,
    customer_rank TEXT,
    customer_division TEXT,
    sales_type TEXT,
    credit_limit TEXT,
    pay_money TEXT,
    bank_name TEXT,
    branch_name TEXT,
    account_no TEXT,
    sales_user_code TEXT,
    start_date DATE,
    end_date DATE,
    drawing_date DATE,
    sales_goal TEXT,
    info_sales_ideas TEXT,
    customer_contact_info TEXT,
    ai_analysis JSONB
);

ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS representative_title TEXT;

-- invoices テーブル
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no TEXT NOT NULL UNIQUE,
    invoice_date DATE NOT NULL,
    due_date DATE,
    customer_name TEXT NOT NULL,
    subtotal_amount NUMERIC NOT NULL,
    tax_amount NUMERIC NOT NULL,
    total_amount NUMERIC NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    paid_at TIMESTAMPTZ
);

-- invoice_items テーブル
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    job_id UUID,
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit TEXT,
    unit_price NUMERIC NOT NULL,
    line_total NUMERIC NOT NULL,
    sort_index INTEGER NOT NULL
);

-- inbox_items テーブル (storageのinboxバケットと連携)
CREATE TABLE IF NOT EXISTS public.inbox_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    extracted_data JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- allocation_divisions (振分区分) テーブル
CREATE TABLE IF NOT EXISTS public.allocation_divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- employee_titles (役職) テーブル
CREATE TABLE IF NOT EXISTS public.employee_titles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- 2. 'applications'テーブルに'updated_at'カラムを追加し、自動更新トリガーを設定
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_applications_update ON public.applications;
CREATE TRIGGER on_applications_update
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 3. 'v_departments'ビューを作成 (departmentsテーブルも存在しない場合に作成)
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 必須データを挿入
-- 社長決裁ルート（重要：ステップが空でないこと）
-- 注： '00000000-...' の部分は、実際の管理者ユーザーのUUIDに置き換える必要があります。
--      [手順] 1. Supabaseの 'SQL Editor' -> 'User Management' スクリプトを実行して、自分のユーザーのIDを確認します。
--            2. そのIDをコピーし、以下の '00000000-...' の部分に貼り付けてください。
INSERT INTO public.approval_routes (name, route_data)
VALUES ('社長決裁ルート', '{"steps": [{"approver_id": "00000000-0000-0000-0000-000000000000"}]}') -- !!! 管理者ユーザーのUUIDに置き換えてください !!!
ON CONFLICT (name) DO UPDATE SET route_data = EXCLUDED.route_data;

-- 申請種別コード
INSERT INTO public.application_codes (code, name, description)
VALUES
('EXP', '経費精算', '経費精算申請'),
('TRP', '交通費申請', '交通費申請'),
('LEV', '休暇申請', '休暇申請'),
('APL', '稟議申請', '稟議申請'),
('DLY', '日報', '日報'),
('WKR', '週報', '週報')
ON CONFLICT (code) DO NOTHING;

-- フォーム定義（経費精算のスキーマを修正）
INSERT INTO public.forms (code, name, description, schema, is_active)
VALUES
('EXP', '経費精算フォーム', '経費精算申請用のフォーム', '{"fields":[{"name":"department_id","type":"select","label":"部門","required":true,"options":[]},{"name":"details","type":"array","label":"経費明細","items":{"type":"object","properties":{"paymentDate":{"type":"date","label":"支払日"},"payment_recipient_id":{"type":"select","label":"支払先","options":[]},"description":{"type":"text","label":"内容"},"account_item_id":{"type":"select","label":"勘定科目","options":[]},"allocation_division_id":{"type":"select","label":"振分区分","options":[]},"allocationTarget":{"type":"select","label":"振分先","options":[]},"costType":{"type":"select","label":"費用種別","options":["V","F"]},"amount":{"type":"number","label":"金額"}}}},{"name":"notes","type":"textarea","label":"備考"}]}', true),
('TRP', '交通費申請フォーム', '交通費申請用のフォーム', '{"fields":[{"name":"details","type":"array","label":"交通費明細","items":{"type":"object","properties":{"travelDate":{"type":"date","label":"利用日"},"departure":{"type":"text","label":"出発地"},"arrival":{"type":"text","label":"目的地"},"transportMode":{"type":"select","label":"交通手段","options":["電車","バス","タクシー","飛行機","その他"]},"amount":{"type":"number","label":"金額"}}}},{"name":"notes","type":"textarea","label":"備考"}]}', true),
('LEV', '休暇申請フォーム', '休暇申請用のフォーム', '{"fields":[{"name":"leaveType","type":"select","label":"休暇の種類","required":true,"options":["有給休暇","午前半休","午後半休","欠勤","その他"]},{"name":"startDate","type":"date","label":"開始日","required":true},{"name":"endDate","type":"date","label":"終了日","required":true},{"name":"reason","type":"textarea","label":"理由","required":true}]}', true),
('APL', '稟議申請フォーム', '稟議申請用のフォーム', '{"fields":[{"name":"title","type":"text","label":"件名","required":true},{"name":"details","type":"textarea","label":"目的・概要","required":true}]}', true),
('DLY', '日報フォーム', '日報提出用のフォーム', '{"fields":[{"name":"reportDate","type":"date","label":"報告日","required":true},{"name":"startTime","type":"time","label":"業務開始"},{"name":"endTime","type":"time","label":"業務終了"},{"name":"customerName","type":"text","label":"訪問先・顧客名"},{"name":"activityContent","type":"textarea","label":"活動内容","required":true},{"name":"nextDayPlan","type":"textarea","label":"翌日予定"}]}', true),
('WKR', '週報フォーム', '週報提出用のフォーム', '{"fields":[{"name":"title","type":"text","label":"件名","required":true},{"name":"details","type":"textarea","label":"報告内容","required":true}]}', true)
ON CONFLICT (code) DO UPDATE SET schema = EXCLUDED.schema, is_active = EXCLUDED.is_active;

-- サンプルマスターデータ
INSERT INTO public.departments (name) VALUES ('総務部'), ('経理部'), ('営業部'), ('製造部') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.employee_titles (name) VALUES ('代表取締役'), ('取締役'), ('部長'), ('課長'), ('社員') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.allocation_divisions (name) VALUES ('本社経費'), ('営業部経費'), ('製造部経費'), ('共通経費') ON CONFLICT (name) DO NOTHING;


-- 5. RLSポリシーと権限を設定
-- 各テーブルでRLSを有効化
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_titles ENABLE ROW LEVEL SECURITY;


-- 既存のポリシーを削除してクリーンな状態から開始
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.forms;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.application_codes;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.approval_routes;
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.applications;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.account_items;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.payment_recipients;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.leads;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.invoices;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.invoice_items;
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.inbox_items;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.departments;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.employees;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.allocation_divisions;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.employee_titles;

-- 権限付与
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.v_departments TO anon, authenticated;

-- 参照用テーブルにSELECT権限を付与
CREATE POLICY "Allow authenticated read access" ON public.forms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.application_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.approval_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.invoice_items FOR SELECT TO authenticated USING (true);

-- データ操作用テーブルにALL権限を付与
CREATE POLICY "Allow all authenticated users" ON public.inbox_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users" ON public.applications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.account_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.payment_recipients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.departments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.allocation_divisions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.employee_titles FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =================================================================
-- === ステップ6: スキーマキャッシュの再読み込み ===
-- =================================================================
-- PostgRESTにスキーマの変更を通知し、キャッシュをクリアさせます。これが重要です。
NOTIFY pgrst, 'reload schema';

COMMIT;
`;


const DatabaseSetupInstructionsModal: React.FC<Props> = ({ onRetry }) => {
    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/70 p-4">
            <div className="relative max-w-4xl w-full rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-6 py-5 flex-shrink-0">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">データベース セットアップスクリプト</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">以下のSQLをSupabaseのSQL Editorに貼り付けて実行してください。</p>
                    </div>
                    <button
                        type="button"
                        onClick={onRetry}
                        className="ml-auto rounded-full p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        aria-label="閉じる"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="px-6 py-6 overflow-y-auto">
                    <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words font-mono">
                        <code>{sqlScript}</code>
                    </pre>
                </div>
                <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(sqlScript); alert('SQLスクリプトをクリップボードにコピーしました。'); }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-slate-700"
                    >
                        スクリプトをコピー
                    </button>
                    <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
                    >
                        実行したので再読み込み
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DatabaseSetupInstructionsModal;
