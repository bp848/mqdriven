import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import { Calendar, TrendingUp, TrendingDown, AlertCircle, ArrowRight, Target } from 'lucide-react';

// 予実データ型定義
interface VarianceItem {
  name: string;
  plan: number;
  actual: number;
  diff: number;
  percent: number; // 達成率
}

// モックデータ: 2024年5月の予実
const varianceData: VarianceItem[] = [
  { name: 'PQ (売上)', plan: 25000, actual: 24200, diff: -800, percent: 96.8 },
  { name: 'VQ (変動費)', plan: 11250, actual: 11500, diff: 250, percent: 102.2 }, // VQは低い方が良いが、ここでは数値通りの達成率
  { name: 'MQ (粗利)', plan: 13750, actual: 12700, diff: -1050, percent: 92.4 },
  { name: 'F (固定費)', plan: 9800, actual: 9650, diff: -150, percent: 98.5 }, // Fは低い方が良い
  { name: 'G (利益)', plan: 3950, actual: 3050, diff: -900, percent: 77.2 },
];

const formatCurrency = (val: number) => val.toLocaleString();

export const MonthlyVariance: React.FC = () => {
  // MQ率の計算
  const planMQRate = (13750 / 25000) * 100;
  const actMQRate = (12700 / 24200) * 100;
  const mqRateDiff = actMQRate - planMQRate;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-indigo-600" />
            予実管理 (Budget vs Actual)
          </h2>
          <p className="text-slate-500 text-sm mt-1">経営計画(PLAN)と会計実績(ACTUAL)の差異分析</p>
        </div>
        
        <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm p-1">
            <button className="p-2 hover:bg-slate-100 rounded transition text-slate-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex items-center px-4 gap-2 font-bold text-slate-700 border-x border-slate-100">
                <Calendar className="w-4 h-4 text-indigo-500" />
                2024年 5月
            </div>
            <button className="p-2 hover:bg-slate-100 rounded transition text-slate-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* G (Profit) Performance */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">G: 経常利益 達成率</h3>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-black text-slate-800">77.2%</span>
                        <span className="text-xs font-bold text-red-500 flex items-center">
                            <TrendingDown className="w-3 h-3 mr-1" /> 未達
                        </span>
                    </div>
                </div>
                <div className="p-3 bg-indigo-50 rounded-full">
                    <Target className="w-6 h-6 text-indigo-600" />
                </div>
            </div>
            
            <div className="space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500">計画 (Plan)</span>
                    <span className="font-bold text-slate-700">¥3,950k</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500">実績 (Actual)</span>
                    <span className="font-bold text-slate-800">¥3,050k</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between text-sm">
                    <span className="text-slate-500 font-medium">差異 (Variance)</span>
                    <span className="font-bold text-red-600">▲ ¥900k</span>
                </div>
            </div>
            
            <div className="absolute bottom-0 left-0 h-1.5 bg-slate-100 w-full">
                <div className="h-full bg-red-500" style={{ width: '77.2%' }}></div>
            </div>
        </div>

        {/* MQ Rate Analysis */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-4">MQ率 (付加価値率) 分析</h3>
            
            <div className="flex items-center justify-center gap-8 mb-6">
                <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">計画 MQ率</p>
                    <p className="text-2xl font-bold text-slate-400">{planMQRate.toFixed(1)}%</p>
                </div>
                <div className="text-center">
                    <ArrowRight className="w-5 h-5 text-slate-300" />
                </div>
                <div className="text-center">
                    <p className="text-xs text-indigo-600 font-bold mb-1">実績 MQ率</p>
                    <p className="text-3xl font-black text-indigo-600">{actMQRate.toFixed(1)}%</p>
                </div>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                    <p className="text-xs font-bold text-red-700">MQ率悪化要因</p>
                    <p className="text-xs text-red-600 mt-1">
                        VQ(変動費)の実績が計画を上回っています。用紙代または外注費の単価上昇を確認してください。
                    </p>
                </div>
            </div>
        </div>

         {/* F (Fixed Cost) Analysis */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-4">F: 固定費 消化状況</h3>
            
            <div className="space-y-4">
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 font-medium">予算消化率</span>
                        <span className="text-slate-800 font-bold">98.5%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '98.5%' }}></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="p-3 bg-slate-50 rounded border border-slate-100">
                        <p className="text-[10px] text-slate-500 mb-1">人件費</p>
                        <p className="font-bold text-slate-700 text-sm">Wait</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded border border-slate-100">
                        <p className="text-[10px] text-slate-500 mb-1">その他経費</p>
                        <p className="font-bold text-emerald-600 text-sm">Good</p>
                    </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                    固定費は予算内で推移しています。このペースを維持してください。
                </p>
            </div>
        </div>
      </div>

      {/* Main Variance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <h3 className="font-bold text-slate-800">予実差異明細 (Variance Detail)</h3>
             <div className="flex gap-2">
                 <button className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-600 hover:bg-slate-50">
                     CSV出力
                 </button>
             </div>
        </div>
        <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                    <th className="px-6 py-4">項目 (Item)</th>
                    <th className="px-6 py-4 text-right">計画 (Plan)</th>
                    <th className="px-6 py-4 text-right">実績 (Actual)</th>
                    <th className="px-6 py-4 text-right">差異 (Diff)</th>
                    <th className="px-6 py-4 text-right">達成率 (%)</th>
                    <th className="px-6 py-4 w-48">Status</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {varianceData.map((row) => {
                    const isNegative = row.name.includes('VQ') || row.name.includes('F') ? row.diff > 0 : row.diff < 0;
                    const diffColor = isNegative ? 'text-red-600' : 'text-emerald-600';
                    const diffSign = row.diff > 0 ? '+' : '';
                    
                    // バーの色: 利益(G)や売上(PQ)は高いほうが良い、費用(VQ, F)は低いほうが良い
                    // ここではシンプルに達成率100%基準で表示
                    
                    return (
                        <tr key={row.name} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-bold text-slate-700">{row.name}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(row.plan)}</td>
                            <td className="px-6 py-4 text-right font-mono font-bold">{formatCurrency(row.actual)}</td>
                            <td className={`px-6 py-4 text-right font-mono font-bold ${diffColor}`}>
                                {diffSign}{formatCurrency(row.diff)}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-slate-800">
                                {row.percent.toFixed(1)}%
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${isNegative ? 'bg-red-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${Math.min(row.percent, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6">項目別予実比較</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={varianceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 11}} interval={0} />
                        <YAxis hide />
                        <Tooltip 
                            cursor={{fill: 'transparent'}}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="plan" name="計画" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actual" name="実績" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
              </div>
          </div>
          
          <div className="bg-indigo-900 p-6 rounded-xl border border-indigo-800 shadow-sm text-white flex flex-col justify-center items-center text-center">
                <div className="p-4 bg-indigo-800 rounded-full mb-4">
                    <Target className="w-8 h-8 text-indigo-300" />
                </div>
                <h3 className="text-xl font-bold mb-2">来期シミュレーション</h3>
                <p className="text-indigo-200 text-sm mb-6 max-w-xs">
                    現在の達成率(77.2%)が続いた場合の、期末着地見込みを算出します。
                </p>
                <button className="px-6 py-3 bg-white text-indigo-900 font-bold rounded-lg hover:bg-indigo-50 transition shadow-lg w-full max-w-xs">
                    着地見込みを計算する
                </button>
          </div>
      </div>
    </div>
  );
};