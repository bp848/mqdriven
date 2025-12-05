
import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Database, Code, CheckCircle, AlertCircle, FileText, Settings, Link, Shield, Eye, EyeOff, Activity, Server, Wand2, ArrowRight } from 'lucide-react';
import { DraftEntry, ViewState } from '../App';

interface ExcelImportProps {
    onAddDrafts?: (drafts: DraftEntry[]) => void;
    onNavigate?: (view: ViewState) => void;
    notify?: (message: string, type: 'success' | 'info') => void;
}

export const ExcelImport: React.FC<ExcelImportProps> = ({ onAddDrafts, onNavigate, notify }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'schema' | 'connection'>('connection');
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [showKey, setShowKey] = useState(false);

  // Configuration from environment (User Provided)
  const SUPABASE_URL = "https://ivxwwfirmrionvvkuqqg.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2eHd3ZmlybXJpb252dmt1cXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNTU0MTYsImV4cCI6MjA3OTczMTQxNn0.vEvukC9w8LDqY3LR60WvwIiczZzMQyoa1RkfdyJHabg";

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    // Simulate upload process
    setUploadStatus('processing');
    
    setTimeout(() => {
        setUploadStatus('success');
        if (notify) notify('Excelファイルの解析が完了しました。', 'success');

        // Generate dummy drafts from imported data
        if (onAddDrafts) {
            const importedDrafts: DraftEntry[] = [
                {
                    id: `IMP-${Date.now()}-01`,
                    source: 'Excel',
                    date: '2024/05/25',
                    description: '5月度 従業員給与計上',
                    debitAccount: '給料手当',
                    debitAmount: 5200000,
                    creditAccount: '未払費用',
                    creditAmount: 5200000,
                    confidence: 0.99,
                    status: 'pending'
                },
                {
                    id: `IMP-${Date.now()}-02`,
                    source: 'Excel',
                    date: '2024/05/25',
                    description: '社会保険料 会社負担分',
                    debitAccount: '法定福利費',
                    debitAmount: 850000,
                    creditAccount: '未払費用',
                    creditAmount: 850000,
                    confidence: 0.95,
                    status: 'pending'
                }
            ];
            onAddDrafts(importedDrafts);
            if (notify) notify('Excelデータから2件の仕訳候補を生成しました', 'info');
        }

    }, 2000);
  };

  const handleGoToJournal = () => {
      if (onNavigate) onNavigate('journal');
  };

  // SQL Schema Proposal (Unchanged)
  const sqlSchema = `-- Supabase / PostgreSQL Schema for MQ Accounting (Budget vs Actual)

-- 1. Organizations (テナント管理)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fiscal_year_start_month int not null default 4,
  created_at timestamptz default now()
);

-- 2. Departments (部門マスタ)
create table departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,
  code text,
  is_active boolean default true
);

-- 3. Account Items (勘定科目 - MQ分類フラグ付き)
create type mq_classification as enum ('PQ', 'VQ', 'F', 'NON_OPERATING');
create table account_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  code text not null,
  name text not null,
  mq_type mq_classification,
  description text
);

-- 4. Financial Plans (予算・経営計画)
create table financial_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  dept_id uuid references departments(id), -- NULL for Company-wide
  target_month date not null, -- YYYY-MM-01
  
  -- Planned Values
  plan_pq numeric default 0,
  plan_vq numeric default 0,
  plan_f numeric default 0,
  
  version text default 'v1', -- e.g., 'Initial', 'Revised'
  created_at timestamptz default now()
);

-- 5. General Ledger (実績・総勘定元帳)
create table general_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  transaction_date date not null,
  account_item_id uuid references account_items(id),
  dept_id uuid references departments(id),
  amount numeric not null, -- Debit positive, Credit negative usually, or separate cols
  description text,
  created_at timestamptz default now()
);

-- 6. Monthly MQ Results View (予実管理用ビュー)
create or replace view mq_monthly_variance_view as
with actuals as (
  select 
    date_trunc('month', gl.transaction_date)::date as month,
    gl.org_id,
    gl.dept_id,
    sum(case when ai.mq_type = 'PQ' then gl.amount else 0 end) as act_pq,
    sum(case when ai.mq_type = 'VQ' then gl.amount else 0 end) as act_vq,
    sum(case when ai.mq_type = 'F' then gl.amount else 0 end) as act_f
  from general_ledger gl
  join account_items ai on gl.account_item_id = ai.id
  group by 1, 2, 3
)
select 
  coalesce(p.target_month, a.month) as month,
  coalesce(p.org_id, a.org_id) as org_id,
  coalesce(p.dept_id, a.dept_id) as dept_id,
  coalesce(p.plan_pq, 0) as plan_pq,
  coalesce(p.plan_vq, 0) as plan_vq,
  (coalesce(p.plan_pq, 0) - coalesce(p.plan_vq, 0)) as plan_mq,
  coalesce(p.plan_f, 0) as plan_f,
  ((coalesce(p.plan_pq, 0) - coalesce(p.plan_vq, 0)) - coalesce(p.plan_f, 0)) as plan_g,
  coalesce(a.act_pq, 0) as act_pq,
  coalesce(a.act_vq, 0) as act_vq,
  (coalesce(a.act_pq, 0) - coalesce(a.act_vq, 0)) as act_mq,
  coalesce(a.act_f, 0) as act_f,
  ((coalesce(a.act_pq, 0) - coalesce(a.act_vq, 0)) - coalesce(a.act_f, 0)) as act_g
from financial_plans p
full outer join actuals a on p.target_month = a.month and p.dept_id = a.dept_id and p.org_id = a.org_id;
`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">データ・設定 (Settings)</h1>
            <p className="text-slate-500 text-sm mt-1">財務データのインポートおよびデータベース接続設定</p>
        </div>
        <div className="flex space-x-2 bg-slate-200 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('connection')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'connection' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
                <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" /> 接続設定
                </div>
            </button>
            <button 
                onClick={() => setActiveTab('upload')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'upload' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
                <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" /> Excelインポート
                </div>
            </button>
            <button 
                onClick={() => setActiveTab('schema')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'schema' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
                <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" /> DBスキーマ
                </div>
            </button>
        </div>
      </div>

      {activeTab === 'connection' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Link className="w-5 h-5 text-indigo-500" />
                    Supabase Connection
                </h3>
                
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                             <Server className="w-3 h-3" /> Project URL
                        </label>
                        <div className="flex items-center gap-3">
                            <input 
                                type="text" 
                                value={SUPABASE_URL} 
                                readOnly 
                                className="flex-1 bg-slate-50 border border-slate-300 text-slate-600 text-sm rounded-lg px-4 py-2.5 font-mono" 
                            />
                            <div className="flex items-center text-emerald-600 gap-1.5 text-xs font-bold bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                                <CheckCircle className="w-4 h-4" /> Valid
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                             <Shield className="w-3 h-3" /> Anon Key (Public)
                        </label>
                        <div className="relative">
                            <input 
                                type={showKey ? "text" : "password"} 
                                value={SUPABASE_KEY} 
                                readOnly 
                                className="w-full bg-slate-50 border border-slate-300 text-slate-600 text-sm rounded-lg pl-4 pr-12 py-2.5 font-mono" 
                            />
                            <button 
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            This key is safe to use in the browser (Client-side).
                        </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                       <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-4 flex items-start gap-4">
                          <div className="p-2 bg-emerald-100 rounded-full">
                              <Activity className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                              <p className="text-sm font-bold text-emerald-800">Connection Established</p>
                              <p className="text-xs text-emerald-600 mt-1 leading-relaxed">
                                 Successfully connected to Supabase project "mq-accounting-db".
                                 <br/>
                                 <span className="opacity-80">Latency: 45ms • Region: ap-northeast-1 (Tokyo)</span>
                              </p>
                          </div>
                       </div>
                    </div>
                </div>
             </div>

             <div className="space-y-6">
                 <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <Database className="w-5 h-5 text-indigo-400" />
                        Current Environment
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-800">
                            <span className="text-sm text-slate-400">Environment</span>
                            <span className="text-sm font-bold text-white bg-indigo-600 px-2 py-0.5 rounded">Production</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-800">
                            <span className="text-sm text-slate-400">Database Engine</span>
                            <span className="text-sm font-bold text-slate-200">PostgreSQL 15.1</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-800">
                            <span className="text-sm text-slate-400">Realtime</span>
                            <span className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Active
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-sm text-slate-400">Last Backup</span>
                            <span className="text-sm font-mono text-slate-200">2024-05-20 03:00:00 UTC</span>
                        </div>
                    </div>
                 </div>

                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                     <h3 className="font-bold text-slate-700 mb-2">Troubleshooting</h3>
                     <p className="text-xs text-slate-500 mb-4">
                         If you experience connection issues, check if your IP address is allowed in the database settings.
                     </p>
                     <button className="w-full py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg text-sm hover:bg-slate-50 transition">
                         Test Connection Again
                     </button>
                 </div>
             </div>
          </div>
      )}

      {activeTab === 'upload' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                {/* Upload Area */}
                {uploadStatus !== 'success' && (
                    <div 
                        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all bg-white
                            ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <div className="bg-indigo-100 p-4 rounded-full mb-4">
                            <Upload className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">Excelファイルをここにドラッグ＆ドロップ</h3>
                        <p className="text-slate-500 text-sm mt-2 max-w-sm">
                            または <span className="text-indigo-600 font-medium cursor-pointer hover:underline">ファイルを選択</span> してください。
                            <br/>対応形式: .xlsx, .csv (最大 50MB)
                        </p>
                    </div>
                )}
                
                {uploadStatus === 'success' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center animate-slide-in-right">
                         <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                             <CheckCircle className="w-8 h-8 text-emerald-500" />
                         </div>
                         <h3 className="text-xl font-bold text-emerald-800 mb-2">インポート完了</h3>
                         <p className="text-emerald-600 text-sm mb-6">
                             Excelファイルから仕訳候補データを生成しました。<br/>
                             内容を確認して承認してください。
                         </p>
                         <button 
                            onClick={handleGoToJournal}
                            className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition shadow-md flex items-center justify-center gap-2 mx-auto"
                         >
                             AI仕訳を確認する (Journal) <ArrowRight className="w-4 h-4" />
                         </button>
                    </div>
                )}

                {/* Upload History */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-500" /> 取込履歴
                        </h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {uploadStatus === 'processing' && (
                            <div className="p-4 flex items-center justify-between bg-indigo-50/50">
                                <div className="flex items-center gap-3">
                                    <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">2025年度_給与台帳.xlsx</p>
                                        <p className="text-xs text-slate-500">AI解析中... 仕訳候補を生成しています</p>
                                    </div>
                                </div>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                            </div>
                        )}
                        {uploadStatus === 'success' && (
                            <div className="p-4 flex items-center justify-between bg-emerald-50/50">
                                <div className="flex items-center gap-3">
                                    <Wand2 className="w-5 h-5 text-emerald-600" />
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">2025年度_給与台帳.xlsx</p>
                                        <p className="text-xs text-emerald-600">解析完了 • 仕訳候補を2件生成しました</p>
                                    </div>
                                </div>
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                            </div>
                        )}
                         <div className="p-4 flex items-center justify-between hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                                <FileSpreadsheet className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="text-sm font-medium text-slate-700">2023年度_総勘定元帳.xlsx</p>
                                    <p className="text-xs text-slate-500">2024/05/18 • 完了 (2,450件)</p>
                                </div>
                            </div>
                            <span className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-600">Processed</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-indigo-900 text-white p-6 rounded-xl shadow-lg">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                        <Database className="w-5 h-5 text-indigo-300" />
                        AIデータ連携について
                    </h3>
                    <p className="text-sm text-indigo-100 leading-relaxed mb-4">
                        アップロードされたExcelファイルをAIが解析し、自動的に仕訳候補を作成します。「仕訳入力」画面で確認・承認してください。
                    </p>
                    <div className="bg-indigo-800/50 p-3 rounded border border-indigo-700">
                        <p className="text-xs text-indigo-200">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            セキュリティ: アップロードされたデータは暗号化され、貴社の分析用途以外には使用されません。
                        </p>
                    </div>
                </div>
            </div>
          </div>
      )}

      {activeTab === 'schema' && (
          <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800">
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                      <Code className="w-5 h-5 text-emerald-500" />
                      <h3 className="text-slate-200 font-mono text-sm">Supabase SQL Definition (MQ Accounting)</h3>
                  </div>
                  <button 
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition"
                    onClick={() => navigator.clipboard.writeText(sqlSchema)}
                  >
                      Copy SQL
                  </button>
              </div>
              <div className="p-0 overflow-x-auto">
                  <pre className="p-6 text-xs md:text-sm font-mono text-slate-300 leading-relaxed">
                      <code>{sqlSchema}</code>
                  </pre>
              </div>
          </div>
      )}
    </div>
  );
};
