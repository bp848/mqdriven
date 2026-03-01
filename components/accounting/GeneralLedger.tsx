import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Calendar, Filter, ChevronDown, Printer, Loader } from 'lucide-react';
import { AccountItem, GeneralLedgerEntry, JournalEntry } from '../../types';
import * as dataService from '../../services/dataService';

const formatCurrency = (val: number | null) => {
  if (val === null || val === undefined) return '';
  return val.toLocaleString();
};

interface GeneralLedgerProps {
  entries?: JournalEntry[];
  accountItems?: AccountItem[];
}

const GeneralLedger: React.FC<GeneralLedgerProps> = () => {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [ledgerData, setLedgerData] = useState<GeneralLedgerEntry[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  });

  const accountInfo = accounts.find(a => a.id === selectedAccount);

  const loadAccounts = useCallback(async () => {
    try {
      const items = await dataService.getActiveAccountItems();
      const mappedItems = items.map(i => ({...i, id: i.id || '', code: i.code || '', name: i.name || '', categoryCode: i.categoryCode || ''}));
      setAccounts(mappedItems);
      if (mappedItems.length > 0) {
        setSelectedAccount(mappedItems[0].id);
      }
    } catch (err) {
      setError('勘定科目の読み込みに失敗しました。');
      console.error(err);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    if (!selectedAccount) return;
    setIsLoading(true);
    setError(null);
    try {
        const [year, month] = period.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0).toISOString();

      const data = await dataService.getGeneralLedger(selectedAccount, { start: startDate, end: endDate });
      setLedgerData(data);
    } catch (err) {
      setError('元帳データの読み込みに失敗しました。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccount, period]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const totals = ledgerData.reduce((acc, entry) => {
      acc.debit += entry.debit ?? 0;
      acc.credit += entry.credit ?? 0;
      return acc;
  }, { debit: 0, credit: 0 });

  const openingBalance = ledgerData.length > 0 ? (ledgerData[0]?.balance ?? 0) : 0;
  const currentBalance = ledgerData.length > 0 ? (ledgerData[ledgerData.length - 1]?.balance ?? 0) : 0;


  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header: コントロールパネル */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-4">
            <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <span className="p-1.5 bg-indigo-600 text-white rounded text-xs font-mono">GL</span>
              総勘定元帳
            </h2>
            
            <div className="relative group">
              <select 
                className="appearance-none pl-4 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm min-w-[280px]"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
              >
                {accounts.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.code} : {item.name} {item.mqCode ? `[${JSON.stringify(item.mqCode)}]` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {accountInfo?.mqCode && (
               <span className={`px-2.5 py-1 rounded text-xs font-bold border`}>
                 MQ区分: {JSON.stringify(accountInfo.mqCode)}
               </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <input 
                type="month" 
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36"
              />
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            <div className="h-6 w-px bg-slate-300 mx-2"></div>
            <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition">
              <Printer className="w-5 h-5" />
            </button>
            <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2">
              <Download className="w-4 h-4" /> CSV
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-200 divide-x divide-slate-200">
          <div className="p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">前月繰越</p>
              <p className="font-mono font-medium text-slate-700">{formatCurrency(openingBalance)}</p>
          </div>
          <div className="p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">借方合計</p>
              <p className="font-mono font-medium text-slate-700">{formatCurrency(totals.debit)}</p>
          </div>
          <div className="p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">貸方合計</p>
              <p className="font-mono font-medium text-slate-700">{formatCurrency(totals.credit)}</p>
          </div>
          <div className="p-3 text-center bg-indigo-50/30">
              <p className="text-[10px] text-indigo-600 uppercase tracking-wide font-bold">現在残高</p>
              <p className="font-mono font-bold text-indigo-700">{formatCurrency(currentBalance)}</p>
          </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-white">
        {isLoading ? (
            <div className="flex items-center justify-center h-full">
                <Loader className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">{error}</div>
        ) : ledgerData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">この期間の取引データはありません</div>
        ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 sticky top-0 z-10 text-xs font-semibold text-slate-500 shadow-sm">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200 w-32">日付</th>
                  <th className="px-4 py-3 border-b border-slate-200 w-24">伝票No</th>
                  <th className="px-4 py-3 border-b border-slate-200 min-w-[200px]">摘要</th>
                  <th className="px-4 py-3 border-b border-slate-200 w-48">相手勘定 / 取引先</th>
                  <th className="px-4 py-3 border-b border-slate-200 text-right w-32 bg-slate-50">借方金額</th>
                  <th className="px-4 py-3 border-b border-slate-200 text-right w-32 bg-slate-50">貸方金額</th>
                  <th className="px-4 py-3 border-b border-slate-200 text-center w-16">借/貸</th>
                  <th className="px-4 py-3 border-b border-slate-200 text-right w-32 bg-indigo-50/10">残高</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                {ledgerData.map((row) => (
                  <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-4 py-2.5 font-mono text-slate-500 text-xs">{row.date}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-400 text-xs group-hover:text-indigo-500 cursor-pointer hover:underline">{row.voucherNo}</td>
                    <td className="px-4 py-2.5 font-medium">{row.description}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{row.partner || '-'}</td>
                    <td className="px-4 py-2.5 text-right font-mono bg-slate-50/30">{formatCurrency(row.debit)}</td>
                    <td className="px-4 py-2.5 text-right font-mono bg-slate-50/30">{formatCurrency(row.credit)}</td>
                    <td className="px-4 py-2.5 text-center text-xs">{row.type}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800 bg-indigo-50/5">{formatCurrency(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </div>
    </div>
  );
};

export default GeneralLedger;
