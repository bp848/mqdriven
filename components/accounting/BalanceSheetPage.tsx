import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import { getFinancialStatements } from '../../services/dataService';

const BalanceSheetPage: React.FC = () => {
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
      // BSは期首〜当月末の累計
      const startDate = month >= 4 ? `${year}-04-01` : `${year - 1}-04-01`;
      const endOfMonth = new Date(year, month, 0);
      const endDate = `${endOfMonth.getFullYear()}-${(endOfMonth.getMonth() + 1).toString().padStart(2, '0')}-${endOfMonth.getDate().toString().padStart(2, '0')}`;
      const result = await getFinancialStatements({ startDate, endDate });
      setData(result);
    } catch (err) {
      setError('貸借対照表データの読み込みに失敗しました。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { assetRows, liabilityEquityRows, totalAssets, totalLiabilitiesEquity } = useMemo(() => {
    const assets: { code: string; name: string; amount: number }[] = [];
    const liabEquity: { code: string; name: string; amount: number }[] = [];
    let totA = 0;
    let totLE = 0;

    data.forEach((row: any) => {
      const section = row.section || '';
      const amount = Number(row.amount) || 0;
      const item = {
        code: row.account_code || row.code || '',
        name: row.account_name || row.name || '',
        amount,
      };

      if (section === 'balance_sheet_asset' || section === 'ASSETS') {
        assets.push(item);
        totA += amount;
      } else if (section === 'balance_sheet_liability_equity' || section === 'LIABILITIES' || section === 'EQUITY') {
        liabEquity.push(item);
        totLE += amount;
      }
    });

    assets.sort((a, b) => b.amount - a.amount);
    liabEquity.sort((a, b) => b.amount - a.amount);

    return {
      assetRows: assets,
      liabilityEquityRows: liabEquity,
      totalAssets: totA,
      totalLiabilitiesEquity: totLE,
    };
  }, [data]);

  const fmt = (v: number) => `¥${v.toLocaleString()}`;
  const diff = totalAssets - totalLiabilitiesEquity;
  const [y, m] = period.split('-').map(Number);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg text-slate-800">貸借対照表</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded hover:bg-slate-200 transition text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40" />
            <button onClick={() => shiftMonth(1)} className="p-1.5 rounded hover:bg-slate-200 transition text-slate-500"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1">{y}年{m}月{new Date(y, m, 0).getDate()}日 現在</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 border-b border-slate-200 divide-x divide-slate-200">
        <div className="p-3 text-center">
          <p className="text-[10px] text-blue-600 uppercase tracking-wide font-bold">資産合計</p>
          <p className="font-mono font-bold text-blue-700">{fmt(totalAssets)}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-orange-600 uppercase tracking-wide font-bold">負債・純資産合計</p>
          <p className="font-mono font-bold text-orange-700">{fmt(totalLiabilitiesEquity)}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">貸借差額</p>
          <p className={`font-mono font-bold ${diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
            {diff === 0 ? '一致' : fmt(diff)}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full"><Loader className="w-8 h-8 animate-spin text-indigo-600" /></div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">{error}</div>
        ) : assetRows.length === 0 && liabilityEquityRows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">この期間の貸借対照表データはありません</div>
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
              {/* 資産の部 */}
              <tr className="bg-blue-50/50">
                <td colSpan={3} className="px-4 py-2 font-bold text-blue-700 text-xs uppercase tracking-wide border-b border-slate-200">
                  資産の部
                </td>
              </tr>
              {assetRows.map((row, i) => (
                <tr key={`a-${i}`} className="hover:bg-blue-50/20 border-b border-slate-100">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{row.code}</td>
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(row.amount)}</td>
                </tr>
              ))}
              <tr className="bg-blue-50/30 font-bold border-b-2 border-blue-200">
                <td className="px-4 py-2" colSpan={2}>資産合計</td>
                <td className="px-4 py-2 text-right font-mono text-blue-700">{fmt(totalAssets)}</td>
              </tr>

              {/* 負債・純資産の部 */}
              <tr className="bg-orange-50/50">
                <td colSpan={3} className="px-4 py-2 font-bold text-orange-700 text-xs uppercase tracking-wide border-b border-slate-200">
                  負債・純資産の部
                </td>
              </tr>
              {liabilityEquityRows.map((row, i) => (
                <tr key={`le-${i}`} className="hover:bg-orange-50/20 border-b border-slate-100">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{row.code}</td>
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(row.amount)}</td>
                </tr>
              ))}
              <tr className="bg-orange-50/30 font-bold border-b-2 border-orange-200">
                <td className="px-4 py-2" colSpan={2}>負債・純資産合計</td>
                <td className="px-4 py-2 text-right font-mono text-orange-700">{fmt(totalLiabilitiesEquity)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default BalanceSheetPage;
