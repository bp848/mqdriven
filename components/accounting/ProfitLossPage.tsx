import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import { getFinancialStatements } from '../../services/dataService';

const ProfitLossPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  const shiftMonth = (delta: number) => {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setPeriod(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [year, month] = period.split('-').map(Number);
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endOfMonth = new Date(year, month, 0);
      const endDate = `${endOfMonth.getFullYear()}-${(endOfMonth.getMonth() + 1).toString().padStart(2, '0')}-${endOfMonth.getDate().toString().padStart(2, '0')}`;
      const result = await getFinancialStatements({ startDate, endDate });
      setData(result);
    } catch (err) {
      setError('損益計算書データの読み込みに失敗しました。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { revenueRows, expenseRows, totalRevenue, totalExpense, netIncome } = useMemo(() => {
    const revenue: { code: string; name: string; amount: number }[] = [];
    const expense: { code: string; name: string; amount: number }[] = [];
    let totRev = 0;
    let totExp = 0;

    data.forEach((row: any) => {
      const section = row.section || '';
      const amount = Number(row.amount) || 0;
      const item = {
        code: row.account_code || row.code || '',
        name: row.account_name || row.name || '',
        amount,
      };

      if (section === 'income_statement_revenue' || section === 'REVENUE') {
        revenue.push(item);
        totRev += amount;
      } else if (section === 'income_statement_expense' || section === 'EXPENSE') {
        expense.push(item);
        totExp += amount;
      }
    });

    revenue.sort((a, b) => b.amount - a.amount);
    expense.sort((a, b) => b.amount - a.amount);

    return {
      revenueRows: revenue,
      expenseRows: expense,
      totalRevenue: totRev,
      totalExpense: totExp,
      netIncome: totRev - totExp,
    };
  }, [data]);

  const fmt = (v: number) => `¥${v.toLocaleString()}`;
  const [y, m] = period.split('-').map(Number);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg text-slate-800">損益計算書</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded hover:bg-slate-200 transition text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40" />
            <button onClick={() => shiftMonth(1)} className="p-1.5 rounded hover:bg-slate-200 transition text-slate-500"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1">{y}年{m}月1日 〜 {y}年{m}月{new Date(y, m, 0).getDate()}日</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 border-b border-slate-200 divide-x divide-slate-200">
        <div className="p-3 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">売上高</p>
          <p className="font-mono font-medium text-slate-700">{fmt(totalRevenue)}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">費用合計</p>
          <p className="font-mono font-medium text-red-600">{fmt(totalExpense)}</p>
        </div>
        <div className={`p-3 text-center ${netIncome >= 0 ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
          <p className="text-[10px] uppercase tracking-wide font-bold" style={{ color: netIncome >= 0 ? '#059669' : '#dc2626' }}>
            {netIncome >= 0 ? '当期純利益' : '当期純損失'}
          </p>
          <p className={`font-mono font-bold ${netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(netIncome)}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full"><Loader className="w-8 h-8 animate-spin text-indigo-600" /></div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">{error}</div>
        ) : revenueRows.length === 0 && expenseRows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">この期間の損益データはありません</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 w-24">科目コード</th>
                <th className="px-4 py-3 border-b border-slate-200">勘定科目</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right w-40">金額</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700">
              {/* 収益セクション */}
              <tr className="bg-green-50/50">
                <td colSpan={3} className="px-4 py-2 font-bold text-green-700 text-xs uppercase tracking-wide border-b border-slate-200">
                  収益（売上高）
                </td>
              </tr>
              {revenueRows.map((row, i) => (
                <tr key={`rev-${i}`} className="hover:bg-green-50/20 border-b border-slate-100">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{row.code}</td>
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(row.amount)}</td>
                </tr>
              ))}
              <tr className="bg-green-50/30 font-bold border-b border-slate-200">
                <td className="px-4 py-2" colSpan={2}>収益合計</td>
                <td className="px-4 py-2 text-right font-mono">{fmt(totalRevenue)}</td>
              </tr>

              {/* 費用セクション */}
              <tr className="bg-red-50/50">
                <td colSpan={3} className="px-4 py-2 font-bold text-red-700 text-xs uppercase tracking-wide border-b border-slate-200">
                  費用
                </td>
              </tr>
              {expenseRows.map((row, i) => (
                <tr key={`exp-${i}`} className="hover:bg-red-50/20 border-b border-slate-100">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{row.code}</td>
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(row.amount)}</td>
                </tr>
              ))}
              <tr className="bg-red-50/30 font-bold border-b border-slate-200">
                <td className="px-4 py-2" colSpan={2}>費用合計</td>
                <td className="px-4 py-2 text-right font-mono">{fmt(totalExpense)}</td>
              </tr>
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-sm border-t-2 border-slate-300">
              <tr>
                <td className="px-4 py-3" colSpan={2}>{netIncome >= 0 ? '当期純利益' : '当期純損失'}</td>
                <td className={`px-4 py-3 text-right font-mono ${netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {fmt(netIncome)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};

export default ProfitLossPage;
