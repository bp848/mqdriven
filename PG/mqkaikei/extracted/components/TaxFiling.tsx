
import React from 'react';
import { Landmark, CheckSquare, FileText, Calculator, AlertCircle, Save, Database, Server } from 'lucide-react';

interface TaxFilingProps {
  notify?: (message: string, type: 'success' | 'info') => void;
}

export const TaxFiling: React.FC<TaxFilingProps> = ({ notify }) => {
  const steps = [
    { id: 1, label: '売上・仕入の自動計上確認', status: 'done', date: '5/31' },
    { id: 2, label: '仕掛品棚卸 (WIP Import)', status: 'active', date: 'Today' },
    { id: 3, label: '減価償却費計上 (System)', status: 'pending', date: '-' },
    { id: 4, label: '月次損益確定 (Closing)', status: 'pending', date: '-' },
  ];

  const handleAction = (msg: string, type: 'success' | 'info' = 'info') => {
    if (notify) notify(msg, type);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <Landmark className="w-6 h-6 text-indigo-600" />
             月次決算・税務 (Closing & Tax)
           </h2>
           <p className="text-slate-500 text-sm mt-1">正確なMQ算出のための棚卸データ連携と月次確定処理</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Checklist */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-500" />
                5月度 決算プロセス
            </h3>
            <div className="space-y-4">
                {steps.map((step, index) => (
                    <div key={step.id} className="relative flex items-center gap-4">
                        {/* Line connector */}
                        {index !== steps.length - 1 && (
                            <div className={`absolute left-3 top-8 w-0.5 h-8 ${step.status === 'done' ? 'bg-emerald-200' : 'bg-slate-100'}`}></div>
                        )}
                        
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${
                            step.status === 'done' ? 'bg-emerald-500 text-white' : 
                            step.status === 'active' ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 
                            'bg-slate-200 text-slate-400'
                        }`}>
                            {step.status === 'done' ? '✓' : step.id}
                        </div>
                        <div className="flex-1 p-3 rounded-lg border bg-slate-50/50 border-slate-100 flex justify-between items-center">
                            <span className={`text-sm font-medium ${step.status === 'active' ? 'text-indigo-700 font-bold' : 'text-slate-700'}`}>
                                {step.label}
                            </span>
                            <span className="text-xs text-slate-400">{step.date}</span>
                        </div>
                    </div>
                ))}
            </div>
            <button 
                onClick={() => handleAction('次のプロセス「減価償却費計上」へ進みます...', 'info')}
                className="w-full mt-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm"
            >
                プロセスを進める
            </button>
        </div>

        {/* WIP Inventory Input (Critical for Printing MQ) */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Database className="w-5 h-5 text-slate-500" />
                            期末仕掛品・在庫データ連携 (Inventory Link)
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">生産管理システムから最新の仕掛品評価額を取り込みます。</p>
                    </div>
                    <button 
                        onClick={() => handleAction('生産管理システムと同期し、最新の在庫評価額を取得しました。', 'success')}
                        className="bg-indigo-50 text-indigo-700 text-xs px-3 py-1.5 rounded-lg border border-indigo-200 font-bold flex items-center gap-2 hover:bg-indigo-100 transition"
                    >
                        <Server className="w-3 h-3" /> Sync Now
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 opacity-70">
                        <label className="text-xs font-bold text-slate-500 block mb-2">原材料 (Paper/Ink)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">¥</span>
                            <input disabled type="number" className="w-full pl-6 pr-3 py-2 border border-slate-300 rounded bg-slate-100 text-slate-500 font-mono text-right" defaultValue="4500000" />
                        </div>
                        <div className="text-[10px] text-right mt-1 text-slate-400">Auto-synced: 10:00 AM</div>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 ring-2 ring-indigo-200">
                        <label className="text-xs font-bold text-indigo-700 block mb-2">仕掛品 (WIP)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-indigo-400 text-sm">¥</span>
                            <input disabled type="number" className="w-full pl-6 pr-3 py-2 border border-indigo-300 bg-white rounded font-mono text-right font-bold text-indigo-900" defaultValue="2800000" />
                        </div>
                        <div className="text-[10px] text-right mt-1 text-indigo-500 font-bold">Live Data from Factory IoT</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 opacity-70">
                        <label className="text-xs font-bold text-slate-500 block mb-2">製品他</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">¥</span>
                            <input disabled type="number" className="w-full pl-6 pr-3 py-2 border border-slate-300 rounded bg-slate-100 text-slate-500 font-mono text-right" defaultValue="500000" />
                        </div>
                        <div className="text-[10px] text-right mt-1 text-slate-400">Auto-synced: 10:00 AM</div>
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={() => handleAction('在庫評価額を確定し、仕訳を生成しました。', 'success')}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded hover:bg-slate-700 transition"
                    >
                        <Save className="w-4 h-4" /> 評価額を確定する
                    </button>
                </div>
            </div>

            {/* Tax Estimation */}
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm text-white">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-indigo-400" />
                    税額自動計算 (AI Estimation)
                </h3>
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <p className="text-xs text-slate-400 mb-1">消費税 (予定納税額)</p>
                        <p className="text-2xl font-mono font-bold text-white">¥1,250,000</p>
                        <p className="text-xs text-slate-500 mt-1">仮受消費税 - 仮払消費税</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1">法人税等 (充当金繰入)</p>
                        <p className="text-2xl font-mono font-bold text-white">¥840,000</p>
                        <p className="text-xs text-slate-500 mt-1">税引前利益 x 30% (概算)</p>
                    </div>
                </div>
                <div className="mt-4 p-3 bg-slate-800 rounded border border-slate-700 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-xs text-slate-300 leading-relaxed">
                        今月は大型の設備投資(CTP更新)があったため、消費税の還付が発生する可能性があります。
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
