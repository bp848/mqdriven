
import React, { useState } from 'react';
import { Search, Download, Calendar, Filter, ChevronDown, Printer } from 'lucide-react';

// モックデータ: 勘定科目リスト (MQ分類付き)
const accountItems = [
  { code: '1110', name: '普通預金 (メイン)', type: 'BS', mq: null },
  { code: '1120', name: '当座預金 (サブ)', type: 'BS', mq: null },
  { code: '4110', name: '売上高', type: 'PL', mq: 'PQ' },
  { code: '5210', name: '仕入高(用紙)', type: 'PL', mq: 'VQ' },
  { code: '5330', name: '外注加工費', type: 'PL', mq: 'VQ' },
  { code: '6110', name: '役員報酬', type: 'PL', mq: 'F' },
  { code: '6212', name: '地代家賃', type: 'PL', mq: 'F' },
  { code: '6310', name: '消耗品費', type: 'PL', mq: 'F' },
];

// モックデータ: 元帳明細 (例: 1110 普通預金)
const ledgerData = [
  { id: 1, date: '2024/05/01', voucherNo: '10001', description: '前月繰越', partner: '', debit: null, credit: null, balance: 12500000, type: '借' },
  { id: 2, date: '2024/05/02', voucherNo: '10005', description: '売掛金入金', partner: '株式会社A社', debit: 550000, credit: null, balance: 13050000, type: '借' },
  { id: 3, date: '2024/05/10', voucherNo: '10023', description: '用紙仕入代金支払', partner: '洋紙販売株式会社', debit: null, credit: 850000, balance: 12200000, type: '借' },
  { id: 4, date: '2024/05/15', voucherNo: '10045', description: '家賃引き落とし', partner: '不動産管理サービス', debit: null, credit: 330000, balance: 11870000, type: '借' },
  { id: 5, date: '2024/05/20', voucherNo: '10056', description: '売掛金入金', partner: 'B出版', debit: 1200000, credit: null, balance: 13070000, type: '借' },
  { id: 6, date: '2024/05/25', voucherNo: '10067', description: '給与振込', partner: '従業員一括', debit: null, credit: 2800000, balance: 10270000, type: '借' },
  { id: 7, date: '2024/05/31', voucherNo: '10089', description: '社会保険料引き落とし', partner: '日本年金機構', debit: null, credit: 450000, balance: 9820000, type: '借' },
];

const formatCurrency = (val: number | null) => {
  if (val === null) return '';
  return val.toLocaleString();
};

export const GeneralLedger: React.FC = () => {
  const [selectedAccount, setSelectedAccount] = useState('1110');
  const accountInfo = accountItems.find(a => a.code === selectedAccount);

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
                {accountItems.map(item => (
                  <option key={item.code} value={item.code}>
                    {item.code} : {item.name} {item.mq ? `[${item.mq}]` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {accountInfo?.mq && (
               <span className={`px-2.5 py-1 rounded text-xs font-bold border ${
                 accountInfo.mq === 'PQ' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                 accountInfo.mq === 'VQ' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                 accountInfo.mq === 'F' ? 'bg-amber-100 text-amber-700 border-amber-200' : ''
               }`}>
                 MQ区分: {accountInfo.mq}
               </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <input 
                type="month" 
                defaultValue="2024-05"
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

        {/* Filters Row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="摘要、相手勘定、金額で検索..." 
                    className="pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded text-xs w-64 focus:outline-none focus:border-indigo-400"
                />
            </div>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-xs text-slate-600 border border-transparent hover:border-slate-300 transition">
                <Filter className="w-3.5 h-3.5" /> 絞り込み
            </button>
            <div className="flex-1 text-right text-xs text-slate-500">
               表示件数: {ledgerData.length}件 / 全245件
            </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-200 divide-x divide-slate-200">
          <div className="p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">前月繰越</p>
              <p className="font-mono font-medium text-slate-700">12,500,000</p>
          </div>
          <div className="p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">借方合計</p>
              <p className="font-mono font-medium text-slate-700">1,750,000</p>
          </div>
          <div className="p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">貸方合計</p>
              <p className="font-mono font-medium text-slate-700">4,430,000</p>
          </div>
          <div className="p-3 text-center bg-indigo-50/30">
              <p className="text-[10px] text-indigo-600 uppercase tracking-wide font-bold">現在残高</p>
              <p className="font-mono font-bold text-indigo-700">9,820,000</p>
          </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-white">
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
            {/* Empty rows filler */}
            {[...Array(5)].map((_, i) => (
              <tr key={`empty-${i}`}>
                <td className="px-4 py-3">&nbsp;</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 bg-slate-50/30"></td>
                <td className="px-4 py-3 bg-slate-50/30"></td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 bg-indigo-50/5"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
