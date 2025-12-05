import React from 'react';
import { Page } from '../../types';
// import { WorkflowNavigator } from './WorkflowNavigator'; // This component does not exist yet.
import { Bell, CheckCircle2, Clock } from 'lucide-react';

interface AccountingDashboardProps {
  setCurrentView: (view: Page) => void;
  pendingDraftsCount?: number;
}

export const AccountingDashboard: React.FC<AccountingDashboardProps> = ({ setCurrentView, pendingDraftsCount = 0 }) => {

  return (
    <div className="space-y-6">
      
      {/* Intro Section */}
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800">
         <h1 className="text-xl font-bold mb-2">会計ダッシュボード</h1>
         <p className="text-slate-400 text-sm">
            AIによる仕訳候補が {pendingDraftsCount} 件あります。
         </p>
      </div>

      {/* To-Do List (Actionable Items Only) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-slate-700 flex items-center gap-2">
                     <Bell className="w-4 h-4 text-indigo-500" /> タスク
                 </h3>
                 <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{pendingDraftsCount}件</span>
             </div>
             <div className="divide-y divide-slate-100">
                 <button onClick={() => setCurrentView('accounting_journal_review')} className="w-full text-left p-4 hover:bg-slate-50 transition flex items-start gap-3 group">
                     <div className="mt-1 w-2 h-2 rounded-full bg-red-500"></div>
                     <div className="flex-1">
                         <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">AI仕訳の承認待ち</p>
                         <p className="text-xs text-slate-500 mt-1">{pendingDraftsCount}件 の確認が必要です。</p>
                     </div>
                 </button>
                 <button onClick={() => setCurrentView('accounting_payables')} className="w-full text-left p-4 hover:bg-slate-50 transition flex items-start gap-3 group">
                     <div className="mt-1 w-2 h-2 rounded-full bg-amber-500"></div>
                     <div className="flex-1">
                         <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">支払管理</p>
                         <p className="text-xs text-slate-500 mt-1">支払期日が近い項目を確認します。</p>
                     </div>
                 </button>
                 <button onClick={() => setCurrentView('accounting_receivables')} className="w-full text-left p-4 hover:bg-slate-50 transition flex items-start gap-3 group">
                     <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500"></div>
                     <div className="flex-1">
                         <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">売掛金管理</p>
                         <p className="text-xs text-slate-500 mt-1">入金期日が近い項目を確認します。</p>
                     </div>
                 </button>
             </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-slate-700 flex items-center gap-2">
                     <Clock className="w-4 h-4 text-emerald-500" /> 最近の処理
                 </h3>
             </div>
             <div className="divide-y divide-slate-100">
                 <div className="p-4 flex items-center gap-3 opacity-60">
                     <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                     <div className="flex-1">
                         <p className="text-sm font-medium text-slate-700">仕訳承認 (Batch #123)</p>
                     </div>
                     <div className="text-xs text-slate-400">09:15</div>
                 </div>
             </div>
          </div>
      </div>
    </div>
  );
};

export default AccountingDashboard;