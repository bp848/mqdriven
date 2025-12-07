
import React, { useState } from 'react';
import { 
  ArrowRight, 
  ScanLine, 
  FileText, 
  CheckCircle2, 
  Truck, 
  CreditCard, 
  Landmark, 
  AlertCircle, 
  FileCheck, 
  Database,
  Receipt,
  Coins,
  HelpCircle
} from 'lucide-react';
import { Page } from '../../../types';

interface WorkflowNavigatorProps {
  navigateTo: (view: Page) => void;
  pendingCount: number;
}

export const WorkflowNavigator: React.FC<WorkflowNavigatorProps> = ({ navigateTo, pendingCount }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'rules'>('daily');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button 
          onClick={() => setActiveTab('daily')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'daily' ? 'bg-white text-indigo-600 border-t-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4" /> 日次業務 (支払・経費・入金)
        </button>
        <button 
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'monthly' ? 'bg-white text-emerald-600 border-t-2 border-emerald-600' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Landmark className="w-4 h-4" /> 月次・決算 (締め処理)
        </button>
        <button 
          onClick={() => setActiveTab('rules')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'rules' ? 'bg-white text-amber-600 border-t-2 border-amber-600' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <HelpCircle className="w-4 h-4" /> 運用ルール・マニュアル
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'daily' && (
          <div className="space-y-8">
            {/* Lane 1: Buying & Expenses */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-rose-100 text-rose-700 p-1.5 rounded-lg"><Truck className="w-4 h-4" /></span>
                <h3 className="font-bold text-slate-800">お金を使う・払う (仕入・経費)</h3>
                <span className="text-xs text-slate-400 ml-2">※ 請求書・領収書を受け取ったら</span>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 items-stretch relative">
                {/* Step 1 */}
                <button onClick={() => navigateTo('fax_ocr_intake')} className="flex-1 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl p-4 text-left transition group relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-400 group-hover:text-rose-400">STEP 1</span>
                    <ScanLine className="w-5 h-5 text-slate-400 group-hover:text-rose-500" />
                  </div>
                  <h4 className="font-bold text-slate-700 mb-1">取込・スキャン</h4>
                  <p className="text-xs text-slate-500 leading-tight">紙の領収書やPDF請求書をドラッグ＆ドロップで取り込みます。</p>
                </button>

                <div className="hidden md:flex items-center justify-center text-slate-300"><ArrowRight /></div>

                {/* Step 2 */}
                <button onClick={() => navigateTo('accounting_journal')} className="flex-1 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl p-4 text-left transition group relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-400 group-hover:text-rose-400">STEP 2</span>
                    <div className="relative">
                      <FileCheck className="w-5 h-5 text-slate-400 group-hover:text-rose-500" />
                      {pendingCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white"></span>}
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-700 mb-1">AI仕訳の承認</h4>
                  <p className="text-xs text-slate-500 leading-tight">AIが作成した仕訳候補を確認し、ボタン一つで承認します。</p>
                </button>

                <div className="hidden md:flex items-center justify-center text-slate-300"><ArrowRight /></div>

                {/* Step 3 */}
                <button onClick={() => navigateTo('purchasing_payments')} className="flex-1 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl p-4 text-left transition group relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-400 group-hover:text-rose-400">STEP 3</span>
                    <CreditCard className="w-5 h-5 text-slate-400 group-hover:text-rose-500" />
                  </div>
                  <h4 className="font-bold text-slate-700 mb-1">支払予定・振込</h4>
                  <p className="text-xs text-slate-500 leading-tight">承認されたデータから振込データ(FB)を作成し、支払を実行します。</p>
                </button>
              </div>
            </div>

            {/* Lane 2: Selling & Income */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-indigo-100 text-indigo-700 p-1.5 rounded-lg"><Coins className="w-4 h-4" /></span>
                <h3 className="font-bold text-slate-800">お金が入る (売上・入金)</h3>
                <span className="text-xs text-slate-400 ml-2">※ 通帳に入金があったら</span>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 items-stretch">
                 {/* Step 1 */}
                 <button onClick={() => navigateTo('sales_billing')} className="flex-1 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl p-4 text-left transition group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-400">STEP 1</span>
                    <Database className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                  </div>
                  <h4 className="font-bold text-slate-700 mb-1">請求データ連携</h4>
                  <p className="text-xs text-slate-500 leading-tight">販売管理システム(MIS)やExcelから請求データを同期します。</p>
                </button>

                <div className="hidden md:flex items-center justify-center text-slate-300"><ArrowRight /></div>

                {/* Step 2 */}
                <button onClick={() => navigateTo('fax_ocr_intake')} className="flex-1 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl p-4 text-left transition group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-400">STEP 2</span>
                    <ScanLine className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                  </div>
                  <h4 className="font-bold text-slate-700 mb-1">通帳取込 (OCR)</h4>
                  <p className="text-xs text-slate-500 leading-tight">通帳コピーやネットバンク明細を取り込み、入金を消し込みます。</p>
                </button>

                <div className="hidden md:flex items-center justify-center text-slate-300"><ArrowRight /></div>

                {/* Step 3 */}
                <button onClick={() => navigateTo('accounting_general_ledger')} className="flex-1 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl p-4 text-left transition group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-400">STEP 3</span>
                    <CheckCircle2 className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                  </div>
                  <h4 className="font-bold text-slate-700 mb-1">資金残高確認</h4>
                  <p className="text-xs text-slate-500 leading-tight">入金後の最新残高と、月末の支払可能額をカレンダーで確認します。</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monthly' && (
           <div className="space-y-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-emerald-100 text-emerald-700 p-1.5 rounded-lg"><Landmark className="w-4 h-4" /></span>
                <h3 className="font-bold text-slate-800">月次決算・分析 (Closing)</h3>
                <span className="text-xs text-slate-400 ml-2">※ 毎月5日〜10日に実施</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <button className="bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-xl p-4 text-left transition group">
                    <div className="mb-2 p-2 bg-slate-100 w-fit rounded-lg group-hover:bg-emerald-100 transition">
                       <Database className="w-5 h-5 text-slate-500 group-hover:text-emerald-600" />
                    </div>
                    <h4 className="font-bold text-slate-700">1. 原価データ確定</h4>
                    <p className="text-xs text-slate-500 mt-1">工場IoT・購買データから今月の製造原価を確定させます。</p>
                 </button>

                 <button className="bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-xl p-4 text-left transition group">
                    <div className="mb-2 p-2 bg-slate-100 w-fit rounded-lg group-hover:bg-emerald-100 transition">
                       <FileText className="w-5 h-5 text-slate-500 group-hover:text-emerald-600" />
                    </div>
                    <h4 className="font-bold text-slate-700">2. 棚卸・税計算</h4>
                    <p className="text-xs text-slate-500 mt-1">WIP(仕掛品)を入力し、消費税・法人税の概算を算出します。</p>
                 </button>

                 <button className="bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-xl p-4 text-left transition group">
                    <div className="mb-2 p-2 bg-slate-100 w-fit rounded-lg group-hover:bg-emerald-100 transition">
                       <AlertCircle className="w-5 h-5 text-slate-500 group-hover:text-emerald-600" />
                    </div>
                    <h4 className="font-bold text-slate-700">3. 予実差異分析</h4>
                    <p className="text-xs text-slate-500 mt-1">計画(MQ)と実績のズレを確認し、来月の対策を立てます。</p>
                 </button>
                 
                 <button className="bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-xl p-4 text-left transition group">
                    <div className="mb-2 p-2 bg-slate-100 w-fit rounded-lg group-hover:bg-emerald-100 transition">
                       <FileCheck className="w-5 h-5 text-slate-500 group-hover:text-emerald-600" />
                    </div>
                    <h4 className="font-bold text-slate-700">4. レポート出力</h4>
                    <p className="text-xs text-slate-500 mt-1">銀行・役員会提出用のMQ会計レポート(PDF)を出力します。</p>
                 </button>
              </div>
           </div>
        )}

        {activeTab === 'rules' && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-slate-200 rounded-lg p-5 bg-amber-50/30">
                 <h4 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> 経費精算ルール
                 </h4>
                 <ul className="text-sm text-slate-700 space-y-2 list-disc pl-4">
                    <li>領収書は受領後<span className="font-bold text-amber-700">3営業日以内</span>にスキャンしてください。</li>
                    <li>交際費が<span className="font-bold text-amber-700">1人5,000円</span>を超える場合は、参加者リストの添付が必須です。</li>
                    <li>タクシー代は「訪問先」「目的」をメモ欄に入力してください。</li>
                 </ul>
              </div>
              <div className="border border-slate-200 rounded-lg p-5 bg-indigo-50/30">
                 <h4 className="font-bold text-indigo-800 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> 請求・入金ルール
                 </h4>
                 <ul className="text-sm text-slate-700 space-y-2 list-disc pl-4">
                    <li>請求書は<span className="font-bold text-indigo-700">毎月25日</span>に締め切り、翌営業日までにMIS連携を行ってください。</li>
                    <li>入金消込は、銀行振込データ取込後、AI推奨リストを確認して<span className="font-bold text-indigo-700">即日確定</span>してください。</li>
                 </ul>
              </div>
               <div className="border border-slate-200 rounded-lg p-5 bg-slate-50/50">
                 <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> システム利用上の注意
                 </h4>
                 <ul className="text-sm text-slate-700 space-y-2 list-disc pl-4">
                    <li>AIの推論結果(確度80%未満)は、必ず<span className="font-bold">「仕訳承認」画面で目視確認</span>してください。</li>
                    <li>修正した仕訳は学習データとして蓄積され、次回以降の精度が向上します。</li>
                 </ul>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowNavigator;
