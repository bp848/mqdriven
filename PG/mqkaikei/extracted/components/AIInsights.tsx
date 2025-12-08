import React from 'react';
import { Sparkles, TrendingDown, ArrowRight, LineChart, AlertOctagon } from 'lucide-react';

export const AIInsights: React.FC = () => {
  return (
    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-inner">
               <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-white tracking-wide">STRAC AI Analyst</h2>
                <p className="text-xs text-slate-400">MQ会計データに基づく戦略提案</p>
            </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
            Real-time Monitoring
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Insight 1: VQアラート */}
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors group">
            <div className="flex items-start space-x-3">
                <div className="bg-rose-500/10 p-2 rounded-lg shrink-0 group-hover:bg-rose-500/20 transition">
                    <TrendingDown className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-200 text-sm mb-1">MQ率低下アラート</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">
                        オフセット部門にて、用紙仕入単価の上昇により<span className="text-rose-400 font-bold">V率が+2.3%悪化</span>しています。P(売価)への転嫁または仕入先見直しが必要です。
                    </p>
                    <button className="flex items-center text-xs text-rose-400 font-medium hover:text-rose-300 transition-colors">
                        原価シミュレーション <ArrowRight className="w-3 h-3 ml-1" />
                    </button>
                </div>
            </div>
        </div>

        {/* Insight 2: F回収予測 */}
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors group">
            <div className="flex items-start space-x-3">
                <div className="bg-amber-500/10 p-2 rounded-lg shrink-0 group-hover:bg-amber-500/20 transition">
                    <LineChart className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-200 text-sm mb-1">F(固定費)回収予測</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">
                        現在、当月の固定費(F)回収率は<span className="text-amber-400 font-bold">100%に到達</span>しました。これ以降のMQはすべてG(利益)となります。
                    </p>
                    <button className="flex items-center text-xs text-amber-400 font-medium hover:text-amber-300 transition-colors">
                        損益分岐点詳細 <ArrowRight className="w-3 h-3 ml-1" />
                    </button>
                </div>
            </div>
        </div>

        {/* Insight 3: 資金繰り・OCR */}
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors group">
            <div className="flex items-start space-x-3">
                <div className="bg-emerald-500/10 p-2 rounded-lg shrink-0 group-hover:bg-emerald-500/20 transition">
                    <AlertOctagon className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-200 text-sm mb-1">入出金スケジュール</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">
                        25日に大型の出金(機械リース料)があります。銀行明細OCRによる最新残高との照合は完了しており、資金ショートの懸念はありません。
                    </p>
                    <button className="flex items-center text-xs text-emerald-400 font-medium hover:text-emerald-300 transition-colors">
                        資金繰り表を確認 <ArrowRight className="w-3 h-3 ml-1" />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};