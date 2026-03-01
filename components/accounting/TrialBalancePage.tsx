import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader } from 'lucide-react';
import { getTrialBalanceData } from '../../services/dataService';

const CATEGORY_ORDER: Record<string, number> = {
  ASSETS: 0,
  LIABILITIES: 1,
  EQUITY: 2,
  REVENUE: 3,
  EXPENSE: 4,
  balance_sheet_asset: 0,
  balance_sheet_liability_equity: 1,
  income_statement_revenue: 3,
  income_statement_expense: 4,
};

const CATEGORY_LABELS: Record<string, string> = {
  ASSETS: '資産',
  LIABILITIES: '負債',
  EQUITY: '純資産',
  REVENUE: '収益',
  EXPENSE: '費用',
  balance_sheet_asset: '資産',
  balance_sheet_liability_equity: '負債・純資産',
  income_statement_revenue: '収益',
  income_statement_expense: '費用',
};

const TrialBalancePage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [year, month] = period.split('-').map(Number);
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endOfMonth = new Date(year, month, 0);
      const endDate = `${endOfMonth.getFullYear()}-${(endOfMonth.getMonth() + 1).toString().padStart(2, '0')}-${endOfMonth.getDate().toString().padStart(2, '0')}`;
      const result = await getTrialBalanceData({ startDate, endDate });
      setData(result);
    } catch (err) {
      setError('試算表データの読み込みに失敗しました。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { grouped, totals } = useMemo(() => {
    const groups: Record<string, any[]> = {};
    let totalDebit = 0;
    let totalCredit = 0;

    data.forEach((row: any) => {
      const section = row.section || row.category_code || row.category || 'OTHER';
      if (!groups[section]) groups[section] = [];

      const debit = row.debit ?? row.debit_total ?? (row.amount > 0 ? row.amount : 0) ?? 0;
      const credit = row.credit ?? row.credit_total ?? (row.amount < 0 ? Math.abs(row.amount) : 0) ?? 0;
      const balance = debit - credit;

      groups[section].push({
        code: row.account_code || row.code || '',
        name: row.account_name || row.name || row.account || '',
        debit,
        credit,
        balance,
      });
      totalDebit += debit;
      totalCredit += credit;
    });

    const sortedGroups = Object.entries(groups).sort(
      ([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99)
    );

    return {
      grouped: sortedGroups,
      totals: { debit: totalDebit, credit: totalCredit },
    };
  }, [data]);

  const shiftMonth = (delta: number) => {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setPeriod(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg text-slate-800">残高試算表</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded hover:bg-slate-200 transition text-slate-500">&lt;</button>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40" />
            <button onClick={() => shiftMonth(1)} className="p-1.5 rounded hover:bg-slate-200 transition text-slate-500">&gt;</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full"><Loader className="w-8 h-8 animate-spin text-indigo-600" /></div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">{error}</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">この期間の試算表データはありません</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 w-24">科目コード</th>
                <th className="px-4 py-3 border-b border-slate-200">勘定科目</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right w-36">借方</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right w-36">貸方</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right w-36">残高</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700">
              {grouped.map(([section, rows]) => (
                <React.Fragment key={section}>
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-4 py-2 font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">
                      {CATEGORY_LABELS[section] || section}
                    </td>
                  </tr>
                  {rows.map((row: any, i: number) => (
                    <tr key={`${section}-${i}`} className="hover:bg-indigo-50/30 border-b border-slate-100">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{row.code}</td>
                      <td className="px-4 py-2.5 font-medium">{row.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{row.debit > 0 ? `¥${row.debit.toLocaleString()}` : ''}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{row.credit > 0 ? `¥${row.credit.toLocaleString()}` : ''}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">{row.balance !== 0 ? `¥${row.balance.toLocaleString()}` : ''}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-sm border-t-2 border-slate-300">
              <tr>
                <td className="px-4 py-3" colSpan={2}>合計</td>
                <td className="px-4 py-3 text-right font-mono">¥{totals.debit.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">¥{totals.credit.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {totals.debit === totals.credit
                    ? <span className="text-green-600 text-xs">貸借一致</span>
                    : <span className="text-red-600">差額 ¥{Math.abs(totals.debit - totals.credit).toLocaleString()}</span>
                  }
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};

export default TrialBalancePage;
