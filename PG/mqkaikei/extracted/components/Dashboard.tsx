
import React from 'react';
import { ViewState } from '../App';
import { WorkflowNavigator } from './WorkflowNavigator';
import { Bell, CheckCircle2, Clock } from 'lucide-react';

interface DashboardProps {
  setCurrentView?: (view: ViewState) => void;
  pendingDraftsCount?: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ setCurrentView, pendingDraftsCount = 0 }) => {
  const navigateTo = (view: ViewState) => {
    if (setCurrentView) setCurrentView(view);
  };

  return (
    <div className="space-y-6">
      
      {/* Intro Section */}
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800">
         <h1 className="text-xl font-bold mb-2">おはようございます、山田さん</h1>
         <p className="text-slate-400 text-sm">
            本日は <span className="text-indigo-400 font-bold">2024年5月22日 (水)</span> です。<br/>
            銀行データの取込と、未処理のAI仕訳が {pendingDraftsCount} 件あります。
         </p>
      </div>

      {/* Main Workflow Navigation */}
      <WorkflowNavigator navigateTo={navigateTo} pendingCount={pendingDraftsCount} />

      {/* To-Do List (Actionable Items Only) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-slate-700 flex items-center gap-2">
                     <Bell className="w-4 h-4 text-indigo-500" /> 今日のタスク (To-Do)
                 </h3>
                 <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">3件</span>
             </div>
             <div className="divide-y divide-slate-100">
                 <button onClick={() => navigateTo('journal')} className="w-full text-left p-4 hover:bg-slate-50 transition flex items-start gap-3 group">
                     <div className="mt-1 w-2 h-2 rounded-full bg-red-500"></div>
                     <div className="flex-1">
                         <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">AI仕訳の承認待ち</p>
                         <p className="text-xs text-slate-500 mt-1">OCR取込データなど {pendingDraftsCount}件 の確認が必要です。</p>
                     </div>
                     <div className="text-xs text-slate-400">09:00</div>
                 </button>
                 <button onClick={() => navigateTo('payables')} className="w-full text-left p-4 hover:bg-slate-50 transition flex items-start gap-3 group">
                     <div className="mt-1 w-2 h-2 rounded-full bg-amber-500"></div>
                     <div className="flex-1">
                         <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">支払手形の期日確認</p>
                         <p className="text-xs text-slate-500 mt-1">5/31期日の手形発行準備をしてください。</p>
                     </div>
                     <div className="text-xs text-slate-400">Yesterday</div>
                 </button>
                 <button onClick={() => navigateTo('approved_applications')} className="w-full text-left p-4 hover:bg-slate-50 transition flex items-start gap-3 group">
                     <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500"></div>
                     <div className="flex-1">
                         <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">稟議書の最終承認</p>
                         <p className="text-xs text-slate-500 mt-1">「ハイデルベルグ交換部品購入」の決裁完了を確認。</p>
                     </div>
                     <div className="text-xs text-slate-400">5/20</div>
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
                         <p className="text-sm font-medium text-slate-700">請求書PDF取込 (25件)</p>
                         <p className="text-xs text-slate-500">AI-OCR解析完了</p>
                     </div>
                     <div className="text-xs text-slate-400">08:45</div>
                 </div>
                 <div className="p-4 flex items-center gap-3 opacity-60">
                     <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                     <div className="flex-1">
                         <p className="text-sm font-medium text-slate-700">工場IoTデータ同期</p>
                         <p className="text-xs text-slate-500">小森GL-840P 稼働データ取得</p>
                     </div>
                     <div className="text-xs text-slate-400">08:00</div>
                 </div>
             </div>
             <div className="p-3 bg-slate-50 text-center border-t border-slate-200">
                 <button onClick={() => navigateTo('ocr')} className="text-xs font-bold text-indigo-600 hover:underline">
                     すべての履歴を見る
                 </button>
             </div>
          </div>
      </div>
    </div>
  );
};
