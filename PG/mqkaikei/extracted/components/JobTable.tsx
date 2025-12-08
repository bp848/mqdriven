import React from 'react';

// MQ会計データの型定義
interface DepartmentMQItem {
  id: string;
  department: string;
  pq: number; // 売上高
  vq: number; // 変動費
  mq: number; // 付加価値
  mqRate: number; // MQ率
  f: number;  // 固定費（個別固定費 + 配賦）
  g: number;  // 利益
}

// 経営計画データに基づく部門別予算
const mqData: DepartmentMQItem[] = [
  { id: '1', department: 'オフセット印刷部門', pq: 14500, vq: 8200, mq: 6300, mqRate: 43.4, f: 3800, g: 2500 },
  { id: '2', department: 'デジタル印刷部門', pq: 7200, vq: 2100, mq: 5100, mqRate: 70.8, f: 2900, g: 2200 },
  { id: '3', department: '製本・加工部門', pq: 3300, vq: 950, mq: 2350, mqRate: 71.2, f: 3100, g: -750 },
  { id: 'total', department: '全社合計 (計画)', pq: 25000, vq: 11250, mq: 13750, mqRate: 55.0, f: 9800, g: 3950 },
];

const formatCurrency = (val: number) => {
    return val.toLocaleString();
};

export const JobTable: React.FC = () => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-600">
        <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 w-1/4">部門 (Department)</th>
            <th className="px-6 py-4 text-right text-indigo-600 bg-indigo-50/10">PQ (売上高)</th>
            <th className="px-6 py-4 text-right text-slate-500">VQ (変動費)</th>
            <th className="px-6 py-4 text-right text-sky-600 font-bold bg-sky-50/10">MQ (付加価値)</th>
            <th className="px-6 py-4 text-right text-sky-600">MQ率 (%)</th>
            <th className="px-6 py-4 text-right text-amber-600">F (固定費)</th>
            <th className="px-6 py-4 text-right text-emerald-600 font-bold bg-emerald-50/10">G (利益)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {mqData.map((row) => {
            const isTotal = row.id === 'total';
            const rowClass = isTotal ? 'bg-slate-50/80 font-bold text-slate-800 border-t-2 border-slate-200' : 'hover:bg-slate-50/30';
            const gClass = row.g < 0 ? 'text-red-600' : 'text-emerald-700';

            return (
              <tr key={row.id} className={`${rowClass} transition-colors`}>
                <td className="px-6 py-4 font-medium flex items-center gap-2">
                  {isTotal && <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded">PLAN</span>}
                  {row.department}
                </td>
                <td className="px-6 py-4 text-right bg-indigo-50/5 font-medium">
                   {formatCurrency(row.pq)}
                </td>
                <td className="px-6 py-4 text-right text-slate-500">
                   {formatCurrency(row.vq)}
                </td>
                <td className="px-6 py-4 text-right text-sky-700 font-bold bg-sky-50/10">
                   {formatCurrency(row.mq)}
                </td>
                <td className="px-6 py-4 text-right text-sky-600">
                   {row.mqRate.toFixed(1)}%
                </td>
                <td className="px-6 py-4 text-right text-amber-700">
                   {formatCurrency(row.f)}
                </td>
                 <td className={`px-6 py-4 text-right font-bold bg-emerald-50/10 ${gClass}`}>
                   {row.g < 0 ? '▲' : ''} {formatCurrency(Math.abs(row.g))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="p-4 bg-slate-50 text-xs text-slate-400 text-center border-t border-slate-200">
         <div className="flex justify-center gap-6">
             <span>引用元データ: 2025年度_経営計画書.xlsx</span>
             <span>最終更新: 2024/05/20 14:30</span>
         </div>
      </div>
    </div>
  );
};