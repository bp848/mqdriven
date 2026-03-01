import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, User, AlertCircle, CheckCircle, PieChart, Download, Calendar, Filter, ListFilter, Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReceivableItem } from '../../types';
import * as dataService from '../../services/dataService';

const STATUS_MAP = {
  outstanding: { text: '未回収', color: 'bg-red-100 text-red-800', icon: <AlertCircle className="w-3 h-3" /> },
  partially_paid: { text: '一部入金', color: 'bg-blue-100 text-blue-800', icon: <DollarSign className="w-3 h-3" /> },
  paid: { text: '回収済', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="w-3 h-3" /> },
};

const ReceivablesPage: React.FC = () => {
  const [receivables, setReceivables] = useState<ReceivableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>('outstanding');
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  const shiftMonth = (delta: number) => {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setPeriod(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
  };

  const loadReceivables = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [year, month] = period.split('-').map(Number);
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endOfMonth = new Date(year, month, 0);
      const endDate = `${endOfMonth.getFullYear()}-${(endOfMonth.getMonth() + 1).toString().padStart(2, '0')}-${endOfMonth.getDate().toString().padStart(2, '0')}`;
      const filters = {
        status: filterStatus === 'all' ? undefined : filterStatus,
        startDate,
        endDate,
      };
      const data = await dataService.getReceivables(filters);
      setReceivables(data);
    } catch (err) {
      setError('売掛金データの読み込みに失敗しました。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, period]);

  useEffect(() => {
    loadReceivables();
  }, [loadReceivables]);

  const today = new Date().toISOString().split('T')[0];

  const summary = receivables.reduce((acc, r) => {
    acc.totalAmount += r.amount;
    acc.totalPaid += r.paidAmount;
    acc.totalUnpaid += (r.amount - r.paidAmount);
    if (r.status !== 'paid' && r.due && r.due < today) acc.overdueCount++;
    return acc;
  }, { totalAmount: 0, totalPaid: 0, totalUnpaid: 0, overdueCount: 0 });

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg text-slate-800">売掛金管理</h2>
          <div className="flex items-center gap-2">
            {/* Actions can be added here */}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="pl-2 pr-8 py-1 bg-white border border-slate-300 rounded text-sm text-slate-600"
            >
              <option value="all">すべてのステータス</option>
              <option value="outstanding">未回収</option>
              <option value="partially_paid">一部入金</option>
              <option value="paid">回収済</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded hover:bg-slate-200 transition"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
            <div className="relative">
              <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="pl-8 pr-3 py-1 bg-white border border-slate-300 rounded text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40" />
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            <button onClick={() => shiftMonth(1)} className="p-1.5 rounded hover:bg-slate-200 transition"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 border-b border-slate-200 divide-x divide-slate-200">
        <div className="p-3 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">発生額合計</p>
          <p className="font-mono font-medium text-slate-700">¥{summary.totalAmount.toLocaleString()}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">回収済額</p>
          <p className="font-mono font-medium text-emerald-600">¥{summary.totalPaid.toLocaleString()}</p>
        </div>
        <div className="p-3 text-center bg-indigo-50/30">
          <p className="text-[10px] text-indigo-600 uppercase tracking-wide font-bold">未回収残高</p>
          <p className="font-mono font-bold text-indigo-700">¥{summary.totalUnpaid.toLocaleString()}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">期日超過</p>
          <p className={`font-mono font-bold ${summary.overdueCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>{summary.overdueCount}件</p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full"><Loader className="w-8 h-8 animate-spin text-indigo-600" /></div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">{error}</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-xs font-semibold text-slate-500 sticky top-0">
              <tr>
                <th className="px-4 py-2">顧客名</th>
                <th className="px-4 py-2">カテゴリ</th>
                <th className="px-4 py-2 text-right">金額</th>
                <th className="px-4 py-2 text-right">入金済</th>
                <th className="px-4 py-2 text-right">未回収残高</th>
                <th className="px-4 py-2">発生日</th>
                <th className="px-4 py-2">回収期日</th>
                <th className="px-4 py-2">ステータス</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
              {receivables.map((item) => {
                const isOverdue = item.status !== 'paid' && item.due && item.due < today;
                const unpaid = item.amount - item.paidAmount;
                return (
                  <tr key={item.id} className={`hover:bg-slate-50 ${isOverdue ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3 font-medium">{item.customer}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.category}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">¥{item.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600">{item.paidAmount > 0 ? `¥${item.paidAmount.toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{unpaid > 0 ? `¥${unpaid.toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.date}</td>
                    <td className={`px-4 py-3 font-mono text-xs font-bold ${isOverdue ? 'text-red-600' : 'text-slate-600'}`}>{item.due}{isOverdue ? ' !' : ''}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[item.status]?.color || ''}`}>
                        {STATUS_MAP[item.status]?.icon}
                        {STATUS_MAP[item.status]?.text || item.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ReceivablesPage;